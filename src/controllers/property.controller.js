const pool = require('../config/db');

// @desc    Get all properties
const getProperties = async (req, res) => {
    const { id: userId, role } = req.user;
    try {
        let query = `SELECT p.*, u.name as added_by_name FROM properties p 
                     LEFT JOIN users u ON p.added_by = u.id`;
        let params = [];
        if (role === 'manager') {
            query += ' WHERE p.added_by = ?';
            params.push(userId);
        }
        query += ' ORDER BY p.created_at DESC';
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add Property
const createProperty = async (req, res) => {
    const { name, address, city, state, zip_code, type, total_units, status } = req.body;
    let image = null;
    let imagesArr = [];
    if (req.files && req.files.length > 0) {
        imagesArr = req.files.map(f => `/uploads/${f.filename}`);
        image = imagesArr[0];
    }
    const imagesStr = JSON.stringify(imagesArr);
    try {
        const [result] = await pool.query(
            'INSERT INTO properties (name, address, city, state, zip_code, type, total_units, status, image, images, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, address, city, state, zip_code, type, total_units, status, image, imagesStr, req.user.id]
        );
        await pool.query('INSERT INTO activity_logs (action, details, user_id) VALUES (?, ?, ?)',
            ['Create Property', `Added property: ${name}`, req.user.id]);

        // Dynamic system notification
        const { createNotification } = require('../services/notificationService');
        createNotification({
            type: 'property',
            title: 'New Property Added',
            message: `Property "${name}" added to portfolio (${city ? city + ', ' : ''}${type || 'Unit'})`,
            link: '/admin/properties',
            user_id: null
        }).catch(e => console.error('[NOTIF ERROR]', e.message));

        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Property
const updateProperty = async (req, res) => {
    const { id } = req.params;
    const { name, address, city, state, zip_code, type, total_units, status } = req.body;

    // existing_images could be a string (from single existing image logic) or array of strings, or undefined
    let existingImages = req.body.existing_images || [];
    if (typeof existingImages === 'string') {
        try { existingImages = JSON.parse(existingImages); }
        catch (e) { existingImages = [existingImages]; }
    }
    if (!Array.isArray(existingImages)) existingImages = [];

    try {
        let query = 'UPDATE properties SET name=?, address=?, city=?, state=?, zip_code=?, type=?, total_units=?, status=?';
        let params = [name, address, city, state, zip_code, type, total_units, status];

        let newImages = [];
        if (req.files && req.files.length > 0) {
            newImages = req.files.map(f => `/uploads/${f.filename}`);
        }

        let finalImages = [...existingImages, ...newImages];

        if (req.files && req.files.length > 0 || req.body.images_changed === 'true') {
            query += ', image=?, images=?';
            params.push(finalImages.length > 0 ? finalImages[0] : null, JSON.stringify(finalImages));
        }
        query += ' WHERE id=?';
        params.push(id);
        if (req.user.role === 'manager') {
            query += ' AND added_by=?';
            params.push(req.user.id);
        }
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Property not found' });
        res.json({ success: true, message: 'Property updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Property
const deleteProperty = async (req, res) => {
    try {
        const query = req.user.role === 'admin'
            ? 'DELETE FROM properties WHERE id=?'
            : 'DELETE FROM properties WHERE id=? AND added_by=?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Property not found' });
        res.json({ success: true, message: 'Property deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getProperties, createProperty, updateProperty, deleteProperty };
