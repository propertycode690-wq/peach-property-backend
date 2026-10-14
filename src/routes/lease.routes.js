const express = require('express');
const router = express.Router();
const { getLeases, createLease, updateLease, deleteLease } = require('../controllers/lease.controller');
const { protect } = require('../middleware/auth');
const { validateLease } = require('../middleware/validate');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
    filename: (req, file, cb) => cb(null, `lease-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.route('/')
    .get(protect, getLeases)
    .post(protect, upload.single('agreement_file'), validateLease, createLease);

router.route('/:id')
    .put(protect, upload.single('agreement_file'), validateLease, updateLease)
    .delete(protect, deleteLease);

module.exports = router;
