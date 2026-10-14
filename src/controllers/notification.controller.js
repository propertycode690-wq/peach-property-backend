const notificationService = require('../services/notificationService');

// @desc    Get user notifications + unread count
// @route   GET /api/notifications
const getNotifications = async (req, res) => {
    try {
        const { limit } = req.query;
        const result = await notificationService.getNotifications({
            userId: req.user.id,
            role: req.user.role,
            limit: limit || 40
        });
        res.json(result);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
const markAllAsRead = async (req, res) => {
    try {
        const result = await notificationService.markAllAsRead({
            userId: req.user.id,
            role: req.user.role
        });
        res.json({ success: true, message: 'All notifications marked as read', ...result });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, message: 'Failed to update notifications' });
    }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
const markAsRead = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await notificationService.markAsRead({
            id,
            userId: req.user.id,
            role: req.user.role
        });
        res.json({ success: true, message: 'Notification marked as read', ...result });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Failed to update notification' });
    }
};

// @desc    Create a custom/manual notification
// @route   POST /api/notifications
const createNotification = async (req, res) => {
    const { type, title, message, link, user_id } = req.body;
    if (!type || !title) {
        return res.status(400).json({ success: false, message: 'Type and title are required' });
    }
    try {
        const result = await notificationService.createNotification({
            user_id: user_id || null,
            type,
            title,
            message: message || '',
            link: link || null
        });
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ success: false, message: 'Failed to create notification' });
    }
};

module.exports = {
    getNotifications,
    markAllAsRead,
    markAsRead,
    createNotification
};
