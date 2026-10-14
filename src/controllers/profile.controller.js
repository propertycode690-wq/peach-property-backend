const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Ensure avatar column exists in users table automatically
const ensureAvatarColumn = async () => {
    try {
        const [cols] = await pool.query("SHOW COLUMNS FROM users LIKE 'avatar'");
        if (cols.length === 0) {
            await pool.query("ALTER TABLE users ADD COLUMN avatar VARCHAR(255) NULL AFTER role");
            console.log("✅ Added avatar column to users table");
        }
    } catch (err) {
        console.error("Error ensuring avatar column:", err.message);
    }
};
ensureAvatarColumn();

// @desc    Get user profile
const getProfile = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update user profile (name, email, optional password, optional avatar)
const updateProfile = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        let sql = 'UPDATE users SET name=?, email=?';
        let params = [name, email];

        if (req.file) {
            const avatarUrl = `/uploads/${req.file.filename}`;
            sql += ', avatar=?';
            params.push(avatarUrl);
        }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            sql += ', password=?';
            params.push(hashedPassword);
        }

        sql += ' WHERE id=?';
        params.push(req.user.id);

        await pool.query(sql, params);

        const [updated] = await pool.query('SELECT id, name, email, role, avatar FROM users WHERE id = ?', [req.user.id]);
        res.json({ success: true, message: 'Profile updated', user: updated[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Upload / Update profile avatar
const updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please select an image file to upload' });
        }

        const avatarUrl = `/uploads/${req.file.filename}`;
        await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id]);

        const [updated] = await pool.query('SELECT id, name, email, role, avatar FROM users WHERE id = ?', [req.user.id]);

        res.json({
            success: true,
            message: 'Profile picture updated successfully!',
            avatar: avatarUrl,
            user: updated[0]
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Remove profile avatar
const removeAvatar = async (req, res) => {
    try {
        await pool.query('UPDATE users SET avatar = NULL WHERE id = ?', [req.user.id]);
        const [updated] = await pool.query('SELECT id, name, email, role, avatar FROM users WHERE id = ?', [req.user.id]);

        res.json({
            success: true,
            message: 'Profile picture removed successfully!',
            avatar: null,
            user: updated[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    updateAvatar,
    removeAvatar
};
