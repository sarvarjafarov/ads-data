const { query } = require('../config/database');
const { getPlatformService } = require('../services/platforms');

/**
 * Get all campaigns for an ad account with performance metrics
 */
const getCampaigns = async (req, res) => {
  try {
    const { adAccountId } = req.params;
    const { dateRange = 'last_30_days' } = req.query;

    // Get ad account and verify access
    const accountResult = await query(
      `SELECT aa.*, ot.access_token
       FROM ad_accounts aa
       LEFT JOIN oauth_tokens ot ON ot.workspace_id = aa.workspace_id AND ot.platform = aa.platform
       WHERE aa.id = $1`,
      [adAccountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ad account not found',
      });
    }

    const account = accountResult.rows[0];

    // Verify user has access to workspace
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [account.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get campaigns from database
    const campaignsResult = await query(
      `SELECT * FROM campaigns WHERE ad_account_id = $1 ORDER BY created_at DESC`,
      [adAccountId]
    );

    // If no campaigns in database, return demo data
    if (campaignsResult.rows.length === 0) {
      return res.json({
        success: true,
        data: generateDemoCampaigns(account),
        _demoData: true
      });
    }

    res.json({
      success: true,
      data: campaignsResult.rows,
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaigns',
      error: error.message,
    });
  }
};

/**
 * Get campaign details with performance metrics
 */
const getCampaignDetails = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { dateRange = 'last_30_days' } = req.query;

    // Get campaign with account info
    const campaignResult = await query(
      `SELECT c.*, aa.workspace_id, aa.platform, aa.account_id, aa.account_name
       FROM campaigns c
       JOIN ad_accounts aa ON aa.id = c.ad_account_id
       WHERE c.id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    const campaign = campaignResult.rows[0];

    // Verify user has access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [campaign.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Get campaign details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign details',
      error: error.message,
    });
  }
};

/**
 * Get ad sets for a campaign
 */
const getAdSets = async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Get campaign with account info for access check
    const campaignResult = await query(
      `SELECT c.*, aa.workspace_id
       FROM campaigns c
       JOIN ad_accounts aa ON aa.id = c.ad_account_id
       WHERE c.id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    const campaign = campaignResult.rows[0];

    // Verify user has access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [campaign.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get ad sets
    const adSetsResult = await query(
      `SELECT * FROM ad_sets WHERE campaign_id = $1 ORDER BY created_at DESC`,
      [campaignId]
    );

    // If no ad sets, return demo data
    if (adSetsResult.rows.length === 0) {
      return res.json({
        success: true,
        data: generateDemoAdSets(campaign),
        _demoData: true
      });
    }

    res.json({
      success: true,
      data: adSetsResult.rows,
    });
  } catch (error) {
    console.error('Get ad sets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ad sets',
      error: error.message,
    });
  }
};

/**
 * Get ads for an ad set
 */
const getAds = async (req, res) => {
  try {
    const { adSetId } = req.params;

    // Get ad set with campaign and account info for access check
    const adSetResult = await query(
      `SELECT ads.*, c.ad_account_id, aa.workspace_id
       FROM ad_sets ads
       JOIN campaigns c ON c.id = ads.campaign_id
       JOIN ad_accounts aa ON aa.id = c.ad_account_id
       WHERE ads.id = $1`,
      [adSetId]
    );

    if (adSetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ad set not found',
      });
    }

    const adSet = adSetResult.rows[0];

    // Verify user has access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [adSet.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get ads
    const adsResult = await query(
      `SELECT * FROM ads WHERE ad_set_id = $1 ORDER BY created_at DESC`,
      [adSetId]
    );

    // If no ads, return demo data
    if (adsResult.rows.length === 0) {
      return res.json({
        success: true,
        data: generateDemoAds(adSet),
        _demoData: true
      });
    }

    res.json({
      success: true,
      data: adsResult.rows,
    });
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ads',
      error: error.message,
    });
  }
};

