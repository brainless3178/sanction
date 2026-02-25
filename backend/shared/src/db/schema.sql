-- Solana Stablecoin Standard — Backend Database Schema
-- All tables required for indexer, mint-service, compliance services.

-- ============================================================
-- MINT REQUESTS (Fiat-to-stablecoin lifecycle tracking)
-- ============================================================
CREATE TABLE mint_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mint_address TEXT NOT NULL,
    recipient TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'executed', 'failed')),
    tx_signature TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX mint_requests_mint_address_idx ON mint_requests(mint_address);
CREATE INDEX mint_requests_status_idx ON mint_requests(status);

-- ============================================================
-- EVENTS (On-chain event log mirror)
-- ============================================================
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    mint_address TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    tx_signature TEXT NOT NULL,
    slot BIGINT NOT NULL,
    block_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX events_mint_address_idx ON events(mint_address);
CREATE INDEX events_event_type_idx ON events(event_type);
CREATE INDEX events_block_time_idx ON events(block_time);
CREATE INDEX events_slot_idx ON events(slot);

-- ============================================================
-- WEBHOOKS (Webhook subscription registry)
-- ============================================================
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    event_types TEXT[] NOT NULL,
    secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WEBHOOK DELIVERIES (Delivery attempt tracking)
-- ============================================================
CREATE TABLE webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    webhook_id UUID REFERENCES webhooks(id),
    event_id BIGINT REFERENCES events(id),
    attempt_count INT DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('pending', 'delivered', 'failed')),
    response_code INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX webhook_deliveries_status_idx ON webhook_deliveries(status);
CREATE INDEX webhook_deliveries_webhook_id_idx ON webhook_deliveries(webhook_id);

-- ============================================================
-- BLACKLIST (Off-chain mirror for compliance audit trail)
-- ============================================================
CREATE TABLE blacklist (
    id BIGSERIAL PRIMARY KEY,
    mint_address TEXT NOT NULL,
    address TEXT NOT NULL,
    reason TEXT NOT NULL,
    added_by TEXT NOT NULL,
    tx_signature TEXT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL,
    removed_at TIMESTAMPTZ,
    removed_tx TEXT,
    UNIQUE(mint_address, address, removed_at)
);

CREATE INDEX blacklist_mint_address_idx ON blacklist(mint_address);
CREATE INDEX blacklist_address_idx ON blacklist(address);

-- ============================================================
-- PROCESSED SLOTS (Indexer checkpoint to avoid reprocessing)
-- ============================================================
CREATE TABLE processed_slots (
    id BIGSERIAL PRIMARY KEY,
    slot BIGINT NOT NULL UNIQUE,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);
