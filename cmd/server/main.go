package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
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
