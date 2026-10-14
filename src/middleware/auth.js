const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            // Graceful fallback for active browser sessions signed with legacy secret
            try {
                decoded = jwt.verify(token, 'peach_state_secret_key_2026');
            } catch (fallbackErr) {
                throw jwtErr;
            }
        }
        const [rows] = await pool.query('SELECT id, name, email, role, avatar FROM users WHERE id = ?', [decoded.id]);

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'User no longer exists' });
        }

        req.user = rows[0];
        next();
    } catch (err) {
        console.error('Auth Middleware Error:', err);
        res.status(401).json({ success: false, message: 'Session expired or invalid token' });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Admin access required for this action' });
    }
};

module.exports = { protect, adminOnly };
