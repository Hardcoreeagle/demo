-- ---------------------------------------------------------------------------
-- Indexer schema for BatchIntegrityAnchor.BatchAnchored events (#46).
-- Operational index ONLY - VeChainThor state remains the source of truth.
-- Safe to re-run: CREATE IF NOT EXISTS / idempotent seeds.
-- ---------------------------------------------------------------------------

-- Directory of observed contract deployments.
CREATE TABLE IF NOT EXISTS contract_deployments (
    contract_address CHAR(42) PRIMARY KEY,       -- 0x + 20 bytes
    network          TEXT NOT NULL,              -- vechain_solo | vechain_testnet | vechain_mainnet
    chain_id         NUMERIC(24) NOT NULL,
    deployed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    start_block      BIGINT NOT NULL DEFAULT 0
);

-- One row per anchored version. Uniqueness mirrors on-chain guarantees:
-- (contract, batch, version) is unique on-chain by construction;
-- (contract, batch, merkle_root) is unique by duplicate protection.
CREATE TABLE IF NOT EXISTS anchored_batches (
    id              BIGSERIAL PRIMARY KEY,
    contract_address CHAR(42) NOT NULL REFERENCES contract_deployments(contract_address),
    batch_key       CHAR(66) NOT NULL,           -- 0x + 32 bytes
    version         BIGINT NOT NULL CHECK (version >= 1),
    merkle_root     CHAR(66) NOT NULL,
    dataset_hash    CHAR(66) NOT NULL,
    event_count     BIGINT NOT NULL CHECK (event_count >= 1),
    anchored_by     CHAR(42) NOT NULL,
    tx_id           CHAR(66) NOT NULL,
    block_number    BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ NOT NULL,
    network         TEXT NOT NULL,
    inserted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_anchor_batch_version UNIQUE (contract_address, batch_key, version),
    CONSTRAINT uq_anchor_batch_root   UNIQUE (contract_address, batch_key, merkle_root)
);

-- Version-1 roots are the genesis commitment per batch; handy for re-verification.
CREATE INDEX IF NOT EXISTS idx_anchored_batches_batch
    ON anchored_batches (batch_key, version DESC);

CREATE INDEX IF NOT EXISTS idx_anchored_batches_root
    ON anchored_batches (merkle_root);

CREATE INDEX IF NOT EXISTS idx_anchored_batches_block
    ON anchored_batches (network, block_number DESC);

-- Optional audit trail for reorg/finality tracking (VeChainThor two-block finality).
CREATE TABLE IF NOT EXISTS anchor_status_history (
    id              BIGSERIAL PRIMARY KEY,
    anchored_batch_id BIGINT NOT NULL REFERENCES anchored_batches(id) ON DELETE CASCADE,
    status          TEXT NOT NULL CHECK (status IN ('CONFIRMED', 'FINALIZED')),
    observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anchor_status_history_batch
    ON anchor_status_history (anchored_batch_id, observed_at DESC);

-- ---------------------------------------------------------------------------
-- Per-event anchoring index for EventIntegrityAnchor (one tx per EPCIS event).
-- Operational index ONLY - VeChainThor state remains the source of truth.
-- ---------------------------------------------------------------------------

-- One row per anchored EPCIS event. Uniqueness mirrors on-chain guarantees:
-- an eventHash can be anchored only once per contract.
CREATE TABLE IF NOT EXISTS anchored_events (
    id               BIGSERIAL PRIMARY KEY,
    contract_address CHAR(42) NOT NULL,           -- 0x + 20 bytes (EventIntegrityAnchor)
    batch_key        CHAR(66) NOT NULL,           -- 0x + 32 bytes
    event_hash       CHAR(66) NOT NULL,           -- 0x + 32 bytes (SHA-256)
    event_id         CHAR(66) NOT NULL,           -- 0x + 32 bytes (opaque digest, may be zero)
    event_type       SMALLINT NOT NULL,           -- uint8 EPCIS type code
    sequence         BIGINT NOT NULL CHECK (sequence >= 1),
    anchored_by      CHAR(42) NOT NULL,
    tx_id            CHAR(66) NOT NULL,           -- transaction hash to look up in an explorer
    block_number     BIGINT NOT NULL,
    block_timestamp  TIMESTAMPTZ NOT NULL,
    network          TEXT NOT NULL,
    inserted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_anchored_event UNIQUE (contract_address, event_hash)
);

-- Look up every event of a batch, in anchoring order.
CREATE INDEX IF NOT EXISTS idx_anchored_events_batch
    ON anchored_events (contract_address, batch_key, sequence ASC);

-- Resolve a transaction hash straight to its event ("paste a tx, see event").
CREATE INDEX IF NOT EXISTS idx_anchored_events_tx
    ON anchored_events (tx_id);

CREATE INDEX IF NOT EXISTS idx_anchored_events_block
    ON anchored_events (network, block_number DESC);

-- One row per batch when its Merkle root is anchored (the linking commitment).
CREATE TABLE IF NOT EXISTS batch_roots (
    id               BIGSERIAL PRIMARY KEY,
    contract_address CHAR(42) NOT NULL,
    batch_key        CHAR(66) NOT NULL,
    merkle_root      CHAR(66) NOT NULL,
    dataset_hash     CHAR(66) NOT NULL,
    event_count      BIGINT NOT NULL CHECK (event_count >= 1),
    anchored_by      CHAR(42) NOT NULL,
    tx_id            CHAR(66) NOT NULL,
    block_number     BIGINT NOT NULL,
    block_timestamp  TIMESTAMPTZ NOT NULL,
    network          TEXT NOT NULL,
    inserted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_batch_root UNIQUE (contract_address, batch_key)
);

CREATE INDEX IF NOT EXISTS idx_batch_roots_root
    ON batch_roots (merkle_root);
