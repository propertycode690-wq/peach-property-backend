const pool = require('../config/db');

// @desc    Get all documents
const getDocuments = async (req, res) => {
    try {
        let query = 'SELECT d.*, p.name as property_name, u.name as added_by_name FROM documents d LEFT JOIN properties p ON d.property_id = p.id LEFT JOIN users u ON d.uploaded_by = u.id';
        let params = [];
        if (req.user.role === 'manager') {
            query += ' WHERE d.uploaded_by = ?';
            params.push(req.user.id);
        }
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Upload Document
const createDocument = async (req, res) => {
    const { document_name, category, property_id, notes } = req.body;
    const file_name = req.file ? req.file.originalname : null;
    const file_path = req.file ? `uploads/${req.file.filename}` : null;
    try {
        const [result] = await pool.query(
            `INSERT INTO documents (document_name, file_name, category, property_id, notes, source, file_path, uploaded_by) 
             VALUES (?, ?, ?, ?, ?, 'uploaded', ?, ?)`,
            [document_name, file_name, category, property_id, notes, file_path, req.user.id]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Document
const deleteDocument = async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? 'DELETE FROM documents WHERE id=?' : 'DELETE FROM documents WHERE id=? AND uploaded_by=?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Document not found' });
        res.json({ success: true, message: 'Document deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getDocuments, createDocument, deleteDocument };
