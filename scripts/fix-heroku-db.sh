#!/bin/bash

# Fix Heroku Database Migration Issue
# This script fixes the platform constraint violation

set -e

echo "🔧 Fixing Heroku Database Migration Issue"
echo "=========================================="
echo ""

# Check if app name is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your Heroku app name"
    echo "Usage: ./scripts/fix-heroku-db.sh your-app-name"
    exit 1
fi

APP_NAME=$1

echo "📱 App: $APP_NAME"
echo ""

# Connect to database and run fix
echo "🔧 Fixing platform constraints..."
heroku pg:psql -a $APP_NAME << 'EOF'

-- Update existing data to match new platform values
UPDATE oauth_tokens SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE oauth_tokens SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE oauth_tokens SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

UPDATE ad_accounts SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE ad_accounts SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE ad_accounts SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

-- Drop old constraints
ALTER TABLE oauth_tokens DROP CONSTRAINT IF EXISTS oauth_tokens_platform_check;
ALTER TABLE ad_accounts DROP CONSTRAINT IF EXISTS ad_accounts_platform_check;

-- Add new constraints
ALTER TABLE oauth_tokens
ADD CONSTRAINT oauth_tokens_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console', 'google_sheets'));

ALTER TABLE ad_accounts
ADD CONSTRAINT ad_accounts_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console'));

-- Mark migration as applied
INSERT INTO schema_migrations (migration_name)
VALUES ('003_additional_platforms.sql')
ON CONFLICT (migration_name) DO NOTHING;

SELECT 'Fixed!' as status;

EOF

echo ""
echo "✅ Database constraints fixed!"
echo ""
echo "🚀 Now redeploy your app:"
echo "   git add ."
echo "   git commit -m 'fix: Update migration for platform constraints'"
echo "   git push heroku main"
echo ""
