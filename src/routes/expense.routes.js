const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expense.controller');
const { protect } = require('../middleware/auth');
const { validateExpense } = require('../middleware/validate');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
    filename: (req, file, cb) => cb(null, `expense-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.route('/')
    .get(protect, getExpenses)
    .post(protect, upload.single('bill_file'), validateExpense, createExpense);

router.route('/:id')
    .put(protect, upload.single('bill_file'), validateExpense, updateExpense)
    .delete(protect, deleteExpense);

// Metadata (Dynamic Categories)
router.get('/meta/categories', protect, async (req, res) => {
    const [cats] = await pool.query('SELECT * FROM expense_categories ORDER BY name ASC');
    res.json({ success: true, data: cats });
});

router.post('/meta/categories', protect, async (req, res) => {
    const { name } = req.body;
    await pool.query('INSERT IGNORE INTO expense_categories (name) VALUES (?)', [name]);
    res.json({ success: true, message: 'Category added' });
});

module.exports = router;
