// Package blockchain provides read-only verification of GS1 EPCIS anchoring
// on VeChainThor for the /blockchain dashboard page.
//
// It does NOT sign or send transactions. It proxies read-only contract view
// calls (EventIntegrityAnchor) through VeChain's native Thorest REST endpoint
// POST /accounts/{address}  (the "call" form), plus reads the anchoring
// metadata the Blockchain Engine already wrote under
// ENGINE/BLOCKCHAIN ENGINE/deployments/.
//
// ABI encoding here is intentionally minimal and dependency-free: every view
// function we call takes a single bytes32 (or bytes32+address) and returns a
// fixed, statically-known layout, so we hand-encode the 4-byte selector plus
// 32-byte words rather than pulling in a full ABI library.
package blockchain

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

// Function selectors (keccak256(signature)[:4]) for EventIntegrityAnchor.
const (
	selGetEventRecord      = "b2734801" // getEventRecord(bytes32)
	selGetBatchRoot        = "3acba8ec" // getBatchRoot(bytes32)
	selIsEventAnchored     = "9f53a746" // isEventAnchored(bytes32)
	selGetBatchEventCount  = "fe557bf3" // getBatchEventCount(bytes32)
	selIsBatchRootAnchored = "dadfd010" // isBatchRootAnchored(bytes32)
	selHasRole             = "91d14854" // hasRole(bytes32,address)
	selAnchorRole          = "fd5f48c5" // ANCHOR_ROLE()
)

// Client performs read-only Thorest calls against a VeChainThor node.
type Client struct {
	baseURL string // e.g. https://testnet.vechain.org
	http    *http.Client
}

// NewClient builds a read-only client. If caCertPath is non-empty and the file
// exists, it is added to the trust store (handles corporate TLS interception,
// same as NODE_EXTRA_CA_CERTS for the Node tooling).
func NewClient(baseURL, caCertPath string) *Client {
	transport := &http.Transport{}
	if caCertPath != "" {
		if pem, err := os.ReadFile(caCertPath); err == nil {
			pool, _ := x509.SystemCertPool()
			if pool == nil {
				pool = x509.NewCertPool()
			}
			if pool.AppendCertsFromPEM(pem) {
				transport.TLSClientConfig = &tls.Config{RootCAs: pool}
			}
		}
	}
	return &Client{
		baseURL: strings.TrimRight(strings.TrimSuffix(baseURL, "/thor"), "/"),
		http:    &http.Client{Timeout: 30 * time.Second, Transport: transport},
	}
}

// thorCallRequest is one clause for POST /accounts/{addr}.
type thorCallRequest struct {
	Data string `json:"data"`
}

// thorCallResponse is the Thorest reply for a read-only call.
type thorCallResponse struct {
	Data     string `json:"data"`
	Reverted bool   `json:"reverted"`
	VMError  string `json:"vmError"`
}

// call executes a read-only contract call and returns the raw hex output
// (without the 0x prefix).
func (c *Client) call(contract, data string) (string, error) {
	url := fmt.Sprintf("%s/accounts/%s", c.baseURL, contract)
	body, _ := json.Marshal(thorCallRequest{Data: "0x" + data})
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("thorest call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("thorest call HTTP %d", resp.StatusCode)
	}

	var out thorCallResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.Reverted {
		return "", fmt.Errorf("call reverted: %s", out.VMError)
	}
	return strings.TrimPrefix(out.Data, "0x"), nil
}

// normalizeBytes32 strips 0x and left-pads/truncates to 32 bytes (64 hex).
func normalizeBytes32(v string) string {
	v = strings.TrimPrefix(strings.ToLower(v), "0x")
	if len(v) > 64 {
		v = v[len(v)-64:]
	}
	for len(v) < 64 {
		v = "0" + v
	}
	return v
}

func normalizeAddress(v string) string {
	v = strings.TrimPrefix(strings.ToLower(v), "0x")
	for len(v) < 64 {
		v = "0" + v
	}
	return v
}

// EventRecord mirrors the on-chain struct EventAnchorRecord.
type EventRecord struct {
	BatchKey   string `json:"batchKey"`
	EventHash  string `json:"eventHash"`
	EventID    string `json:"eventId"`
	EventType  uint64 `json:"eventType"`
	Timestamp  uint64 `json:"timestamp"`
	Sequence   uint64 `json:"sequence"`
	AnchoredBy string `json:"anchoredBy"`
}

