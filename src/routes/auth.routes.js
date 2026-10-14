const express = require('express');
const router = express.Router();
const { login, register, getMe } = require('../controllers/auth.controller');
const { protect, adminOnly } = require('../middleware/auth');
const { validateLogin } = require('../middleware/validate');

router.post('/login', validateLogin, login);
router.get('/me', protect, getMe);
router.post('/register', protect, adminOnly, register);

module.exports = router;
