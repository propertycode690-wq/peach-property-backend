const pool = require('../config/db');

// @desc    Get all expenses
const getExpenses = async (req, res) => {
    try {
        let query = 'SELECT e.*, p.name as property_name, u.name as added_by_name FROM expenses e LEFT JOIN properties p ON e.property_id = p.id LEFT JOIN users u ON e.added_by = u.id';
        let params = [];
        if (req.user.role === 'manager') {
            query += ' WHERE e.added_by = ?';
            params.push(req.user.id);
        }
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create Expense
const createExpense = async (req, res) => {
    const { property_id, category, amount, expense_date, description, receipt_status } = req.body;
    const file = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const [result] = await pool.query(
            'INSERT INTO expenses (property_id, category, amount, expense_date, description, receipt_status, bill_file, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [property_id, category, amount, expense_date, description, receipt_status, file, req.user.id]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Expense
const updateExpense = async (req, res) => {
    const { id } = req.params;
    const { property_id, category, amount, expense_date, description, receipt_status } = req.body;
    let file = req.body.bill_file; // existing file
    if (req.file) file = `/uploads/${req.file.filename}`;

    try {
        let query = 'UPDATE expenses SET property_id=?, category=?, amount=?, expense_date=?, description=?, receipt_status=?, bill_file=? WHERE id=?';
        let params = [property_id, category, amount, expense_date, description, receipt_status, file, id];

        if (req.user.role === 'manager') {
            query += ' AND added_by=?';
            params.push(req.user.id);
        }

        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Expense not found' });
        res.json({ success: true, message: 'Expense updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Expense
const deleteExpense = async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? 'DELETE FROM expenses WHERE id=?' : 'DELETE FROM expenses WHERE id=? AND added_by=?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Expense not found' });
        res.json({ success: true, message: 'Expense deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
