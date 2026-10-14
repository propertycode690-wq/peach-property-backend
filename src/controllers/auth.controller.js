const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

// @desc    Login
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid Credentials' });

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid Credentials' });

        res.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || null },
            token: generateToken(user.id)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Register Manager (Admin Only)
const register = async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const [existing] = await pool.query('SELECT email FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(400).json({ success: false, message: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role || 'manager']
        );
        res.status(201).json({ success: true, user: { id: result.insertId, name, email, role } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Me
const getMe = async (req, res) => {
    res.json({ success: true, user: req.user });
};

module.exports = { login, register, getMe };
