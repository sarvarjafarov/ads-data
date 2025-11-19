const express = require('express');
const healthRoutes = require('./healthRoutes');
const adsRoutes = require('./adsRoutes');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const oauthRoutes = require('./oauthRoutes');
const workspaceRoutes = require('./workspaceRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const metricsRoutes = require('./metricsRoutes');
const alertRoutes = require('./alertRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/ads', adsRoutes);
router.use('/admin', adminRoutes);
router.use('/oauth', oauthRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/dashboards', dashboardRoutes);
router.use('/metrics', metricsRoutes);
router.use('/alerts', alertRoutes);

module.exports = router;
