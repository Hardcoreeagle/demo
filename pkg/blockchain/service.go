package blockchain

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// Service assembles the /blockchain dashboard payload for a batch by combining
// the deployment metadata files written by the Blockchain Engine with live
// read-only VeChainThor contract reads.
type Service struct {
	deploymentsDir string // .../ENGINE/BLOCKCHAIN ENGINE/deployments
	gs1OutputDir   string // .../ENGINE/GS1 ENGINE/output
	client         *Client
	network        string
	rpcURL         string
	explorerBase   string // e.g. https://explore-testnet.vechain.org
}

// NewService wires the deployments directory, the GS1 EPCIS output directory,
// and a read-only VeChain client.
func NewService(deploymentsDir, gs1OutputDir, rpcURL, network, explorerBase, caCertPath string) *Service {
	return &Service{
		deploymentsDir: deploymentsDir,
		gs1OutputDir:   gs1OutputDir,
		client:         NewClient(rpcURL, caCertPath),
		network:        network,
		rpcURL:         rpcURL,
		explorerBase:   strings.TrimRight(explorerBase, "/"),
	}
}

// --- GS1 EPCIS document loading --------------------------------------------

type epcisRawEvent struct {
	Type                string            `json:"type"`
	EventID             string            `json:"eventID"`
	EventTime           string            `json:"eventTime"`
	EventTimeZoneOffset string            `json:"eventTimeZoneOffset"`
	BizStep             string            `json:"bizStep"`
	Disposition         string            `json:"disposition"`
	TransformationID    string            `json:"transformationID"`
	BizLocation         json.RawMessage   `json:"bizLocation"`
	ReadPoint           json.RawMessage   `json:"readPoint"`
	InputQuantityList   []QuantityElement `json:"inputQuantityList"`
	OutputQuantityList  []QuantityElement `json:"outputQuantityList"`
}

type epcisDocument struct {
	EpcisBody struct {
		EventList []epcisRawEvent `json:"eventList"`
	} `json:"epcisBody"`
}

// idFromRef extracts the "id" field of an EPCIS location object, or returns the
// raw string if the JSON is already a bare string.
func idFromRef(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var asObj struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &asObj); err == nil && asObj.ID != "" {
		return asObj.ID
	}
	var asStr string
	if err := json.Unmarshal(raw, &asStr); err == nil {
		return asStr
	}
	return ""
}

// gs1Phases are the EPCIS lifecycle phases, in supply-chain order. Each phase
// is a separate EPCIS document produced by the GS1 Engine.
var gs1Phases = []struct {
	Name string
	File string
}{
	{"procurement", "epcis-procurement.json"},
	{"production", "epcis-production.json"},
	{"quality", "epcis-quality.json"},
	{"sales", "epcis-sales.json"},
}

// loadPhaseEvents loads one EPCIS phase document and returns its events in
// document order, tagged with the phase. Missing files yield nil.
func (s *Service) loadPhaseEvents(batchID, phase, file string) []Gs1Event {
	if s.gs1OutputDir == "" {
		return nil
	}
	candidates := []string{
		filepath.Join(s.gs1OutputDir, "epcis_"+strings.ToLower(batchID), phase, file),
		filepath.Join(s.gs1OutputDir, "epcis", phase, file),
	}
	var raw []byte
	for _, p := range candidates {
		if b, err := os.ReadFile(p); err == nil {
			raw = b
			break
		}
	}
	if raw == nil {
		return nil
	}
	var doc epcisDocument
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil
	}
	out := make([]Gs1Event, 0, len(doc.EpcisBody.EventList))
	for _, e := range doc.EpcisBody.EventList {
		out = append(out, Gs1Event{
			Phase:               phase,
			Type:                e.Type,
			EventID:             e.EventID,
			EventTime:           e.EventTime,
			EventTimeZoneOffset: e.EventTimeZoneOffset,
			BizStep:             e.BizStep,
			Disposition:         e.Disposition,
			BizLocation:         idFromRef(e.BizLocation),
			ReadPoint:           idFromRef(e.ReadPoint),
			TransformationID:    e.TransformationID,
			InputQuantityList:   e.InputQuantityList,
			OutputQuantityList:  e.OutputQuantityList,
			AnchorStatus:        "RECORDED",
		})
	}
	return out
}

