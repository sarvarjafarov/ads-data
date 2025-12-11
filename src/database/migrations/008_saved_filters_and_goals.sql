-- Migration: Saved Filters, Views, and Goal Tracking
-- Created: 2024-11-20

-- Saved Filters and Views
CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  filter_type VARCHAR(50) NOT NULL, -- 'campaign', 'dashboard', 'report', 'global'
  filter_config JSONB NOT NULL, -- Stores the actual filter configuration
  is_default BOOLEAN DEFAULT false, -- User's default view for this type
  is_shared BOOLEAN DEFAULT false, -- Shared with workspace members
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_saved_filters_workspace ON saved_filters(workspace_id);
CREATE INDEX idx_saved_filters_user ON saved_filters(user_id);
CREATE INDEX idx_saved_filters_type ON saved_filters(filter_type);
CREATE INDEX idx_saved_filters_shared ON saved_filters(is_shared) WHERE is_shared = true;

-- Goal Tracking
CREATE TABLE IF NOT EXISTS campaign_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id VARCHAR(255), -- Can be NULL for workspace-level goals
  goal_name VARCHAR(255) NOT NULL,
  goal_type VARCHAR(50) NOT NULL, -- 'cpa', 'roas', 'conversions', 'clicks', 'impressions', 'spend'
  target_value DECIMAL(15, 2) NOT NULL,
  current_value DECIMAL(15, 2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'failed', 'paused'
  alert_threshold DECIMAL(5, 2) DEFAULT 80, -- Alert when % of goal is reached
  platform VARCHAR(50), -- 'google_ads', 'facebook_ads', 'linkedin_ads', etc.
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_campaign_goals_workspace ON campaign_goals(workspace_id);
CREATE INDEX idx_campaign_goals_campaign ON campaign_goals(campaign_id);
CREATE INDEX idx_campaign_goals_status ON campaign_goals(status);
CREATE INDEX idx_campaign_goals_dates ON campaign_goals(start_date, end_date);

-- Goal Progress History
CREATE TABLE IF NOT EXISTS goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES campaign_goals(id) ON DELETE CASCADE,
  recorded_value DECIMAL(15, 2) NOT NULL,
  progress_percentage DECIMAL(5, 2) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_goal_progress_goal ON goal_progress_history(goal_id);
CREATE INDEX idx_goal_progress_date ON goal_progress_history(recorded_at);

-- Chart Annotations
CREATE TABLE IF NOT EXISTS chart_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  campaign_id VARCHAR(255), -- Optional: specific to a campaign
  annotation_date DATE NOT NULL,
  annotation_time TIME,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  annotation_type VARCHAR(50) DEFAULT 'note', -- 'note', 'event', 'milestone', 'alert'
  color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for the annotation marker
  is_visible BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chart_annotations_workspace ON chart_annotations(workspace_id);
CREATE INDEX idx_chart_annotations_dashboard ON chart_annotations(dashboard_id);
CREATE INDEX idx_chart_annotations_campaign ON chart_annotations(campaign_id);
CREATE INDEX idx_chart_annotations_date ON chart_annotations(annotation_date);

-- Comments and Collaboration
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'dashboard', 'campaign', 'report', 'annotation'
  entity_id VARCHAR(255) NOT NULL, -- ID of the entity being commented on
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For threaded replies
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  mentions JSONB DEFAULT '[]', -- Array of user IDs mentioned in the comment
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_workspace ON comments(workspace_id);
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);

-- Custom Alert Rules (Advanced Alert Builder)
CREATE TABLE IF NOT EXISTS custom_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  conditions JSONB NOT NULL, -- Complex conditions with AND/OR logic
  alert_channels JSONB NOT NULL, -- email, slack, webhook, in-app
  frequency VARCHAR(50) DEFAULT 'immediate', -- 'immediate', 'hourly', 'daily'
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_custom_alert_rules_workspace ON custom_alert_rules(workspace_id);
CREATE INDEX idx_custom_alert_rules_active ON custom_alert_rules(is_active) WHERE is_active = true;

-- Data Export History
CREATE TABLE IF NOT EXISTS export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  export_type VARCHAR(50) NOT NULL, -- 'csv', 'excel', 'pdf'
  entity_type VARCHAR(50) NOT NULL, -- 'campaign', 'dashboard', 'report'
  entity_id VARCHAR(255),
  filters JSONB, -- Applied filters during export
  file_size INTEGER, -- in bytes
  file_path TEXT, -- S3 or local path
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_export_history_workspace ON export_history(workspace_id);
CREATE INDEX idx_export_history_user ON export_history(user_id);
CREATE INDEX idx_export_history_status ON export_history(status);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saved_filters_updated_at BEFORE UPDATE ON saved_filters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_goals_updated_at BEFORE UPDATE ON campaign_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chart_annotations_updated_at BEFORE UPDATE ON chart_annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_alert_rules_updated_at BEFORE UPDATE ON custom_alert_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE saved_filters TO ads_data_user;
GRANT ALL PRIVILEGES ON TABLE campaign_goals TO ads_data_user;
GRANT ALL PRIVILEGES ON TABLE goal_progress_history TO ads_data_user;
GRANT ALL PRIVILEGES ON TABLE chart_annotations TO ads_data_user;
GRANT ALL PRIVILEGES ON TABLE comments TO ads_data_user;
GRANT ALL PRIVILEGES ON TABLE custom_alert_rules TO ads_data_user;
GRANT ALL PRIVILEGES ON TABLE export_history TO ads_data_user;
