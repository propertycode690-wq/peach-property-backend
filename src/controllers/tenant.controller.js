const pool = require('../config/db');

// @desc    Get all tenants
const getTenants = async (req, res) => {
    try {
        let query = 'SELECT t.*, p.name as property_name, u.name as added_by_name FROM tenants t LEFT JOIN properties p ON t.property_id = p.id LEFT JOIN users u ON t.added_by = u.id';
        let params = [];
        if (req.user.role === 'manager') {
            query += ' WHERE t.added_by = ?';
            params.push(req.user.id);
        }
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error in getTenants:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add Tenant
const createTenant = async (req, res) => {
    const { full_name, email, phone, property_id, unit_number, move_in_date, status, notes } = req.body;
    const document = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const [result] = await pool.query(
            'INSERT INTO tenants (full_name, email, phone, property_id, unit_number, move_in_date, status, id_document, notes, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [full_name, email, phone, property_id, unit_number, move_in_date, status, document, notes || null, req.user.id]
        );

        // Dynamic system notification
        const { createNotification } = require('../services/notificationService');
        createNotification({
            type: 'tenant',
            title: 'New Tenant Onboarded',
            message: `${full_name} registered for Unit ${unit_number || 'N/A'}`,
            link: '/admin/tenants',
            user_id: null
        }).catch(e => console.error('[NOTIF ERROR]', e.message));

        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Tenant
const updateTenant = async (req, res) => {
    const { id } = req.params;
    const { full_name, email, phone, property_id, unit_number, move_in_date, status, notes } = req.body;
    try {
        let query = 'UPDATE tenants SET full_name=?, email=?, phone=?, property_id=?, unit_number=?, move_in_date=?, status=?';
        let params = [full_name, email, phone, property_id, unit_number, move_in_date, status];
        if (notes !== undefined) {
            query += ', notes=?';
            params.push(notes || null);
        }
        if (req.file) {
            query += ', id_document=?';
            params.push(`/uploads/${req.file.filename}`);
        }
        query += ' WHERE id=?';
        params.push(id);
        if (req.user.role === 'manager') {
            query += ' AND added_by=?';
            params.push(req.user.id);
        }
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Tenant not found' });
        res.json({ success: true, message: 'Tenant updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Tenant
const deleteTenant = async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? 'DELETE FROM tenants WHERE id=?' : 'DELETE FROM tenants WHERE id=? AND added_by=?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Tenant not found' });
        res.json({ success: true, message: 'Tenant deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getTenants, createTenant, updateTenant, deleteTenant };
