/**
 * Platform Service Factory
 * Returns the appropriate platform connector based on platform name
 */

const MetaAdsService = require('./metaAds');
const GoogleAdsService = require('./googleAds');
const TikTokAdsService = require('./tiktokAds');
const LinkedInAdsService = require('./linkedinAds');
const SearchConsoleService = require('./searchConsole');
const GoogleSheetsService = require('./googleSheets');

const platformServices = {
  meta: MetaAdsService,
  google: GoogleAdsService,
  tiktok: TikTokAdsService,
  linkedin: LinkedInAdsService,
  search_console: SearchConsoleService,
  google_sheets: GoogleSheetsService,
};

/**
 * Get platform service instance
 * @param {string} platform - Platform name (meta, google, tiktok, linkedin)
 * @returns {Object} Platform service instance
 */
function getPlatformService(platform) {
  const Service = platformServices[platform];
  if (!Service) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return Service;
}

/**
 * Get all supported platforms
 * @returns {string[]} Array of supported platform names
 */
function getSupportedPlatforms() {
  return Object.keys(platformServices);
}

/**
 * Get platform display info
 * @param {string} platform - Platform name
 * @returns {Object} Platform display information
 */
function getPlatformInfo(platform) {
  const info = {
    meta: {
      name: 'Meta Ads',
      icon: '📘',
      description: 'Connect your Facebook and Instagram ad accounts',
      color: '#1877F2',
    },
    google: {
      name: 'Google Ads',
      icon: '🔍',
      description: 'Connect your Google Ads accounts',
      color: '#4285F4',
    },
    tiktok: {
      name: 'TikTok Ads',
      icon: '🎵',
      description: 'Connect your TikTok Ads accounts',
      color: '#000000',
    },
    linkedin: {
      name: 'LinkedIn Ads',
      icon: '💼',
      description: 'Connect your LinkedIn Campaign Manager accounts',
      color: '#0A66C2',
    },
    search_console: {
      name: 'Google Search Console',
      icon: '🔎',
      description: 'Connect your Search Console for organic search analytics',
      color: '#34A853',
    },
    google_sheets: {
      name: 'Google Sheets',
      icon: '📊',
      description: 'Import custom data from Google Sheets',
      color: '#0F9D58',
    },
  };

  return info[platform] || { name: platform, icon: '📊', description: '', color: '#666666' };
}

module.exports = {
  getPlatformService,
  getSupportedPlatforms,
  getPlatformInfo,
  MetaAdsService,
  GoogleAdsService,
  TikTokAdsService,
  LinkedInAdsService,
  SearchConsoleService,
  GoogleSheetsService,
};