// GetEventRecord reads the on-chain record for one event hash.
// Struct return layout (7 x 32-byte words):
//   batchKey, eventHash, eventId, eventType(uint8), timestamp(uint64),
//   sequence(uint256), anchoredBy(address)
func (c *Client) GetEventRecord(contract, eventHash string) (*EventRecord, error) {
	data := selGetEventRecord + normalizeBytes32(eventHash)
	out, err := c.call(contract, data)
	if err != nil {
		return nil, err
	}
	words, err := splitWords(out, 7)
	if err != nil {
		return nil, err
	}
	return &EventRecord{
		BatchKey:   "0x" + words[0],
		EventHash:  "0x" + words[1],
		EventID:    "0x" + words[2],
		EventType:  wordToUint(words[3]),
		Timestamp:  wordToUint(words[4]),
		Sequence:   wordToUint(words[5]),
		AnchoredBy: "0x" + words[6][24:], // last 20 bytes
	}, nil
}

// BatchRootRecord mirrors the on-chain struct BatchRootRecord.
type BatchRootRecord struct {
	BatchKey    string `json:"batchKey"`
	MerkleRoot  string `json:"merkleRoot"`
	DatasetHash string `json:"datasetHash"`
	EventCount  uint64 `json:"eventCount"`
	Timestamp   uint64 `json:"timestamp"`
	AnchoredBy  string `json:"anchoredBy"`
}

// GetBatchRoot reads the on-chain batch-root linking commitment.
// Layout (6 words): batchKey, merkleRoot, datasetHash, eventCount, timestamp,
// anchoredBy.
func (c *Client) GetBatchRoot(contract, batchKey string) (*BatchRootRecord, error) {
	data := selGetBatchRoot + normalizeBytes32(batchKey)
	out, err := c.call(contract, data)
	if err != nil {
		return nil, err
	}
	words, err := splitWords(out, 6)
	if err != nil {
		return nil, err
	}
	return &BatchRootRecord{
		BatchKey:    "0x" + words[0],
		MerkleRoot:  "0x" + words[1],
		DatasetHash: "0x" + words[2],
		EventCount:  wordToUint(words[3]),
		Timestamp:   wordToUint(words[4]),
		AnchoredBy:  "0x" + words[5][24:],
	}, nil
}

// IsEventAnchored returns whether an event hash is anchored on-chain.
func (c *Client) IsEventAnchored(contract, eventHash string) (bool, error) {
	out, err := c.call(contract, selIsEventAnchored+normalizeBytes32(eventHash))
	if err != nil {
		return false, err
	}
	return wordToUint(padWord(out)) == 1, nil
}

// IsBatchRootAnchored returns whether the batch root is anchored on-chain.
func (c *Client) IsBatchRootAnchored(contract, batchKey string) (bool, error) {
	out, err := c.call(contract, selIsBatchRootAnchored+normalizeBytes32(batchKey))
	if err != nil {
		return false, err
	}
	return wordToUint(padWord(out)) == 1, nil
}

// GetBatchEventCount returns how many events are anchored under a batch.
func (c *Client) GetBatchEventCount(contract, batchKey string) (uint64, error) {
	out, err := c.call(contract, selGetBatchEventCount+normalizeBytes32(batchKey))
	if err != nil {
		return 0, err
	}
	return wordToUint(padWord(out)), nil
}

// AnchorRole returns the ANCHOR_ROLE identifier (bytes32) from the contract.
func (c *Client) AnchorRole(contract string) (string, error) {
	out, err := c.call(contract, selAnchorRole)
	if err != nil {
		return "", err
	}
	return "0x" + padWord(out), nil
}

// HasRole reports whether account holds the given role on the contract.
func (c *Client) HasRole(contract, role, account string) (bool, error) {
	data := selHasRole + normalizeBytes32(role) + normalizeAddress(account)
	out, err := c.call(contract, data)
	if err != nil {
		return false, err
	}
	return wordToUint(padWord(out)) == 1, nil
}

// --- decoding helpers -------------------------------------------------------

// splitWords splits a hex string into n 32-byte (64-hex-char) words.
func splitWords(hexStr string, n int) ([]string, error) {
	if len(hexStr) < n*64 {
		return nil, fmt.Errorf("expected %d words, got %d hex chars", n, len(hexStr))
	}
	words := make([]string, n)
	for i := 0; i < n; i++ {
		words[i] = hexStr[i*64 : (i+1)*64]
	}
	return words, nil
}

// padWord ensures a 64-hex-char word (bool/uint results may be short).
func padWord(v string) string {
	v = strings.TrimPrefix(v, "0x")
	for len(v) < 64 {
		v = "0" + v
	}
	if len(v) > 64 {
		v = v[len(v)-64:]
	}
	return v
}

// wordToUint decodes a 32-byte word into a uint64 (values fit for our fields).
func wordToUint(word string) uint64 {
	b, err := hex.DecodeString(word)
	if err != nil || len(b) == 0 {
		return 0
	}
	var v uint64
	// Use the last 8 bytes (big-endian); our values never exceed uint64.
	start := len(b) - 8
	if start < 0 {
		start = 0
	}
	for _, x := range b[start:] {
		v = v<<8 | uint64(x)
	}
	return v
}
