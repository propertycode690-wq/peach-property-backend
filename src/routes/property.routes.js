const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getProperties, createProperty, updateProperty, deleteProperty } = require('../controllers/property.controller');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
    filename: (req, file, cb) => cb(null, `prop-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.route('/')
    .get(protect, getProperties)
    .post(protect, upload.any(), createProperty);

router.route('/:id')
    .put(protect, upload.any(), updateProperty)
    .delete(protect, deleteProperty);

// Metadata (Dynamic Types)
router.get('/meta/types', protect, async (req, res) => {
    const [types] = await pool.query('SELECT * FROM property_types ORDER BY name ASC');
    res.json({ success: true, data: types });
});
router.post('/meta/types', protect, async (req, res) => {
    const { name } = req.body;
    await pool.query('INSERT IGNORE INTO property_types (name) VALUES (?)', [name]);
    res.json({ success: true, message: 'Type added' });
});

module.exports = router;
