const pool = require('../config/db');

// @desc    Get dashboard metrics & stats
// @route   GET /api/dashboard/stats
const getStats = async (req, res) => {
    const { id: userId, role } = req.user;

    try {
        // Query templates based on role
        const propertyFilter = role === 'manager' ? 'WHERE added_by = ?' : '';
        const tenantFilter = role === 'manager' ? 'WHERE added_by = ?' : '';
        const invoiceFilter = role === 'manager' ? 'WHERE added_by = ?' : '';

        // 1. Total Properties
        const [propCount] = await pool.query(`SELECT COUNT(*) as total FROM properties ${propertyFilter}`, role === 'manager' ? [userId] : []);

        // 2. Total Tenants
        const [tenantCount] = await pool.query(`SELECT COUNT(*) as total FROM tenants ${tenantFilter}`, role === 'manager' ? [userId] : []);

        // 3. Revenue (Paid Invoices)
        const [revenue] = await pool.query(`SELECT SUM(amount) as total FROM invoices WHERE status = 'Paid' ${role === 'manager' ? 'AND added_by = ?' : ''}`, role === 'manager' ? [userId] : []);

        // 4. Arrears (Unpaid/Overdue Invoices)
        const [arrears] = await pool.query(`SELECT SUM(amount) as total FROM invoices WHERE status != 'Paid' ${role === 'manager' ? 'AND added_by = ?' : ''}`, role === 'manager' ? [userId] : []);

        // 4.5. Total Expenses
        const [expenses] = await pool.query(`SELECT SUM(amount) as total FROM expenses ${role === 'manager' ? 'WHERE added_by = ?' : ''}`, role === 'manager' ? [userId] : []);

        // 5. Recent Activity Logs
        const [activities] = await pool.query(
            `SELECT a.*, u.name as user_name FROM activity_logs a 
             LEFT JOIN users u ON a.user_id = u.id 
             ${role === 'manager' ? 'WHERE a.user_id = ?' : ''} 
             ORDER BY a.timestamp DESC LIMIT 10`,
            role === 'manager' ? [userId] : []
        );

        res.json({
            success: true,
            data: {
                totalProperties: propCount[0].total,
                totalTenants: tenantCount[0].total,
                totalRevenue: revenue[0].total || 0,
                totalArrears: arrears[0].total || 0,
                totalExpenses: expenses[0].total || 0,
                recentActivities: activities
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Dashboard stats error' });
    }
};

// @desc    Get Performance Chart Data
// @route   GET /api/dashboard/performance
const getPerformanceData = async (req, res) => {
    const { id: userId, role } = req.user;

    try {
        // Monthly Revenue & Collection logic (Simulated for 6 months)
        const query = `
            SELECT 
                DATE_FORMAT(due_date, '%b') as month,
                SUM(amount) as expected,
                SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) as collected
            FROM invoices
            ${role === 'manager' ? 'WHERE added_by = ?' : ''}
            GROUP BY month
            ORDER BY MIN(due_date) ASC
            LIMIT 12
        `;

        const [results] = await pool.query(query, role === 'manager' ? [userId] : []);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Performance chart error' });
    }
};

module.exports = {
    getStats,
    getPerformanceData
};