// loadAllGs1Events loads every EPCIS phase document for a batch and returns the
// full event list (procurement -> production -> quality -> sales).
func (s *Service) loadAllGs1Events(batchID string) []Gs1Event {
	var all []Gs1Event
	for _, ph := range gs1Phases {
		all = append(all, s.loadPhaseEvents(batchID, ph.Name, ph.File)...)
	}
	return all
}

// Config is the lightweight settings blob the frontend needs.
type Config struct {
	Network      string `json:"network"`
	ExplorerBase string `json:"explorerBase"`
}

func (s *Service) Config() Config {
	return Config{Network: s.network, ExplorerBase: s.explorerBase}
}

// --- deployment file shapes -------------------------------------------------

type anchorRecordFile struct {
	BatchID         string `json:"batchId"`
	BatchKey        string `json:"batchKey"`
	MerkleRoot      string `json:"merkleRoot"`
	DatasetHash     string `json:"datasetHash"`
	EventCount      string `json:"eventCount"`
	AnchoredBy      string `json:"anchoredBy"`
	Network         string `json:"network"`
	ContractAddress string `json:"contractAddress"`
	AnchoredAt      string `json:"anchoredAt"`
	Events          []struct {
		Sequence      int    `json:"sequence"`
		EventHash     string `json:"eventHash"`
		EventID       string `json:"eventId"`
		EventType     int    `json:"eventType"`
		EventTypeName string `json:"eventTypeName"`
		Status        string `json:"status"`
		TransactionID string `json:"transactionId"`
		BlockNumber   string `json:"blockNumber"`
	} `json:"events"`
	BatchRoot struct {
		Status        string `json:"status"`
		TransactionID string `json:"transactionId"`
		BlockNumber   string `json:"blockNumber"`
	} `json:"batchRoot"`
}

// --- dashboard payload ------------------------------------------------------

// QuantityElement is a GS1 CBV quantity line (input or output).
type QuantityElement struct {
	EPCClass string  `json:"epcClass"`
	Quantity float64 `json:"quantity"`
	UOM      string  `json:"uom"`
}

// Gs1Event holds the human-readable GS1 EPCIS 2.0 fields (CBV vocabulary) that
// make the dashboard user-centric: what happened, when, where, and why.
type Gs1Event struct {
	Phase               string            `json:"phase"` // procurement | production | quality | sales
	Type                string            `json:"type"`
	EventID             string            `json:"eventID"`
	EventTime           string            `json:"eventTime"`
	EventTimeZoneOffset string            `json:"eventTimeZoneOffset"`
	BizStep             string            `json:"bizStep"`
	Disposition         string            `json:"disposition,omitempty"`
	BizLocation         string            `json:"bizLocation,omitempty"`
	ReadPoint           string            `json:"readPoint,omitempty"`
	TransformationID    string            `json:"transformationID,omitempty"`
	InputQuantityList   []QuantityElement `json:"inputQuantityList,omitempty"`
	OutputQuantityList  []QuantityElement `json:"outputQuantityList,omitempty"`

	// Blockchain anchoring status for THIS event (populated in GetBatchView).
	// Anchored events carry a live on-chain verification; the rest are recorded
	// GS1 events that are covered by the batch dataset hash but not anchored as
	// individual transactions.
	Anchored     bool   `json:"anchored"`
	AnchorStatus string `json:"anchorStatus"` // VERIFIED | MISMATCH | NOT_ANCHORED | RECORDED | ERROR
	EventHash    string `json:"eventHash,omitempty"`
	TransactionID string `json:"transactionId,omitempty"`
	ExplorerURL  string `json:"explorerUrl,omitempty"`
}

// EventView is one anchored EPCIS event with its live verification result and
// its decoded GS1 CBV business data.
type EventView struct {
	Sequence      int    `json:"sequence"`
	EventID       string `json:"eventId"`
	EventTypeName string `json:"eventTypeName"`
	EventHash     string `json:"eventHash"`
	TransactionID string `json:"transactionId"`
	BlockNumber   string `json:"blockNumber"`
	ExplorerURL   string `json:"explorerUrl"`
	// Live on-chain verification:
	OnChain     bool   `json:"onChain"`     // event hash exists on-chain
	HashMatches bool   `json:"hashMatches"` // on-chain eventHash == metadata eventHash
	Status      string `json:"status"`      // VERIFIED | MISMATCH | NOT_ANCHORED | ERROR
	AnchoredBy  string `json:"anchoredBy"`
	VerifyError string `json:"verifyError,omitempty"`
	// Decoded GS1 EPCIS business data (nil if the source EPCIS file is absent):
	Gs1 *Gs1Event `json:"gs1,omitempty"`
}

