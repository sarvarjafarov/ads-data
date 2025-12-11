const express = require('express');
const {
  getCampaigns,
  getCampaignDetails,
  getAdSets,
  getAds,
} = require('../controllers/campaignController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All campaign routes require authentication
router.use(authenticate);

// Get all campaigns for an ad account
router.get('/accounts/:adAccountId/campaigns', getCampaigns);

// Get campaign details
router.get('/campaigns/:campaignId', getCampaignDetails);

// Get ad sets for a campaign
router.get('/campaigns/:campaignId/adsets', getAdSets);

// Get ads for an ad set
router.get('/adsets/:adSetId/ads', getAds);

module.exports = router;
