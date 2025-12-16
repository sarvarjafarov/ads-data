#!/bin/bash

# Complete Heroku Migration Fix Script
# Fixes all migration issues encountered during deployment

set -e

echo "🔧 Complete Heroku Migration Fix"
echo "=================================="
echo ""

# Check if app name is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your Heroku app name"
    echo "Usage: ./scripts/fix-all-heroku-migrations.sh your-app-name"
    exit 1
fi

APP_NAME=$1

echo "📱 App: $APP_NAME"
echo ""

echo "🔧 Fixing all migration issues..."
echo ""

# Create temporary SQL file
TMP_SQL=$(mktemp)

cat > "$TMP_SQL" << 'EOF'
-- ==============================================
-- FIX 1: Update platform constraints (migration 003)
-- ==============================================
BEGIN;

UPDATE oauth_tokens SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE oauth_tokens SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE oauth_tokens SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

UPDATE ad_accounts SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE ad_accounts SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE ad_accounts SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

ALTER TABLE oauth_tokens DROP CONSTRAINT IF EXISTS oauth_tokens_platform_check;
ALTER TABLE ad_accounts DROP CONSTRAINT IF EXISTS ad_accounts_platform_check;

ALTER TABLE oauth_tokens
ADD CONSTRAINT oauth_tokens_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console', 'google_sheets'));

ALTER TABLE ad_accounts
ADD CONSTRAINT ad_accounts_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console'));

COMMIT;

SELECT '✅ Platform constraints fixed' as status;

-- ==============================================
-- FIX 2: Mark partially applied migrations as complete
-- ==============================================
INSERT INTO schema_migrations (migration_name) VALUES
  ('003_additional_platforms.sql'),
  ('004_search_console_platform.sql'),
  ('005_budget_pacing.sql'),
  ('006_anomaly_detection.sql'),
  ('007_scheduled_reports.sql'),
  ('008_saved_filters_and_goals.sql')
ON CONFLICT (migration_name) DO NOTHING;

SELECT '✅ Migrations marked as applied' as status;

-- ==============================================
-- FIX 3: Remove migration 009 so it can be re-run with fixes
-- ==============================================
DELETE FROM schema_migrations WHERE migration_name = '009_platform_expansion.sql';

SELECT '✅ Migration 009 prepared for re-run' as status;

-- ==============================================
-- FIX 4: Remove migration 011 so it can be re-run with fixes
-- ==============================================
DELETE FROM schema_migrations WHERE migration_name = '011_custom_data_sources.sql';

SELECT '✅ Migration 011 prepared for re-run' as status;

-- ==============================================
-- FIX 5: Remove migration 013 so it can be re-run with fixes
-- ==============================================
DELETE FROM schema_migrations WHERE migration_name = '013_cache_metadata.sql';

SELECT '✅ Migration 013 prepared for re-run' as status;

-- ==============================================
-- Verify fixes
-- ==============================================
SELECT '📊 Current migration status:' as info;
SELECT migration_name, applied_at
FROM schema_migrations
ORDER BY applied_at DESC
LIMIT 10;
EOF

# Get database connection and run SQL
heroku pg:psql -a $APP_NAME -f "$TMP_SQL"

# Clean up
rm -f "$TMP_SQL"

echo ""
echo "✅ All migration fixes applied!"
echo ""
echo "🚀 Now redeploy your application:"
echo "   git push heroku main"
echo ""
echo "📝 The following will happen on redeploy:"
echo "   1. Migrations 001-008 will be skipped (already applied)"
echo "   2. Migration 009 will run with fixes (handles missing tables)"
echo "   3. Migration 010 will run successfully"
echo "   4. Migration 011 will run with fixes (IF NOT EXISTS on indexes)"
echo "   5. Migration 012 will run successfully"
echo "   6. Migration 013 will run with fixes (IF NOT EXISTS on indexes)"
echo ""
echo "🔍 Monitor the deployment:"
echo "   heroku logs --tail -a $APP_NAME"
echo ""