// BatchView is the full /blockchain payload for one batch.
type BatchView struct {
	BatchID         string `json:"batchId"`
	BatchKey        string `json:"batchKey"`
	MerkleRoot      string `json:"merkleRoot"`
	DatasetHash     string `json:"datasetHash"`
	ContractAddress string `json:"contractAddress"`
	Network         string `json:"network"`
	AnchoredBy      string `json:"anchoredBy"`
	AnchoredAt      string `json:"anchoredAt"`

	ExpectedEventCount int `json:"expectedEventCount"`
	OnChainEventCount  int `json:"onChainEventCount"`

	// Batch-root (linking) verification.
	BatchRootAnchored    bool   `json:"batchRootAnchored"`
	BatchRootTx          string `json:"batchRootTx"`
	BatchRootExplorerURL string `json:"batchRootExplorerUrl"`
	MerkleRootMatches    bool   `json:"merkleRootMatches"`

	// Authorization: is the anchoring wallet an authorized ANCHOR_ROLE holder?
	AnchoredByAuthorized bool `json:"anchoredByAuthorized"`

	// Overall trust signal.
	AllVerified bool   `json:"allVerified"`
	Summary     string `json:"summary"`

	// Events is the set of individually ANCHORED events (on-chain verified).
	Events []EventView `json:"events"`

	// Gs1Events is the COMPLETE GS1 EPCIS event list across all lifecycle
	// phases (procurement, production, quality, sales), each tagged with its
	// anchoring status. This is what the dashboard lists so the user sees the
	// whole supply-chain journey, not just the anchored subset.
	Gs1Events      []Gs1Event     `json:"gs1Events"`
	TotalGs1Events int            `json:"totalGs1Events"`
	PhaseCounts    map[string]int `json:"phaseCounts"`

	// If the live node was unreachable, this holds the reason; the payload
	// still returns the metadata so the page degrades gracefully.
	ChainError string `json:"chainError,omitempty"`
}

func (s *Service) explorerTx(tx string) string {
	if s.explorerBase == "" || tx == "" {
		return ""
	}
	return s.explorerBase + "/transactions/" + tx
}