// Helper function to generate demo campaigns
function generateDemoCampaigns(account) {
  return [
    {
      id: 'demo-campaign-1',
      campaign_name: 'Summer Sale 2024',
      objective: 'CONVERSIONS',
      status: 'ACTIVE',
      budget_amount: 5000,
      budget_type: 'DAILY',
      spend: 3247.50,
      impressions: 124580,
      clicks: 6229,
      ctr: 5.00,
      cpc: 0.52,
      conversions: 187,
      conversion_rate: 3.00,
      roas: 4.25
    },
    {
      id: 'demo-campaign-2',
      campaign_name: 'Brand Awareness Q2',
      objective: 'BRAND_AWARENESS',
      status: 'ACTIVE',
      budget_amount: 3000,
      budget_type: 'DAILY',
      spend: 2156.30,
      impressions: 98340,
      clicks: 4421,
      ctr: 4.49,
      cpc: 0.49,
      conversions: 98,
      conversion_rate: 2.22,
      roas: 3.80
    },
    {
      id: 'demo-campaign-3',
      campaign_name: 'Product Launch - Mobile App',
      objective: 'APP_INSTALLS',
      status: 'PAUSED',
      budget_amount: 2000,
      budget_type: 'LIFETIME',
      spend: 1892.45,
      impressions: 67820,
      clicks: 3051,
      ctr: 4.50,
      cpc: 0.62,
      conversions: 245,
      conversion_rate: 8.03,
      roas: 2.95
    }
  ];
}

// Helper function to generate demo ad sets
function generateDemoAdSets(campaign) {
  return [
    {
      id: 'demo-adset-1',
      ad_set_name: 'Women 25-34 - Los Angeles',
      status: 'ACTIVE',
      budget_amount: 150,
      bid_amount: 0.85,
      spend: 1247.80,
      impressions: 45210,
      clicks: 2261,
      ctr: 5.00,
      cpc: 0.55,
      conversions: 68
    },
    {
      id: 'demo-adset-2',
      ad_set_name: 'Men 25-44 - New York',
      status: 'ACTIVE',
      budget_amount: 200,
      bid_amount: 0.95,
      spend: 1654.20,
      impressions: 52340,
      clicks: 2617,
      ctr: 5.00,
      cpc: 0.63,
      conversions: 92
    },
    {
      id: 'demo-adset-3',
      ad_set_name: 'Lookalike - High Value Customers',
      status: 'ACTIVE',
      budget_amount: 100,
      bid_amount: 0.75,
      spend: 345.50,
      impressions: 27030,
      clicks: 1351,
      ctr: 5.00,
      cpc: 0.26,
      conversions: 27
    }
  ];
}

// Helper function to generate demo ads
function generateDemoAds(adSet) {
  return [
    {
      id: 'demo-ad-1',
      ad_name: 'Carousel - Summer Collection',
      ad_type: 'CAROUSEL',
      status: 'ACTIVE',
      spend: 542.30,
      impressions: 18920,
      clicks: 946,
      ctr: 5.00,
      cpc: 0.57,
      conversions: 28
    },
    {
      id: 'demo-ad-2',
      ad_name: 'Video - Product Demo',
      ad_type: 'VIDEO',
      status: 'ACTIVE',
      spend: 456.70,
      impressions: 15430,
      clicks: 772,
      ctr: 5.00,
      cpc: 0.59,
      conversions: 23
    },
    {
      id: 'demo-ad-3',
      ad_name: 'Single Image - Discount Offer',
      ad_type: 'IMAGE',
      status: 'ACTIVE',
      spend: 248.80,
      impressions: 10860,
      clicks: 543,
      ctr: 5.00,
      cpc: 0.46,
      conversions: 17
    }
  ];
}

module.exports = {
  getCampaigns,
  getCampaignDetails,
  getAdSets,
  getAds,
};
