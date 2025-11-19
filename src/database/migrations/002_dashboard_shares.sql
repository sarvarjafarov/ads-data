-- Dashboard Shares - Migration 002
-- Description: Add table for dashboard sharing tokens

-- =====================================================
-- DASHBOARD SHARES
-- =====================================================

CREATE TABLE dashboard_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  share_token VARCHAR(64) UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  password_hash VARCHAR(255),
  allow_export BOOLEAN DEFAULT TRUE,
  view_count INT DEFAULT 0,
  last_viewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dashboard_shares_dashboard ON dashboard_shares(dashboard_id);
CREATE INDEX idx_dashboard_shares_token ON dashboard_shares(share_token);
CREATE INDEX idx_dashboard_shares_active ON dashboard_shares(is_active);

CREATE TRIGGER update_dashboard_shares_updated_at BEFORE UPDATE ON dashboard_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
