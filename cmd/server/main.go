package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"supply-bo-builder/pkg/blockchain"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	webDir := "web"
	outputDir := "output"

	// Ensure directories exist
	if _, err := os.Stat(webDir); os.IsNotExist(err) {
		log.Fatalf("Web directory '%s' does not exist", webDir)
	}

	// --- Blockchain verification service (read-only VeChainThor) ---
	// Reads the anchoring metadata the Blockchain Engine already wrote and
	// proxies live read-only contract calls. All paths/URLs are overridable
	// via env so the same binary works across machines and networks.
	deploymentsDir := envOr("BLOCKCHAIN_DEPLOYMENTS_DIR",
		filepath.Join("ENGINE", "BLOCKCHAIN ENGINE", "deployments"))
	gs1OutputDir := envOr("GS1_OUTPUT_DIR",
		filepath.Join("ENGINE", "GS1 ENGINE", "output"))
	rpcURL := envOr("VECHAIN_RPC_URL", "https://testnet.vechain.org")
	network := envOr("VECHAIN_NETWORK", "vechain_testnet")
	explorerBase := envOr("VECHAIN_EXPLORER_BASE", "https://explore.vechain.org")
	// Trust the corporate CA (TLS interception) so live VeChain reads work
	// without any extra command/env. Prefer an explicit env, then fall back to
	// the CA bundled in the repo.
	caCertPath := os.Getenv("NODE_EXTRA_CA_CERTS")
	if caCertPath == "" {
		defaultCA := filepath.Join("ENGINE", "BLOCKCHAIN ENGINE", "corporate-ca.pem")
		if _, err := os.Stat(defaultCA); err == nil {
			caCertPath = defaultCA
		}
	}
	bcService := blockchain.NewService(deploymentsDir, gs1OutputDir, rpcURL, network, explorerBase, caCertPath)

	mux := http.NewServeMux()

	// Direct access to output directory for dynamic queries
	fsOutput := http.StripPrefix("/output/", http.FileServer(http.Dir(outputDir)))
	mux.Handle("/output/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		fsOutput.ServeHTTP(w, r)
	}))

	// Static frontend with SPA route fallback (/home, /login, /tracibility, /blockchain, /counterfeit)
	fsWeb := http.FileServer(http.Dir(webDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		path := filepath.Join(webDir, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			fsWeb.ServeHTTP(w, r)
			return
		}
		// Serve index.html for SPA routes (e.g., /home, /login, /tracibility, etc.)
		http.ServeFile(w, r, filepath.Join(webDir, "index.html"))
	})

	// API Status endpoint
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		fmt.Fprintf(w, `{"status":"online","service":"SAP S/4HANA & ECC Traceability 360 Explorer","port":"%s"}`, port)
	})

	// Demo auth session endpoint (pure Go standard library, no external auth framework needed)
	mux.HandleFunc("/api/auth/demo", func(w http.ResponseWriter, r *http.Request) {
		writeCORS(w)
		if r.Method == http.MethodOptions {
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":        "online",
			"mode":          "demo",
			"authenticated": true,
			"user":          "Demo Auditor",
			"role":          "Quality Auditor",
		})
	})

	// List available finished batches
	mux.HandleFunc("/api/batches", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		fbgDir := filepath.Join(outputDir, "finished_batch_genealogy")
		entries, err := os.ReadDir(fbgDir)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		var batchList []string
		for _, e := range entries {
			if e.IsDir() {
				batchList = append(batchList, e.Name())
			}
		}

		w.Write([]byte(fmt.Sprintf(`{"batches":%s}`, toJSONSlice(batchList))))
	})

	// List available raw material batches
	mux.HandleFunc("/api/raw-batches", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		rmgDir := filepath.Join(outputDir, "raw_material_genealogy")
		entries, err := os.ReadDir(rmgDir)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		var rawList []string
		for _, e := range entries {
			if e.IsDir() {
				rawList = append(rawList, e.Name())
			}
		}

		w.Write([]byte(fmt.Sprintf(`{"raw_batches":%s}`, toJSONSlice(rawList))))
	})

	// --- Blockchain verification API ---------------------------------------

	// Frontend config: network + explorer base URL.
	mux.HandleFunc("/api/blockchain/config", func(w http.ResponseWriter, r *http.Request) {
		writeCORS(w)
		if r.Method == http.MethodOptions {
			return
		}
		writeJSON(w, http.StatusOK, bcService.Config())
	})

	// List batches that have on-chain anchoring metadata.
	mux.HandleFunc("/api/blockchain/batches", func(w http.ResponseWriter, r *http.Request) {
		writeCORS(w)
		if r.Method == http.MethodOptions {
			return
		}
		writeJSON(w, http.StatusOK, map[string][]string{"batches": bcService.AvailableBatches()})
	})

	// Per-batch verification payload: GET /api/blockchain/{batchId}.
	mux.HandleFunc("/api/blockchain/", func(w http.ResponseWriter, r *http.Request) {
		writeCORS(w)
		if r.Method == http.MethodOptions {
			return
		}
		batchID := strings.TrimPrefix(r.URL.Path, "/api/blockchain/")
		batchID = strings.Trim(batchID, "/")
		if batchID == "" || strings.Contains(batchID, "/") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "batch id required"})
			return
		}
		view, err := bcService.GetBatchView(batchID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, view)
	})

	fmt.Printf("==================================================================\n")
	fmt.Printf(" SAP S/4HANA & ECC Traceability 360° Portal Server\n")
	fmt.Printf(" Serving static UI from : ./%s\n", webDir)
	fmt.Printf(" Serving SAP output from: ./%s\n", outputDir)
	fmt.Printf(" Listening on           : http://localhost:%s\n", port)
	fmt.Printf("==================================================================\n")

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func writeCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func toJSONSlice(items []string) string {
	res := "["
	for i, it := range items {
		if i > 0 {
			res += ","
		}
		res += fmt.Sprintf(`"%s"`, it)
	}
	res += "]"
	return res
}