// GetBatchView builds the dashboard payload for a batch id (e.g. "PF05043").
func (s *Service) GetBatchView(batchID string) (*BatchView, error) {
	rec, err := s.latestAnchorRecord(batchID)
	if err != nil {
		return nil, err
	}

	expected, _ := strconv.Atoi(rec.EventCount)
	view := &BatchView{
		BatchID:              rec.BatchID,
		BatchKey:             rec.BatchKey,
		MerkleRoot:           rec.MerkleRoot,
		DatasetHash:          rec.DatasetHash,
		ContractAddress:      rec.ContractAddress,
		Network:              rec.Network,
		AnchoredBy:           rec.AnchoredBy,
		AnchoredAt:           rec.AnchoredAt,
		ExpectedEventCount:   expected,
		BatchRootTx:          rec.BatchRoot.TransactionID,
		BatchRootExplorerURL: s.explorerTx(rec.BatchRoot.TransactionID),
	}

	// --- live on-chain reads (best-effort; degrade gracefully) ---
	if cnt, err := s.client.GetBatchEventCount(rec.ContractAddress, rec.BatchKey); err == nil {
		view.OnChainEventCount = int(cnt)
	} else {
		view.ChainError = err.Error()
	}

	if br, err := s.client.GetBatchRoot(rec.ContractAddress, rec.BatchKey); err == nil {
		view.BatchRootAnchored = true
		view.MerkleRootMatches = strings.EqualFold(br.MerkleRoot, rec.MerkleRoot)
	}

	// Authorization: does the anchoring wallet hold ANCHOR_ROLE?
	if role, err := s.client.AnchorRole(rec.ContractAddress); err == nil {
		if ok, err := s.client.HasRole(rec.ContractAddress, role, rec.AnchoredBy); err == nil {
			view.AnchoredByAuthorized = ok
		}
	}

	// Full GS1 EPCIS event list across all lifecycle phases.
	gs1Events := s.loadAllGs1Events(rec.BatchID)

	// Index the anchored production events by their document order so we can
	// mark the matching GS1 events as on-chain verified. The anchored events
	// are exactly the "production" phase events (sequence is 1-based within
	// that phase).
	productionIdx := 0

	allVerified := view.ChainError == ""
	for _, e := range rec.Events {
		ev := EventView{
			Sequence:      e.Sequence,
			EventID:       e.EventID,
			EventTypeName: e.EventTypeName,
			EventHash:     e.EventHash,
			TransactionID: e.TransactionID,
			BlockNumber:   e.BlockNumber,
			ExplorerURL:   s.explorerTx(e.TransactionID),
			Status:        "NOT_ANCHORED",
		}

		onchain, err := s.client.GetEventRecord(rec.ContractAddress, e.EventHash)
		if err != nil {
			// Distinguish "not anchored" (revert) from a transport error.
			if strings.Contains(err.Error(), "reverted") {
				ev.Status = "NOT_ANCHORED"
			} else {
				ev.Status = "ERROR"
				ev.VerifyError = err.Error()
			}
			allVerified = false
		} else {
			ev.OnChain = true
			ev.HashMatches = strings.EqualFold(onchain.EventHash, e.EventHash)
			ev.AnchoredBy = onchain.AnchoredBy
			if ev.HashMatches {
				ev.Status = "VERIFIED"
			} else {
				ev.Status = "MISMATCH"
				allVerified = false
			}
		}
		view.Events = append(view.Events, ev)

		// Reflect the anchoring/verification onto the matching GS1 production
		// event so the full-journey list shows the on-chain badge + tx link.
		for productionIdx < len(gs1Events) {
			g := &gs1Events[productionIdx]
			productionIdx++
			if g.Phase == "production" {
				g.Anchored = true
				g.AnchorStatus = ev.Status
				g.EventHash = ev.EventHash
				g.TransactionID = ev.TransactionID
				g.ExplorerURL = ev.ExplorerURL
				break
			}
		}
	}

	// Publish the full GS1 list + phase counts.
	view.Gs1Events = gs1Events
	view.TotalGs1Events = len(gs1Events)
	view.PhaseCounts = map[string]int{}
	for _, g := range gs1Events {
		view.PhaseCounts[g.Phase]++
	}

	if len(view.Events) != view.ExpectedEventCount || view.ExpectedEventCount == 0 {
		allVerified = allVerified && len(view.Events) > 0
	}
	view.AllVerified = allVerified
	if allVerified {
		view.Summary = fmt.Sprintf("%d GS1 EPCIS events recorded; %d of %d key events anchored & verified on-chain",
			view.TotalGs1Events, len(view.Events), view.ExpectedEventCount)
	} else if view.ChainError != "" {
		view.Summary = "Live chain read unavailable; showing recorded GS1 events"
	} else {
		view.Summary = "One or more anchored events could not be verified on-chain"
	}

	return view, nil
}

// latestAnchorRecord finds the most recent event-anchor-record JSON for a batch.
func (s *Service) latestAnchorRecord(batchID string) (*anchorRecordFile, error) {
	dir := filepath.Join(s.deploymentsDir, "event-anchor-records")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("no anchor records directory: %w", err)
	}

	var matches []string
	prefix := batchID + "-"
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasPrefix(name, prefix) && strings.HasSuffix(name, ".json") {
			matches = append(matches, name)
		}
	}
	if len(matches) == 0 {
		return nil, fmt.Errorf("no anchor record found for batch %q", batchID)
	}
	// File names embed an ISO timestamp, so lexical sort == chronological.
	sort.Strings(matches)
	latest := matches[len(matches)-1]

	raw, err := os.ReadFile(filepath.Join(dir, latest))
	if err != nil {
		return nil, err
	}
	var rec anchorRecordFile
	if err := json.Unmarshal(raw, &rec); err != nil {
		return nil, fmt.Errorf("parse %s: %w", latest, err)
	}
	if rec.ContractAddress == "" {
		return nil, fmt.Errorf("anchor record %s missing contractAddress", latest)
	}
	return &rec, nil
}

// AvailableBatches lists batch ids that have an anchor record on disk.
func (s *Service) AvailableBatches() []string {
	dir := filepath.Join(s.deploymentsDir, "event-anchor-records")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		// batchId is everything before the trailing "-<ISO timestamp>.json".
		name := strings.TrimSuffix(e.Name(), ".json")
		if idx := strings.LastIndex(name, "-20"); idx > 0 {
			name = name[:idx]
		}
		if !seen[name] {
			seen[name] = true
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out
}
