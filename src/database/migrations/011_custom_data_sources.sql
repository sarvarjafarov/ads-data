-- Migration 011: Custom Data Sources for Excel/Google Sheets Import
-- This migration creates tables for storing custom data imports and enabling AI-powered dashboard generation

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom Data Sources Table
-- Stores metadata for each imported data source (Excel, Google Sheets, CSV)
CREATE TABLE IF NOT EXISTS custom_data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),

  -- Source identification
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('excel', 'google_sheets', 'csv')),
  source_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Google Sheets specific fields
  google_sheet_id VARCHAR(255),
  google_sheet_url TEXT,
  oauth_token_id UUID REFERENCES oauth_tokens(id),
  sheet_range VARCHAR(100) DEFAULT 'Sheet1',

  -- Excel/CSV specific fields
  file_path TEXT,
  file_size BIGINT,
  original_filename VARCHAR(255),

  -- Schema and metadata (AI-detected)
  detected_schema JSONB NOT NULL DEFAULT '{}',
  column_mappings JSONB DEFAULT '{}',
  sample_data JSONB DEFAULT '[]',

  -- Sync configuration
  sync_enabled BOOLEAN DEFAULT false,
  sync_frequency VARCHAR(20) CHECK (sync_frequency IN ('hourly', 'daily', 'weekly', 'manual') OR sync_frequency IS NULL),
  last_synced_at TIMESTAMP,
  next_sync_at TIMESTAMP,
  sync_status VARCHAR(50) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  sync_error TEXT,

  -- Statistics
  row_count BIGINT DEFAULT 0,
  date_column VARCHAR(100),
  metric_columns TEXT[] DEFAULT '{}',
  dimension_columns TEXT[] DEFAULT '{}',

  -- AI insights
  ai_suggestions JSONB DEFAULT '{}',
  recommended_visualizations JSONB DEFAULT '[]',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_workspace_source_name UNIQUE(workspace_id, source_name)
);

-- Indexes for custom_data_sources
CREATE INDEX IF NOT EXISTS idx_custom_sources_workspace ON custom_data_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_sources_type ON custom_data_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_custom_sources_user ON custom_data_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_sources_sync ON custom_data_sources(sync_enabled, next_sync_at) WHERE sync_enabled = true;
CREATE INDEX IF NOT EXISTS idx_custom_sources_status ON custom_data_sources(sync_status);

-- Custom Data Records Table
-- Time-series optimized storage for imported data
CREATE TABLE IF NOT EXISTS custom_data_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES custom_data_sources(id) ON DELETE CASCADE,

  -- Time-series fields
  record_date DATE NOT NULL,
  record_timestamp TIMESTAMP,

  -- Flexible data storage using JSONB
  dimensions JSONB DEFAULT '{}',  -- Non-numeric fields (campaign_name, region, etc.)
  metrics JSONB NOT NULL,          -- Numeric fields (spend, clicks, revenue, etc.)
  raw_data JSONB,                  -- Complete row data for reference

  -- Helper fields for querying
  metric_keys TEXT[] DEFAULT '{}', -- Array of metric field names for fast filtering
  hash_key VARCHAR(64),            -- MD5 hash of dimensions for deduplication

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_source_date_dimensions UNIQUE(source_id, record_date, hash_key)
);

-- Indexes for custom_data_records (optimized for time-series queries)
CREATE INDEX IF NOT EXISTS idx_custom_records_source_date ON custom_data_records(source_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_custom_records_date ON custom_data_records(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_custom_records_metrics ON custom_data_records USING GIN(metrics);
CREATE INDEX IF NOT EXISTS idx_custom_records_dimensions ON custom_data_records USING GIN(dimensions);
CREATE INDEX IF NOT EXISTS idx_custom_records_metric_keys ON custom_data_records USING GIN(metric_keys);
CREATE INDEX IF NOT EXISTS idx_custom_records_hash ON custom_data_records(hash_key);

-- Custom Data Sync Jobs Table
-- Track sync operations for monitoring and debugging
CREATE TABLE IF NOT EXISTS custom_data_sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES custom_data_sources(id) ON DELETE CASCADE,

  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('initial_import', 'scheduled_sync', 'manual_refresh', 'ai_analysis')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Progress tracking
  total_rows INTEGER,
  processed_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  new_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,

  -- Results
  error_message TEXT,
  error_details JSONB,
  ai_analysis_result JSONB,

  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for custom_data_sync_jobs
CREATE INDEX IF NOT EXISTS idx_sync_jobs_source ON custom_data_sync_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON custom_data_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type ON custom_data_sync_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created ON custom_data_sync_jobs(created_at DESC);

-- Update oauth_tokens table to support google_sheets platform
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE oauth_tokens DROP CONSTRAINT IF EXISTS oauth_tokens_platform_check;

  -- Add new constraint with google_sheets
  ALTER TABLE oauth_tokens ADD CONSTRAINT oauth_tokens_platform_check
    CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console', 'google_sheets'));
EXCEPTION
  WHEN OTHERS THEN
    -- If table doesn't exist or other error, just continue
    RAISE NOTICE 'Could not update oauth_tokens constraint: %', SQLERRM;
END $$;

-- Trigger to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_custom_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_custom_data_sources_updated_at ON custom_data_sources;
CREATE TRIGGER update_custom_data_sources_updated_at
  BEFORE UPDATE ON custom_data_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_data_updated_at();

DROP TRIGGER IF EXISTS update_custom_data_records_updated_at ON custom_data_records;
CREATE TRIGGER update_custom_data_records_updated_at
  BEFORE UPDATE ON custom_data_records
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_data_updated_at();

-- Function to calculate hash key for deduplication
CREATE OR REPLACE FUNCTION calculate_hash_key(dimensions_json JSONB)
RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN MD5(dimensions_json::TEXT);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments for documentation
COMMENT ON TABLE custom_data_sources IS 'Stores metadata for custom data imports from Excel, Google Sheets, and CSV files';
COMMENT ON TABLE custom_data_records IS 'Time-series storage for imported data with flexible JSONB schema';
COMMENT ON TABLE custom_data_sync_jobs IS 'Tracks sync operations and their status for monitoring';

COMMENT ON COLUMN custom_data_sources.detected_schema IS 'AI-detected schema with column types, roles (metric/dimension), and aggregations';
COMMENT ON COLUMN custom_data_sources.column_mappings IS 'User overrides for column names and types';
COMMENT ON COLUMN custom_data_sources.sync_frequency IS 'How often to sync: hourly, daily, weekly, or manual';
COMMENT ON COLUMN custom_data_sources.ai_suggestions IS 'AI-generated insights about the data structure';
COMMENT ON COLUMN custom_data_sources.recommended_visualizations IS 'AI-recommended widget configurations';

COMMENT ON COLUMN custom_data_records.dimensions IS 'Non-numeric fields like campaign_name, region';
COMMENT ON COLUMN custom_data_records.metrics IS 'Numeric fields like spend, clicks, revenue';
COMMENT ON COLUMN custom_data_records.hash_key IS 'MD5 hash of dimensions for efficient deduplication';
COMMENT ON COLUMN custom_data_records.metric_keys IS 'Array of available metric names for fast filtering';
