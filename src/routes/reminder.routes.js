const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
    getReminderSettings,
    updateReminderSettings,
    getCronLogs,
    getReminderLogs,
    triggerReminders,
} = require('../controllers/reminder.controller');

// All routes need login
router.use(protect);

// Notification settings
router.get('/settings',  getReminderSettings);
router.put('/settings',  updateReminderSettings);

// Logs (admin only)
router.get('/cron-logs',     adminOnly, getCronLogs);
router.get('/reminder-logs', adminOnly, getReminderLogs);

// Manual trigger (admin only — for testing)
router.post('/trigger', adminOnly, triggerReminders);

module.exports = router;
