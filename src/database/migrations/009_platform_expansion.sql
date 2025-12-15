/**
 * Migration 009: Platform Expansion & Technical Enhancements
 * Adds support for TikTok, LinkedIn, and cross-platform features
 */

-- Platform credentials table (extensible for multiple platforms)
CREATE TABLE IF NOT EXISTS platform_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, platform)
);

-- TikTok campaigns
CREATE TABLE IF NOT EXISTS tiktok_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id VARCHAR(255) NOT NULL,
  campaign_name VARCHAR(500),
  status VARCHAR(50),
  objective VARCHAR(100),
  budget DECIMAL(15, 2),
  spend DECIMAL(15, 2),
  impressions BIGINT,
  clicks BIGINT,
  conversions INTEGER,
  ctr DECIMAL(10, 4),
  cpc DECIMAL(10, 4),
  cpm DECIMAL(10, 4),
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, campaign_id, date)
);

-- LinkedIn campaigns
CREATE TABLE IF NOT EXISTS linkedin_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id VARCHAR(255) NOT NULL,
  campaign_name VARCHAR(500),
  status VARCHAR(50),
  objective VARCHAR(100),
  budget DECIMAL(15, 2),
  spend DECIMAL(15, 2),
  impressions BIGINT,
  clicks BIGINT,
  conversions INTEGER,
  leads INTEGER,
  ctr DECIMAL(10, 4),
  cpc DECIMAL(10, 4),
  cpm DECIMAL(10, 4),
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, campaign_id, date)
);

-- Unified cross-platform campaigns view (for easier reporting)
CREATE TABLE IF NOT EXISTS unified_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  platform_campaign_id VARCHAR(255) NOT NULL,
  campaign_name VARCHAR(500),
  status VARCHAR(50),
  objective VARCHAR(100),
  budget DECIMAL(15, 2),
  spend DECIMAL(15, 2),
  impressions BIGINT,
  clicks BIGINT,
  conversions INTEGER,
  revenue DECIMAL(15, 2),
  ctr DECIMAL(10, 4),
  cpc DECIMAL(10, 4),
  cpm DECIMAL(10, 4),
  roas DECIMAL(10, 4),
  date DATE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, platform, platform_campaign_id, date)
);

-- API rate limiting tracking
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  window_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error logging table
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  request_url VARCHAR(500),
  request_method VARCHAR(10),
  request_body JSONB,
  status_code INTEGER,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System health metrics
CREATE TABLE IF NOT EXISTS system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15, 4),
  metric_unit VARCHAR(50),
  status VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache metadata (for Redis cache management)
CREATE TABLE IF NOT EXISTS cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(500) NOT NULL UNIQUE,
  cache_type VARCHAR(100),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform sync history
CREATE TABLE IF NOT EXISTS platform_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_credentials_workspace ON platform_credentials(workspace_id, platform);
CREATE INDEX IF NOT EXISTS idx_tiktok_campaigns_workspace_date ON tiktok_campaigns(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tiktok_campaigns_campaign_id ON tiktok_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_workspace_date ON linkedin_campaigns(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_campaign_id ON linkedin_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_unified_campaigns_workspace_platform ON unified_campaigns(workspace_id, platform, date DESC);
CREATE INDEX IF NOT EXISTS idx_unified_campaigns_date ON unified_campaigns(date DESC);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_user ON api_rate_limits(user_id, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_workspace ON api_rate_limits(workspace_id, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_system_health_created ON system_health_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_key ON cache_metadata(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_expires ON cache_metadata(expires_at);
CREATE INDEX IF NOT EXISTS idx_platform_sync_history_workspace ON platform_sync_history(workspace_id, platform, started_at DESC);

-- Add performance indexes to existing tables (only if tables exist)
DO $$
BEGIN
  -- Index for google_ads_metrics (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'google_ads_metrics') THEN
    CREATE INDEX IF NOT EXISTS idx_google_ads_metrics_workspace_date ON google_ads_metrics(workspace_id, date DESC);
  END IF;

  -- Index for facebook_ads_metrics (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'facebook_ads_metrics') THEN
    CREATE INDEX IF NOT EXISTS idx_facebook_ads_metrics_workspace_date ON facebook_ads_metrics(workspace_id, date DESC);
  END IF;

  -- Index for saved_filters (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'saved_filters') THEN
    CREATE INDEX IF NOT EXISTS idx_saved_filters_workspace_type ON saved_filters(workspace_id, filter_type);
  END IF;

  -- Index for campaign_goals (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'campaign_goals') THEN
    CREATE INDEX IF NOT EXISTS idx_campaign_goals_workspace_status ON campaign_goals(workspace_id, status);
  END IF;

  -- Index for comments (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'comments') THEN
    CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
  END IF;

  -- Index for custom_alert_rules (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'custom_alert_rules') THEN
    CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_workspace_active ON custom_alert_rules(workspace_id, is_active);
  END IF;
END $$;

-- Grant permissions (only if ads_data_user exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ads_data_user') THEN
    GRANT ALL PRIVILEGES ON TABLE platform_credentials TO ads_data_user;
    GRANT ALL PRIVILEGES ON TABLE tiktok_campaigns TO ads_data_user;
    GRANT ALL PRIVILEGES ON TABLE linkedin_campaigns TO ads_data_user;
    GRANT ALL PRIVILEGES ON TABLE unified_campaigns TO ads_data_user;
    GRANT ALL PRIVILEGES ON TABLE api_rate_limits TO ads_data_user;
    GRANT ALL PRIVILEGES ON TABLE error_logs TO ads_data_user;
    GRANT ALL PRIVILEGES ON TABLE system_health_metrics TO ads_data_user;
    GRANT ALL PRIVILEGES ON TABLE cache_metadata TO ads_data_user;
    GRANT ALL PRIVILEGES ON TABLE platform_sync_history TO ads_data_user;
  END IF;
END $$;
