-- Audit Jobs Table for Async Processing
-- Tracks long-running website audit jobs to avoid Heroku 30s timeout

CREATE TABLE IF NOT EXISTS audit_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  website_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  result JSONB, -- Stores the audit result when completed
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick job lookups
CREATE INDEX idx_audit_jobs_workspace_user ON audit_jobs(workspace_id, user_id);
CREATE INDEX idx_audit_jobs_status ON audit_jobs(status);
CREATE INDEX idx_audit_jobs_created_at ON audit_jobs(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_audit_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_jobs_updated_at
  BEFORE UPDATE ON audit_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_jobs_updated_at();

-- Function to clean up old audit jobs (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_jobs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_jobs
  WHERE created_at < NOW() - INTERVAL '7 days'
  RETURNING COUNT(*) INTO deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
