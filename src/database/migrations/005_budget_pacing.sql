-- Budget Pacing - Migration 005
-- Description: Add budget tracking and pacing features

-- Add budget columns to ad_accounts table
ALTER TABLE ad_accounts
ADD COLUMN IF NOT EXISTS monthly_budget DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS budget_start_date DATE,
ADD COLUMN IF NOT EXISTS budget_alert_thresholds JSONB DEFAULT '[80, 90, 100]',
ADD COLUMN IF NOT EXISTS budget_alert_enabled BOOLEAN DEFAULT TRUE;

-- Create table for budget alerts history
CREATE TABLE IF NOT EXISTS budget_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  alert_date DATE NOT NULL,
  budget_period VARCHAR(50) NOT NULL, -- 'monthly', 'daily', etc.
  spend_amount DECIMAL(15, 2) NOT NULL,
  budget_amount DECIMAL(15, 2) NOT NULL,
  spend_percentage DECIMAL(5, 2) NOT NULL,
  threshold_percentage INT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('warning', 'critical', 'exceeded')),
  message TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budget_alerts_account ON budget_alerts(ad_account_id);
CREATE INDEX idx_budget_alerts_date ON budget_alerts(alert_date DESC);
CREATE INDEX idx_budget_alerts_status ON budget_alerts(status);

-- Table for tracking daily spend (for projections)
CREATE TABLE IF NOT EXISTS daily_spend_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  daily_spend DECIMAL(15, 2) NOT NULL,
  cumulative_spend DECIMAL(15, 2) NOT NULL,
  projected_monthly_spend DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ad_account_id, snapshot_date)
);

CREATE INDEX idx_daily_spend_account_date ON daily_spend_snapshots(ad_account_id, snapshot_date DESC);

-- Add comments for documentation
COMMENT ON COLUMN ad_accounts.monthly_budget IS 'Monthly budget amount for this account';
COMMENT ON COLUMN ad_accounts.budget_start_date IS 'Start date for budget tracking period';
COMMENT ON COLUMN ad_accounts.budget_alert_thresholds IS 'Array of percentage thresholds for alerts (e.g., [80, 90, 100])';
COMMENT ON COLUMN ad_accounts.budget_alert_enabled IS 'Whether budget alerts are enabled for this account';

COMMENT ON TABLE budget_alerts IS 'History of budget alert triggers';
COMMENT ON TABLE daily_spend_snapshots IS 'Daily spend tracking for budget projections and pacing analysis';
