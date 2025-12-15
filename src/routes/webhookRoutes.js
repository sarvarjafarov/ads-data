const express = require('express');
const router = express.Router();
const customDataController = require('../controllers/customDataController');

// Google Drive webhook (no auth required - Google calls this)
router.post('/google-drive', customDataController.handleGoogleDriveWebhook);

module.exports = router;
