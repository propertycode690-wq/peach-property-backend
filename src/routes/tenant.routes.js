const express = require('express');
const router = express.Router();
const { getTenants, createTenant, updateTenant, deleteTenant } = require('../controllers/tenant.controller');
const { protect } = require('../middleware/auth');
const { validateTenant } = require('../middleware/validate');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
    filename: (req, file, cb) => cb(null, `tenant-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.route('/')
    .get(protect, getTenants)
    .post(protect, upload.single('id_document'), validateTenant, createTenant);

router.route('/:id')
    .put(protect, upload.single('id_document'), validateTenant, updateTenant)
    .delete(protect, deleteTenant);

module.exports = router;
