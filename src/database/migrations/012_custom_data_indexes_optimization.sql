/**
 * Additional indexes for custom data query optimization
 * Week 3: Data Storage + Querying
 */

-- Drop existing GIN indexes if they need to be recreated with specific operators
-- (Most are already created in migration 011, but adding specific operator classes for optimization)

-- Create partial indexes for active sync-enabled sources
CREATE INDEX IF NOT EXISTS idx_custom_data_sources_sync_active
ON custom_data_sources(next_sync_at)
WHERE sync_enabled = true AND sync_status != 'syncing';

-- Create index on workspace and source type for faster filtering
CREATE INDEX IF NOT EXISTS idx_custom_data_sources_workspace_type
ON custom_data_sources(workspace_id, source_type);

-- Create composite index for common date range queries with source
CREATE INDEX IF NOT EXISTS idx_custom_data_records_source_date_composite
ON custom_data_records(source_id, record_date DESC, id);

-- Create expression index for common metric calculations
-- This helps with SUM/AVG queries on specific metrics
CREATE INDEX IF NOT EXISTS idx_custom_data_records_metrics_jsonb_path
ON custom_data_records USING gin(metrics jsonb_path_ops);

-- Create expression index for dimension filtering
CREATE INDEX IF NOT EXISTS idx_custom_data_records_dimensions_jsonb_path
ON custom_data_records USING gin(dimensions jsonb_path_ops);

-- Create index for hash_key lookups (deduplication)
CREATE INDEX IF NOT EXISTS idx_custom_data_records_hash_key
ON custom_data_records(source_id, hash_key);

-- Create index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_custom_data_records_timestamp
ON custom_data_records(source_id, record_timestamp DESC)
WHERE record_timestamp IS NOT NULL;

-- Create index for metric_keys array for faster filtering
CREATE INDEX IF NOT EXISTS idx_custom_data_records_metric_keys
ON custom_data_records USING gin(metric_keys);

-- Create index for sync job lookups by status
CREATE INDEX IF NOT EXISTS idx_custom_data_sync_jobs_source_status
ON custom_data_sync_jobs(source_id, status, created_at DESC);

-- Analyze tables to update statistics
ANALYZE custom_data_sources;
ANALYZE custom_data_records;
ANALYZE custom_data_sync_jobs;

-- Add comments for documentation
COMMENT ON INDEX idx_custom_data_sources_sync_active IS
  'Optimizes queries for finding sources due for sync';

COMMENT ON INDEX idx_custom_data_sources_workspace_type IS
  'Optimizes filtering sources by workspace and type';

COMMENT ON INDEX idx_custom_data_records_source_date_composite IS
  'Optimizes time-series queries with date DESC for dashboard widgets';

COMMENT ON INDEX idx_custom_data_records_metrics_jsonb_path IS
  'Optimizes JSONB containment queries on metrics (@> operator)';

COMMENT ON INDEX idx_custom_data_records_dimensions_jsonb_path IS
  'Optimizes JSONB containment queries on dimensions (@> operator)';

COMMENT ON INDEX idx_custom_data_records_hash_key IS
  'Optimizes deduplication lookups during sync';

COMMENT ON INDEX idx_custom_data_records_timestamp IS
  'Optimizes timestamp-based queries when available';

COMMENT ON INDEX idx_custom_data_records_metric_keys IS
  'Optimizes filtering by available metrics';

COMMENT ON INDEX idx_custom_data_sync_jobs_source_status IS
  'Optimizes sync job history queries';

-- Create materialized view for common aggregations (optional, for future use)
-- This can significantly speed up dashboard queries for large datasets
CREATE MATERIALIZED VIEW IF NOT EXISTS custom_data_daily_aggregates AS
SELECT
  source_id,
  record_date,
  dimensions,
  jsonb_object_agg(
    metric_key,
    (metrics->>metric_key)::numeric
  ) FILTER (WHERE metric_key IS NOT NULL) as daily_metrics,
  COUNT(*) as record_count,
  MIN(record_timestamp) as first_timestamp,
  MAX(record_timestamp) as last_timestamp
FROM custom_data_records,
LATERAL unnest(metric_keys) as metric_key
GROUP BY source_id, record_date, dimensions;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_custom_data_daily_agg_source_date
ON custom_data_daily_aggregates(source_id, record_date DESC);

CREATE INDEX IF NOT EXISTS idx_custom_data_daily_agg_dimensions
ON custom_data_daily_aggregates USING gin(dimensions jsonb_path_ops);

-- Add comment on materialized view
COMMENT ON MATERIALIZED VIEW custom_data_daily_aggregates IS
  'Pre-aggregated daily metrics for faster dashboard queries. Refresh periodically.';

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_custom_data_daily_aggregates()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY custom_data_daily_aggregates;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_custom_data_daily_aggregates() IS
  'Refreshes the daily aggregates materialized view. Should be called periodically (e.g., hourly).';

-- Grant necessary permissions (adjust based on your user setup)
-- GRANT SELECT ON custom_data_daily_aggregates TO your_app_user;
