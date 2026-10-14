const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
    getUsers,
    updateUser,
    deleteUser,
    getIntegrations,
    updateIntegrations,
    testEmail,
    testSMS
} = require('../controllers/settings.controller');

// User Management (Admin Only)
router.route('/users')
    .get(protect, adminOnly, getUsers);

router.route('/users/:id')
    .put(protect, adminOnly, updateUser)
    .delete(protect, adminOnly, deleteUser);

// Cloud Integrations (Admin Only)
router.route('/integrations')
    .get(protect, adminOnly, getIntegrations)
    .post(protect, adminOnly, updateIntegrations);

// Test Notifications
router.post('/test-email', protect, adminOnly, testEmail);
router.post('/test-sms', protect, adminOnly, testSMS);

module.exports = router;

module.exports = router;
