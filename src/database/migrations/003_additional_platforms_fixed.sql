-- Additional Platforms - Migration 003 (Fixed)
-- Description: Add support for Google Ads, TikTok Ads, and LinkedIn Ads
-- Handles existing data migration

BEGIN;

-- Step 1: Update existing data to match new platform values
-- Map old values to new values if they exist
UPDATE oauth_tokens SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE oauth_tokens SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE oauth_tokens SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

UPDATE ad_accounts SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE ad_accounts SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE ad_accounts SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

UPDATE campaigns SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE campaigns SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE campaigns SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

UPDATE ad_sets SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE ad_sets SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE ad_sets SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

UPDATE ads SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE ads SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE ads SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

UPDATE ad_metrics SET platform = 'google' WHERE platform IN ('google_ads', 'google-ads', 'googleads');
UPDATE ad_metrics SET platform = 'tiktok' WHERE platform IN ('tiktok_ads', 'tiktok-ads', 'tiktokads');
UPDATE ad_metrics SET platform = 'linkedin' WHERE platform IN ('linkedin_ads', 'linkedin-ads', 'linkedinads');

-- Step 2: Drop old constraints (if they exist)
ALTER TABLE oauth_tokens DROP CONSTRAINT IF EXISTS oauth_tokens_platform_check;
ALTER TABLE ad_accounts DROP CONSTRAINT IF EXISTS ad_accounts_platform_check;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_platform_check;
ALTER TABLE ad_sets DROP CONSTRAINT IF EXISTS ad_sets_platform_check;
ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_platform_check;
ALTER TABLE ad_metrics DROP CONSTRAINT IF EXISTS ad_metrics_platform_check;

-- Step 3: Add new constraints with updated platform values
ALTER TABLE oauth_tokens
ADD CONSTRAINT oauth_tokens_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console', 'google_sheets'));

ALTER TABLE ad_accounts
ADD CONSTRAINT ad_accounts_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console'));

ALTER TABLE campaigns
ADD CONSTRAINT campaigns_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));

ALTER TABLE ad_sets
ADD CONSTRAINT ad_sets_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));

ALTER TABLE ads
ADD CONSTRAINT ads_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));

ALTER TABLE ad_metrics
ADD CONSTRAINT ad_metrics_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));

COMMIT;
