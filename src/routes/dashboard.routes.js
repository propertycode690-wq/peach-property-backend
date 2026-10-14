const express = require('express');
const router = express.Router();
const { getStats, getPerformanceData } = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth');

// @route   GET /api/dashboard/stats
router.get('/stats', protect, getStats);

// @route   GET /api/dashboard/performance
router.get('/performance', protect, getPerformanceData);

module.exports = router;
