/**
 * Search Console Controller
 * Handles Search Console analytics data endpoints
 */

const { query } = require('../config/database');
const config = require('../config/config');
const { getPlatformService } = require('../services/platforms');

// Helper to get date range
function getDateRange(range) {
  const now = new Date();
  let since, until;

  switch (range) {
    case 'last_7_days':
      since = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_30_days':
      since = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_90_days':
      since = new Date(now - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'last_28_days':
    default:
      since = new Date(now - 28 * 24 * 60 * 60 * 1000);
  }

  until = new Date(now - 24 * 60 * 60 * 1000); // Yesterday (GSC data has ~2 day delay)

  return {
    startDate: since.toISOString().split('T')[0],
    endDate: until.toISOString().split('T')[0],
  };
}

/**
 * Get comprehensive search analytics report
 */
const getSearchAnalytics = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { dateRange = 'last_28_days' } = req.query;

    // Get account details
    const accountResult = await query(
      `SELECT aa.*, ot.access_token, ot.refresh_token
       FROM ad_accounts aa
       JOIN oauth_tokens ot ON ot.id = aa.oauth_token_id
       WHERE aa.id = $1 AND aa.platform = 'search_console'`,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Search Console property not found',
      });
    }

    const account = accountResult.rows[0];
    const siteUrl = decodeURIComponent(account.account_id);
    const { startDate, endDate } = getDateRange(dateRange);

    const SearchConsoleService = getPlatformService('search_console');
    const report = await SearchConsoleService.getComprehensiveReport(
      siteUrl,
      account.access_token,
      { startDate, endDate }
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Get search analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search analytics',
      error: error.message,
    });
  }
};

/**
 * Get top queries (keywords)
 */
const getTopQueries = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { dateRange = 'last_28_days', limit = 100 } = req.query;

    const accountResult = await query(
      `SELECT aa.*, ot.access_token
       FROM ad_accounts aa
       JOIN oauth_tokens ot ON ot.id = aa.oauth_token_id
       WHERE aa.id = $1 AND aa.platform = 'search_console'`,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Search Console property not found',
      });
    }

    const account = accountResult.rows[0];
    const siteUrl = decodeURIComponent(account.account_id);
    const { startDate, endDate } = getDateRange(dateRange);

    const SearchConsoleService = getPlatformService('search_console');
    const queries = await SearchConsoleService.getTopQueries(
      siteUrl,
      account.access_token,
      { startDate, endDate, rowLimit: parseInt(limit) }
    );

    res.json({
      success: true,
      data: queries,
    });
  } catch (error) {
    console.error('Get top queries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top queries',
      error: error.message,
    });
  }
};

/**
 * Get page performance
 */
const getPagePerformance = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { dateRange = 'last_28_days', limit = 100 } = req.query;

    const accountResult = await query(
      `SELECT aa.*, ot.access_token
       FROM ad_accounts aa
       JOIN oauth_tokens ot ON ot.id = aa.oauth_token_id
       WHERE aa.id = $1 AND aa.platform = 'search_console'`,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Search Console property not found',
      });
    }

    const account = accountResult.rows[0];
    const siteUrl = decodeURIComponent(account.account_id);
    const { startDate, endDate } = getDateRange(dateRange);

    const SearchConsoleService = getPlatformService('search_console');
    const pages = await SearchConsoleService.getPagePerformance(
      siteUrl,
      account.access_token,
      { startDate, endDate, rowLimit: parseInt(limit) }
    );

    res.json({
      success: true,
      data: pages,
    });
  } catch (error) {
    console.error('Get page performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch page performance',
      error: error.message,
    });
  }
};

/**
 * Get device breakdown
 */
const getDeviceBreakdown = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { dateRange = 'last_28_days' } = req.query;

    const accountResult = await query(
      `SELECT aa.*, ot.access_token
       FROM ad_accounts aa
       JOIN oauth_tokens ot ON ot.id = aa.oauth_token_id
       WHERE aa.id = $1 AND aa.platform = 'search_console'`,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Search Console property not found',
      });
    }

    const account = accountResult.rows[0];
    const siteUrl = decodeURIComponent(account.account_id);
    const { startDate, endDate } = getDateRange(dateRange);

    const SearchConsoleService = getPlatformService('search_console');
    const devices = await SearchConsoleService.getDeviceBreakdown(
      siteUrl,
      account.access_token,
      { startDate, endDate }
    );

    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    console.error('Get device breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device breakdown',
      error: error.message,
    });
  }
};

/**
 * Get country breakdown
 */
const getCountryBreakdown = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { dateRange = 'last_28_days', limit = 50 } = req.query;

    const accountResult = await query(
      `SELECT aa.*, ot.access_token
       FROM ad_accounts aa
       JOIN oauth_tokens ot ON ot.id = aa.oauth_token_id
       WHERE aa.id = $1 AND aa.platform = 'search_console'`,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Search Console property not found',
      });
    }

    const account = accountResult.rows[0];
    const siteUrl = decodeURIComponent(account.account_id);
    const { startDate, endDate } = getDateRange(dateRange);

    const SearchConsoleService = getPlatformService('search_console');
    const countries = await SearchConsoleService.getCountryBreakdown(
      siteUrl,
      account.access_token,
      { startDate, endDate, rowLimit: parseInt(limit) }
    );

    res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    console.error('Get country breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch country breakdown',
      error: error.message,
    });
  }
};

/**
 * Get query-page analysis (landing page analysis)
 */
const getQueryPageAnalysis = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { dateRange = 'last_28_days', limit = 100 } = req.query;

    const accountResult = await query(
      `SELECT aa.*, ot.access_token
       FROM ad_accounts aa
       JOIN oauth_tokens ot ON ot.id = aa.oauth_token_id
       WHERE aa.id = $1 AND aa.platform = 'search_console'`,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Search Console property not found',
      });
    }

    const account = accountResult.rows[0];
    const siteUrl = decodeURIComponent(account.account_id);
    const { startDate, endDate } = getDateRange(dateRange);

    const SearchConsoleService = getPlatformService('search_console');
    const queryPages = await SearchConsoleService.getQueryPageAnalysis(
      siteUrl,
      account.access_token,
      { startDate, endDate, rowLimit: parseInt(limit) }
    );

    res.json({
      success: true,
      data: queryPages,
    });
  } catch (error) {
    console.error('Get query-page analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch query-page analysis',
      error: error.message,
    });
  }
};

/**
 * Get search appearance data
 */
const getSearchAppearance = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { dateRange = 'last_28_days' } = req.query;

    const accountResult = await query(
      `SELECT aa.*, ot.access_token
       FROM ad_accounts aa
       JOIN oauth_tokens ot ON ot.id = aa.oauth_token_id
       WHERE aa.id = $1 AND aa.platform = 'search_console'`,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Search Console property not found',
      });
    }

    const account = accountResult.rows[0];
    const siteUrl = decodeURIComponent(account.account_id);
    const { startDate, endDate } = getDateRange(dateRange);

    const SearchConsoleService = getPlatformService('search_console');
    const appearances = await SearchConsoleService.getSearchAppearance(
      siteUrl,
      account.access_token,
      { startDate, endDate }
    );

    res.json({
      success: true,
      data: appearances,
    });
  } catch (error) {
    console.error('Get search appearance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search appearance',
      error: error.message,
    });
  }
};

module.exports = {
  getSearchAnalytics,
  getTopQueries,
  getPagePerformance,
  getDeviceBreakdown,
  getCountryBreakdown,
  getQueryPageAnalysis,
  getSearchAppearance,
};
