/**
 * VeChain blockchain verification client (frontend).
 *
 * The Go server proxies read-only VeChainThor contract reads (thor-devkit-style
 * ABI encoding against the Thorest REST endpoint) so the browser never has to
 * deal with the corporate TLS proxy or CORS. This module just calls the Go API
 * and normalizes the result for the /blockchain dashboard.
 *
 * Endpoints (served by cmd/server/main.go):
 *   GET /api/blockchain/config          -> { network, explorerBase }
 *   GET /api/blockchain/batches         -> { batches: [...] }
 *   GET /api/blockchain/{batchId}       -> BatchView (live on-chain verified)
 */
(function () {
  'use strict';

  class VeChainVerifier {
    constructor() {
      this._config = null;
    }

    /** Cached network/explorer config. */
    async getConfig() {
      if (this._config) return this._config;
      try {
        const res = await fetch('/api/blockchain/config');
        if (res.ok) {
          this._config = await res.json();
        }
      } catch (e) {
        console.warn('[VeChainVerifier] config fetch failed:', e);
      }
      if (!this._config) {
        this._config = window.BLOCKCHAIN_BUNDLE?.config || {
          network: 'vechain_testnet',
          explorerBase: 'https://explore.vechain.org',
        };
      }
      return this._config;
    }

    /**
     * Fetch the live-verified blockchain view for a batch.
     * Returns null when the batch has no on-chain anchoring metadata.
     */
    async verifyBatch(batchId) {
      try {
        const res = await fetch(
          '/api/blockchain/' + encodeURIComponent(batchId)
        );
        if (res.status === 404) return null;
        if (res.ok) return res.json();
      } catch (e) {
        console.warn('[VeChainVerifier] API unavailable; using build-time snapshot:', e);
      }

      return window.BLOCKCHAIN_BUNDLE?.batches?.[batchId] || null;
    }

    /** Build a VeChain explorer transaction URL. */
    async explorerTx(txId) {
      const cfg = await this.getConfig();
      if (!txId) return '#';
      return cfg.explorerBase.replace(/\/$/, '') + '/transactions/' + txId;
    }

    /** Build a VeChain explorer account/contract URL. */
    async explorerAccount(address) {
      const cfg = await this.getConfig();
      if (!address) return '#';
      return cfg.explorerBase.replace(/\/$/, '') + '/accounts/' + address;
    }

    /** Short 0xabcd…ef01 form for hashes/addresses. */
    static short(hex, lead = 10, tail = 8) {
      if (!hex || hex.length <= lead + tail) return hex || '';
      return hex.slice(0, lead) + '…' + hex.slice(-tail);
    }

    /** Human-readable label for a GS1 CBV bizStep URN. */
    static bizStepLabel(urn) {
      if (!urn) return '—';
      const key = String(urn).split(':').pop().toLowerCase();
      const map = {
        commissioning: 'Commissioning',
        producing: 'Producing',
        packing: 'Packing',
        shipping: 'Shipping',
        receiving: 'Receiving',
        inspecting: 'Inspecting',
        storing: 'Storing',
        transforming: 'Transforming',
        accepting: 'Accepting',
        holding: 'Holding',
        sampling: 'Sampling',
        destroying: 'Destroying',
        quality_testing: 'Quality Testing',
        quality_inspection: 'Quality Inspection',
        staging_outbound: 'Staging Outbound',
        picking: 'Picking',
        loading: 'Loading',
        departing: 'Departing',
        arriving: 'Arriving',
        stocking: 'Stocking',
      };
      if (map[key]) return map[key];
      // Title-case any remaining snake_case CBV step (e.g. "goods_receipt").
      return key
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    /** Human-readable label for a GS1 CBV disposition URN. */
    static dispositionLabel(urn) {
      if (!urn) return '';
      const key = String(urn).split(':').pop().toLowerCase();
      const map = {
        active: 'Active',
        in_progress: 'In Progress',
        in_transit: 'In Transit',
        sellable_accessible: 'Sellable',
        conformant: 'Conformant (QA pass)',
        non_conformant: 'Non-Conformant (QA fail)',
        recalled: 'Recalled',
        destroyed: 'Destroyed',
      };
      return map[key] || key.replace(/_/g, ' ');
    }

    /** Friendly EPCIS event-type label. */
    static eventTypeLabel(type) {
      if (!type) return 'EPCIS Event';
      const map = {
        ObjectEvent: 'Object Event',
        AggregationEvent: 'Aggregation Event',
        TransactionEvent: 'Transaction Event',
        TransformationEvent: 'Transformation Event',
        AssociationEvent: 'Association Event',
      };
      return map[type] || type;
    }

    /** Short human label for an EPC class / batch URN (last two segments). */
    static epcLabel(urn) {
      if (!urn) return '';
      const parts = String(urn).split(':');
      return parts.slice(-1)[0] || urn;
    }

    /** Location label from a URN (last segment). */
    static locationLabel(urn) {
      if (!urn) return '—';
      return String(urn).split(':').pop();
    }

    /** Presentation metadata for a per-event status string. */
    static statusStyle(status) {
      switch (status) {
        case 'VERIFIED':
          return { label: 'Blockchain Verified', icon: '✓', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' };
        case 'MISMATCH':
          return { label: 'Hash Mismatch', icon: '✕', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.35)' };
        case 'NOT_ANCHORED':
          return { label: 'Not Anchored', icon: '○', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' };
        default:
          return { label: 'Verify Error', icon: '!', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' };
      }
    }
  }

  window.veChainVerifier = new VeChainVerifier();
  window.VeChainVerifier = VeChainVerifier;
})();
