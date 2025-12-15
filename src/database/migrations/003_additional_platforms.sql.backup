-- Additional Platforms - Migration 003
-- Description: Add support for Google Ads, TikTok Ads, and LinkedIn Ads

-- Update platform constraint for oauth_tokens
ALTER TABLE oauth_tokens
DROP CONSTRAINT IF EXISTS oauth_tokens_platform_check;

ALTER TABLE oauth_tokens
ADD CONSTRAINT oauth_tokens_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));

-- Update platform constraint for ad_accounts
ALTER TABLE ad_accounts
DROP CONSTRAINT IF EXISTS ad_accounts_platform_check;

ALTER TABLE ad_accounts
ADD CONSTRAINT ad_accounts_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));

-- Update platform constraint for campaigns
ALTER TABLE campaigns
DROP CONSTRAINT IF EXISTS campaigns_platform_check;

ALTER TABLE campaigns
ADD CONSTRAINT campaigns_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));

-- Update platform constraint for ad_sets
ALTER TABLE ad_sets
DROP CONSTRAINT IF EXISTS ad_sets_platform_check;

ALTER TABLE ad_sets
ADD CONSTRAINT ad_sets_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));

-- Update platform constraint for ads
ALTER TABLE ads
DROP CONSTRAINT IF EXISTS ads_platform_check;

ALTER TABLE ads
ADD CONSTRAINT ads_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));

-- Update platform constraint for ad_metrics
ALTER TABLE ad_metrics
DROP CONSTRAINT IF EXISTS ad_metrics_platform_check;

ALTER TABLE ad_metrics
ADD CONSTRAINT ad_metrics_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin'));
