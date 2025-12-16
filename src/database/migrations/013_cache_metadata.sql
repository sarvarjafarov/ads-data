-- Migration: Cache Metadata Table
-- Description: Track cache performance and metadata for Redis caching layer
-- Version: 013
-- Created: 2025-12-15

BEGIN;

-- Create cache_metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS cache_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key VARCHAR(512) NOT NULL UNIQUE,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Add missing columns if they don't exist (for existing tables from migration 009)
DO $$
BEGIN
  -- Add cache_size_bytes if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_metadata' AND column_name = 'cache_size_bytes'
  ) THEN
    ALTER TABLE cache_metadata ADD COLUMN cache_size_bytes INTEGER;
  END IF;

  -- Add data_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_metadata' AND column_name = 'data_type'
  ) THEN
    ALTER TABLE cache_metadata ADD COLUMN data_type VARCHAR(50);
  END IF;

  -- Add related_source_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_metadata' AND column_name = 'related_source_id'
  ) THEN
    ALTER TABLE cache_metadata ADD COLUMN related_source_id UUID;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_cache_related_source' AND table_name = 'cache_metadata'
  ) THEN
    ALTER TABLE cache_metadata
    ADD CONSTRAINT fk_cache_related_source
    FOREIGN KEY (related_source_id) REFERENCES custom_data_sources(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If custom_data_sources doesn't exist yet, skip the constraint
    RAISE NOTICE 'Could not add foreign key constraint: %', SQLERRM;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cache_metadata_key ON cache_metadata(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_expires ON cache_metadata(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cache_metadata_accessed ON cache_metadata(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_source ON cache_metadata(related_source_id) WHERE related_source_id IS NOT NULL;

-- Function to clean up expired cache metadata
CREATE OR REPLACE FUNCTION cleanup_expired_cache_metadata()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cache_metadata
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_statistics()
RETURNS TABLE (
  data_type VARCHAR,
  total_entries BIGINT,
  total_hits BIGINT,
  avg_hit_count NUMERIC,
  hit_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.data_type,
    COUNT(*)::BIGINT as total_entries,
    SUM(cm.hit_count)::BIGINT as total_hits,
    AVG(cm.hit_count)::NUMERIC as avg_hit_count,
    CASE
      WHEN SUM(cm.hit_count) > 0 THEN
        (SUM(cm.hit_count)::NUMERIC / COUNT(*)::NUMERIC) * 100
      ELSE 0
    END as hit_rate
  FROM cache_metadata cm
  WHERE cm.expires_at IS NULL OR cm.expires_at > NOW()
  GROUP BY cm.data_type
  ORDER BY total_hits DESC;
END;
$$ LANGUAGE plpgsql;

COMMIT;
