-- Migration 003: Add skill weights and match thresholds to job postings
-- Enables per-skill weighting and automatic rejection of low-match applications

BEGIN;

ALTER TABLE job_postings
  ADD COLUMN skill_weights JSONB DEFAULT NULL,
  ADD COLUMN min_match_score INTEGER DEFAULT NULL
    CHECK (min_match_score IS NULL OR (min_match_score >= 0 AND min_match_score <= 100));

COMMIT;
