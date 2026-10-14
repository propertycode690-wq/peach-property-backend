const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markAllAsRead,
    markAsRead,
    createNotification
} = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.post('/', createNotification);

module.exports = router;
