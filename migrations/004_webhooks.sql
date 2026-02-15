-- Migration 004: Agent mappings for webhook integration with orchestrator
-- Maps user_id to external agent_id for hosted agents

BEGIN;

CREATE TABLE agent_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    agent_hosting VARCHAR(20) NOT NULL DEFAULT 'hosted',
    onboarding_session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_mappings_user_id ON agent_mappings(user_id);
CREATE INDEX idx_agent_mappings_agent_id ON agent_mappings(agent_id);

COMMIT;
