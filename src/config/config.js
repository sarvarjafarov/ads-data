const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  // Meta Ads OAuth
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:3000/api/oauth/meta/callback',
    scopes: [
      'ads_read',
      'ads_management',
      'business_management',
      'read_insights',
    ].join(','),
  },

  // Google Ads OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google/callback',
    developerToken: process.env.GOOGLE_DEVELOPER_TOKEN,
  },

  // TikTok Ads OAuth
  tiktok: {
    appId: process.env.TIKTOK_APP_ID,
    appSecret: process.env.TIKTOK_APP_SECRET,
    redirectUri: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/api/oauth/tiktok/callback',
  },

  // LinkedIn Ads OAuth
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/api/oauth/linkedin/callback',
  },

  // Google Search Console
  searchConsole: {
    clientId: process.env.SEARCH_CONSOLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.SEARCH_CONSOLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.SEARCH_CONSOLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/search-console/callback',
  },

  // Anthropic AI
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // Email configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'AdsData Platform <noreply@adsdata.com>',
  },
};
