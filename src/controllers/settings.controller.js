const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { sendEmail, sendSMS } = require('../config/notifications');

// @desc    Get all users (Admin Only)
const getUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, name, email, role, avatar, created_at FROM users WHERE role != "admin"');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Edit user (Admin Only)
const updateUser = async (req, res) => {
    const { name, email, role, password, avatar } = req.body;
    try {
        let sql = 'UPDATE users SET name=?, email=?, role=?';
        let params = [name, email, role];

        if (req.file) {
            sql += ', avatar=?';
            params.push(`/uploads/${req.file.filename}`);
        } else if (avatar !== undefined) {
            sql += ', avatar=?';
            params.push(avatar || null);
        }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            sql += ', password=?';
            params.push(hashedPassword);
        }

        sql += ' WHERE id=?';
        params.push(req.params.id);

        await pool.query(sql, params);
        res.json({ success: true, message: 'User updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete user (Admin Only)
const deleteUser = async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Cloud Integrations
const getIntegrations = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
        const config = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Cloud Integrations
const updateIntegrations = async (req, res) => {
    const settings = req.body; // e.g., { twilio_sid: '...', ... }
    try {
        for (const [key, value] of Object.entries(settings)) {
            await pool.query('UPDATE settings SET value=? WHERE `key`=?', [value, key]);
        }
        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Test Email Integration
const testEmail = async (req, res) => {
    const { email } = req.body;
    try {
        const result = await sendEmail(
            email || req.user.email,
            'Test Email Notification - Property & Lease',
            '<h1>Configuration Successful!</h1><p>This is a test email to verify your SMTP settings.</p>'
        );
        if (result.success) {
            res.json({ success: true, message: 'Test email sent successfully' });
        } else {
            res.status(500).json({ success: false, message: result.error });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Test SMS Integration
const testSMS = async (req, res) => {
    const { phone } = req.body;
    try {
        const result = await sendSMS(
            phone,
            'Test SMS from Property & Lease. Configuration Successful!'
        );
        if (result.success) {
            res.json({ success: true, message: 'Test SMS sent successfully' });
        } else {
            res.status(500).json({ success: false, message: result.error });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getUsers,
    updateUser,
    deleteUser,
    getIntegrations,
    updateIntegrations,
    testEmail,
    testSMS
};
