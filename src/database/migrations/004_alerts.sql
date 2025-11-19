-- Alerts & Notifications - Migration 004
-- Description: Add tables for threshold alerts system

-- =====================================================
-- ALERTS
-- =====================================================

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  ad_account_id UUID REFERENCES ad_accounts(id) ON DELETE SET NULL,
  metric VARCHAR(100) NOT NULL,
  condition VARCHAR(50) NOT NULL CHECK (condition IN ('above', 'below', 'equals', 'change_above', 'change_below')),
  threshold DECIMAL(15, 4) NOT NULL,
  comparison_period VARCHAR(50) DEFAULT 'previous_day',
  is_active BOOLEAN DEFAULT TRUE,
  notification_channels JSONB DEFAULT '["email"]',
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_workspace ON alerts(workspace_id);
CREATE INDEX idx_alerts_ad_account ON alerts(ad_account_id);
CREATE INDEX idx_alerts_active ON alerts(is_active);

-- Alert history
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metric_value DECIMAL(15, 4),
  threshold_value DECIMAL(15, 4),
  message TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP
);

CREATE INDEX idx_alert_history_alert ON alert_history(alert_id);
CREATE INDEX idx_alert_history_triggered ON alert_history(triggered_at DESC);

-- Triggers
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
