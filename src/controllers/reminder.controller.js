/**
 * reminder.controller.js
 * CRUD for notification_settings table
 * GET  /api/reminders/settings
 * PUT  /api/reminders/settings
 */

const pool = require('../config/db');

// @desc  Get notification/reminder settings
const getReminderSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM notification_settings WHERE id = 1');
        if (rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    lease_expiry_days: '90,60,30',
                    rent_review_days: '60,30',
                    overdue_grace_days: 3,
                    email_enabled: 1,
                    sms_enabled: 0,
                    notify_admin_email: null,
                }
            });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc  Update notification/reminder settings
const updateReminderSettings = async (req, res) => {
    const {
        lease_expiry_days,
        rent_review_days,
        overdue_grace_days,
        email_enabled,
        sms_enabled,
        notify_admin_email,
    } = req.body;

    try {
        await pool.query(`
            INSERT INTO notification_settings 
              (id, lease_expiry_days, rent_review_days, overdue_grace_days, email_enabled, sms_enabled, notify_admin_email)
            VALUES (1, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              lease_expiry_days  = VALUES(lease_expiry_days),
              rent_review_days   = VALUES(rent_review_days),
              overdue_grace_days = VALUES(overdue_grace_days),
              email_enabled      = VALUES(email_enabled),
              sms_enabled        = VALUES(sms_enabled),
              notify_admin_email = VALUES(notify_admin_email)
        `, [
            lease_expiry_days  || '90,60,30',
            rent_review_days   || '60,30',
            overdue_grace_days !== undefined ? overdue_grace_days : 3,
            email_enabled !== undefined ? email_enabled : 1,
            sms_enabled   !== undefined ? sms_enabled   : 0,
            notify_admin_email || null,
        ]);
        res.json({ success: true, message: 'Reminder settings updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc  Get last 50 cron run logs
const getCronLogs = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM cron_logs ORDER BY ran_at DESC LIMIT 50'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc  Get sent reminder logs
const getReminderLogs = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM reminder_logs ORDER BY sent_at DESC LIMIT 100'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc  Manual trigger cron (admin only — for testing)
const triggerReminders = async (req, res) => {
    try {
        const { runDailyReminders } = require('../jobs/cronJobs');
        await runDailyReminders();
        res.json({ success: true, message: 'Reminder job triggered manually. Check cron_logs for result.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getReminderSettings,
    updateReminderSettings,
    getCronLogs,
    getReminderLogs,
    triggerReminders,
};
