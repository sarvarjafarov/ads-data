-- Migration: Website Audit Logs
-- Description: Track audit request metadata for rate limiting and analytics
-- Version: 014
-- Created: 2025-12-16

BEGIN;

-- Create website_audit_logs table
CREATE TABLE IF NOT EXISTS website_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  website_url TEXT NOT NULL,
  audit_duration_ms INTEGER,
  platforms_analyzed JSONB DEFAULT '[]',
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  critical_issues_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_website_audit_logs_workspace ON website_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_website_audit_logs_created ON website_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_audit_logs_user ON website_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_website_audit_logs_url ON website_audit_logs(website_url);

-- Function to get recent audits for a workspace (for rate limiting)
CREATE OR REPLACE FUNCTION get_recent_audit_count(
  p_workspace_id UUID,
  p_hours INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  audit_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO audit_count
  FROM website_audit_logs
  WHERE workspace_id = p_workspace_id
    AND created_at > NOW() - (p_hours || ' hours')::INTERVAL;

  RETURN audit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit statistics for a workspace
CREATE OR REPLACE FUNCTION get_audit_statistics(p_workspace_id UUID)
RETURNS TABLE (
  total_audits BIGINT,
  avg_score NUMERIC,
  avg_duration_ms NUMERIC,
  platforms_analyzed JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_audits,
    AVG(overall_score)::NUMERIC as avg_score,
    AVG(audit_duration_ms)::NUMERIC as avg_duration_ms,
    jsonb_agg(DISTINCT platforms_analyzed) as platforms_analyzed
  FROM website_audit_logs
  WHERE workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit statistics for a workspace
-- Drop existing function if it has different signature
DROP FUNCTION IF EXISTS get_audit_statistics(UUID);

CREATE OR REPLACE FUNCTION get_audit_statistics(p_workspace_id UUID)
RETURNS TABLE (
  total_audits BIGINT,
  avg_score NUMERIC,
  avg_duration_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_audits,
    AVG(overall_score)::NUMERIC as avg_score,
    AVG(audit_duration_ms)::NUMERIC as avg_duration_ms
  FROM website_audit_logs
  WHERE workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old audit logs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM website_audit_logs
  WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
