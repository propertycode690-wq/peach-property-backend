const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getProfile, updateProfile, updateAvatar, removeAvatar } = require('../controllers/profile.controller');
const { protect } = require('../middleware/auth');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
    filename: (req, file, cb) => cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files (JPG, PNG, WEBP, GIF) are allowed!'));
    }
});

router.use(protect);

router.get('/', getProfile);
router.put('/', upload.single('avatar'), updateProfile);
router.put('/avatar', upload.single('avatar'), updateAvatar);
router.delete('/avatar', removeAvatar);

module.exports = router;
