-- Add search_console platform support

-- Update platform constraint for oauth_tokens
ALTER TABLE oauth_tokens
DROP CONSTRAINT IF EXISTS oauth_tokens_platform_check;

ALTER TABLE oauth_tokens
ADD CONSTRAINT oauth_tokens_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console'));

-- Update platform constraint for ad_accounts
ALTER TABLE ad_accounts
DROP CONSTRAINT IF EXISTS ad_accounts_platform_check;

ALTER TABLE ad_accounts
ADD CONSTRAINT ad_accounts_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console'));

-- Update platform constraint for campaigns
ALTER TABLE campaigns
DROP CONSTRAINT IF EXISTS campaigns_platform_check;

ALTER TABLE campaigns
ADD CONSTRAINT campaigns_platform_check
CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'search_console'));
