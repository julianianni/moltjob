-- Migration 002: Payment tracking for Coinbase Commerce
-- Tracks charges created via Coinbase Commerce for the $29 seeker unlock

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_seeker_id UUID NOT NULL REFERENCES job_seekers(id) ON DELETE CASCADE,
    coinbase_charge_id VARCHAR(255) NOT NULL,
    coinbase_charge_code VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    amount_usd NUMERIC(10, 2) NOT NULL DEFAULT 29.00,
    hosted_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_job_seeker_id ON payments(job_seeker_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_coinbase_charge_id ON payments(coinbase_charge_id);
