-- Anomaly Detection - Migration 006
-- Description: Add anomaly detection and notification system

-- Table for storing detected anomalies
CREATE TABLE IF NOT EXISTS anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_set_id UUID REFERENCES ad_sets(id) ON DELETE CASCADE,
  detection_date DATE NOT NULL,
  metric VARCHAR(50) NOT NULL,
  current_value DECIMAL(15, 4) NOT NULL,
  baseline_value DECIMAL(15, 4) NOT NULL,
  deviation_percent DECIMAL(10, 2) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  anomaly_type VARCHAR(50) NOT NULL CHECK (anomaly_type IN ('spike', 'drop', 'unusual_pattern')),
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'investigating', 'resolved', 'false_positive')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_anomalies_account ON anomalies(ad_account_id);
CREATE INDEX idx_anomalies_campaign ON anomalies(campaign_id);
CREATE INDEX idx_anomalies_date ON anomalies(detection_date DESC);
CREATE INDEX idx_anomalies_status ON anomalies(status);
CREATE INDEX idx_anomalies_severity ON anomalies(severity);

-- Table for user notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('anomaly', 'budget_alert', 'system', 'campaign_status')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- Table for notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  email_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  threshold_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id, notification_type)
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX idx_notification_prefs_workspace ON notification_preferences(workspace_id);

-- Table for anomaly detection configuration
CREATE TABLE IF NOT EXISTS anomaly_detection_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  metric VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  sensitivity VARCHAR(20) DEFAULT 'medium' CHECK (sensitivity IN ('low', 'medium', 'high')),
  threshold_percent DECIMAL(5, 2) DEFAULT 20.00,
  baseline_period_days INT DEFAULT 14,
  min_data_points INT DEFAULT 7,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ad_account_id, metric)
);

CREATE INDEX idx_anomaly_config_account ON anomaly_detection_config(ad_account_id);

-- Trigger for anomalies updated_at
CREATE TRIGGER update_anomalies_updated_at BEFORE UPDATE ON anomalies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anomaly_config_updated_at BEFORE UPDATE ON anomaly_detection_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE anomalies IS 'Stores detected anomalies in advertising metrics';
COMMENT ON TABLE notifications IS 'User notifications for various events (anomalies, budget alerts, etc.)';
COMMENT ON TABLE notification_preferences IS 'User preferences for notification delivery';
COMMENT ON TABLE anomaly_detection_config IS 'Per-account configuration for anomaly detection';

COMMENT ON COLUMN anomalies.deviation_percent IS 'Percentage deviation from baseline (can be positive or negative)';
COMMENT ON COLUMN anomalies.severity IS 'Severity level based on deviation magnitude and business impact';
COMMENT ON COLUMN anomalies.anomaly_type IS 'Type of anomaly: spike (increase), drop (decrease), or unusual_pattern';
COMMENT ON COLUMN anomaly_detection_config.sensitivity IS 'Detection sensitivity: low (fewer alerts), medium (balanced), high (more alerts)';
COMMENT ON COLUMN anomaly_detection_config.threshold_percent IS 'Minimum deviation percentage to trigger anomaly detection';
