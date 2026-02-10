-- AgentJobs MVP Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums
CREATE TYPE user_role AS ENUM ('job_seeker', 'employer');
CREATE TYPE application_status AS ENUM ('pending', 'reviewing', 'shortlisted', 'interview_scheduled', 'rejected', 'accepted');
CREATE TYPE job_status AS ENUM ('active', 'paused', 'closed', 'filled');
CREATE TYPE message_sender_type AS ENUM ('agent', 'employer', 'system');

-- Users table (authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Seekers (agent profiles)
CREATE TABLE job_seekers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    resume_text TEXT NOT NULL,
    skills TEXT[] DEFAULT '{}',
    preferred_job_titles TEXT[] DEFAULT '{}',
    preferred_locations TEXT[] DEFAULT '{}',
    min_salary INTEGER,
    max_salary INTEGER,
    experience_years INTEGER DEFAULT 0,
    remote_preference VARCHAR(50) DEFAULT 'any', -- 'remote', 'onsite', 'hybrid', 'any'
    agent_active BOOLEAN DEFAULT false,
    applications_today INTEGER DEFAULT 0,
    last_application_date DATE,
    has_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employers
CREATE TABLE employers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_description TEXT,
    industry VARCHAR(255),
    company_size VARCHAR(50), -- 'startup', 'small', 'medium', 'large', 'enterprise'
    website VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Postings
CREATE TABLE job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    required_skills TEXT[] DEFAULT '{}',
    nice_to_have_skills TEXT[] DEFAULT '{}',
    location VARCHAR(255),
    remote_type VARCHAR(50) DEFAULT 'onsite', -- 'remote', 'onsite', 'hybrid'
    salary_min INTEGER,
    salary_max INTEGER,
    experience_min INTEGER DEFAULT 0,
    experience_max INTEGER,
    status job_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications (agent-submitted)
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_seeker_id UUID NOT NULL REFERENCES job_seekers(id) ON DELETE CASCADE,
    job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    status application_status DEFAULT 'pending',
    match_score DECIMAL(5,2), -- 0-100 score
    cover_message TEXT, -- Agent-generated application message
    employer_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(job_seeker_id, job_posting_id)
);

-- Conversations (between agent and employer)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type message_sender_type NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ratings (employer rates agent performance)
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_seeker_id UUID NOT NULL REFERENCES job_seekers(id) ON DELETE CASCADE,
    employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
    application_id UUID UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_job_seekers_user_id ON job_seekers(user_id);
CREATE INDEX idx_job_seekers_agent_active ON job_seekers(agent_active) WHERE agent_active = true;
CREATE INDEX idx_employers_user_id ON employers(user_id);
CREATE INDEX idx_job_postings_employer_id ON job_postings(employer_id);
CREATE INDEX idx_job_postings_status ON job_postings(status) WHERE status = 'active';
CREATE INDEX idx_job_postings_skills ON job_postings USING GIN(required_skills);
CREATE INDEX idx_applications_job_seeker ON applications(job_seeker_id);
CREATE INDEX idx_applications_job_posting ON applications(job_posting_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_ratings_job_seeker ON ratings(job_seeker_id);

-- Function to reset daily application counts (run via cron)
CREATE OR REPLACE FUNCTION reset_daily_applications()
RETURNS void AS $$
BEGIN
    UPDATE job_seekers
    SET applications_today = 0
    WHERE last_application_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
