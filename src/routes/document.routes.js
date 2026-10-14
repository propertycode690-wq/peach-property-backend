const express = require('express');
const router = express.Router();
const { getDocuments, createDocument, deleteDocument } = require('../controllers/document.controller');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
    filename: (req, file, cb) => cb(null, `doc-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.route('/')
    .get(protect, getDocuments)
    .post(protect, upload.single('document'), createDocument);

router.route('/:id')
    .delete(protect, deleteDocument);

module.exports = router;
