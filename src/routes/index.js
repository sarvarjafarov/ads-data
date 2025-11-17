const express = require('express');
const healthRoutes = require('./healthRoutes');
const adsRoutes = require('./adsRoutes');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/ads', adsRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
