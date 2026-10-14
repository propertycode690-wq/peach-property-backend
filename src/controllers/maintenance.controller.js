const pool = require('../config/db');

// @desc    Get all maintenance tickets
const getMaintenance = async (req, res) => {
    try {
        let query = `SELECT m.*, p.name as property_name, t.full_name as tenant_name, u.name as added_by_name 
                     FROM maintenance m 
                     LEFT JOIN properties p ON m.property_id = p.id 
                     LEFT JOIN tenants t ON m.tenant_id = t.id
                     LEFT JOIN users u ON m.added_by = u.id`;
        let params = [];
        if (req.user.role === 'manager') {
            query += ' WHERE m.added_by = ?';
            params.push(req.user.id);
        }
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create Maintenance
const createMaintenance = async (req, res) => {
    const { title, description, property_id, tenant_id, category, priority, status } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO maintenance (title, description, property_id, tenant_id, category, priority, status, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, property_id, tenant_id, category, priority, status, req.user.id]
        );

        // Dynamic system notification
        const { createNotification } = require('../services/notificationService');
        createNotification({
            type: 'maintenance',
            title: 'New Maintenance Request',
            message: `${title} (${category || 'General'}) - Priority: ${priority || 'Medium'}`,
            link: '/admin/maintenance',
            user_id: null
        }).catch(e => console.error('[NOTIF ERROR]', e.message));

        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Maintenance Ticket
const updateMaintenance = async (req, res) => {
    const { id } = req.params;
    const { title, description, property_id, tenant_id, category, priority, status } = req.body;
    try {
        let query = 'UPDATE maintenance SET title=?, description=?, property_id=?, tenant_id=?, category=?, priority=?, status=? WHERE id=?';
        let params = [title, description, property_id, tenant_id, category, priority, status, id];

        if (req.user.role === 'manager') {
            query += ' AND added_by=?';
            params.push(req.user.id);
        }

        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

        // Dynamic system notification for updates
        const { createNotification } = require('../services/notificationService');
        createNotification({
            type: 'maintenance',
            title: `Maintenance Updated: #${id}`,
            message: `${title || 'Ticket'} is now marked as ${status || 'updated'}`,
            link: '/admin/maintenance',
            user_id: null
        }).catch(e => console.error('[NOTIF ERROR]', e.message));

        res.json({ success: true, message: 'Ticket updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Maintenance
const deleteMaintenance = async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? 'DELETE FROM maintenance WHERE id=?' : 'DELETE FROM maintenance WHERE id=? AND added_by=?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });
        res.json({ success: true, message: 'Ticket deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getMaintenance, createMaintenance, updateMaintenance, deleteMaintenance };
