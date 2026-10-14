const pool = require('../config/db');

/**
 * Format relative time (e.g., '5m ago', '2h ago', 'Just now')
 */
const formatRelativeTime = (date) => {
    if (!date) return 'Just now';
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/**
 * Ensure notifications table exists and is populated with recent system activity
 */
const initNotificationsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NULL,
                link VARCHAR(255) NULL,
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_read (user_id, is_read),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Check if table is empty, if so, seed from real existing entities
        const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM notifications');
        if (rows[0].cnt === 0) {
            console.log('[NOTIFICATIONS] Seeding initial notifications from system data...');
            
            // 1. Existing Maintenance tickets
            try {
                const [maintenance] = await pool.query(`
                    SELECT m.*, p.name as property_name 
                    FROM maintenance m 
                    LEFT JOIN properties p ON m.property_id = p.id 
                    ORDER BY m.created_at DESC LIMIT 5
                `);
                for (const m of maintenance) {
                    const title = m.status === 'resolved' 
                        ? `Maintenance Resolved: ${m.title}` 
                        : `New Maintenance Request: ${m.title}`;
                    const msg = `${m.description ? m.description.slice(0, 100) : m.category || 'Maintenance Ticket'}${m.property_name ? ` (${m.property_name})` : ''}`;
                    await pool.query(
                        'INSERT INTO notifications (type, title, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                        ['maintenance', title, msg, '/admin/maintenance', 0, m.created_at || new Date()]
                    );
                }
            } catch (err) {
                console.error('[NOTIFICATIONS SEED] Maintenance seed error:', err.message);
            }

            // 2. Existing Invoices & Payments
            try {
                const [invoices] = await pool.query(`
                    SELECT i.*, t.full_name as tenant_name 
                    FROM invoices i 
                    LEFT JOIN tenants t ON i.tenant_id = t.id 
                    ORDER BY i.created_at DESC LIMIT 5
                `);
                for (const inv of invoices) {
                    const isPaid = (inv.status || '').toLowerCase() === 'paid';
                    const isOverdue = (inv.status || '').toLowerCase() === 'overdue';
                    const amountFormatted = Number(inv.amount || 0).toLocaleString();
                    
                    if (isPaid) {
                        await pool.query(
                            'INSERT INTO notifications (type, title, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [
                                'payment',
                                'Lease Payment Received',
                                `Payment of £${amountFormatted} confirmed for ${inv.invoice_number}${inv.tenant_name ? ` (${inv.tenant_name})` : ''}`,
                                '/admin/invoices',
                                0,
                                inv.paid_date || inv.created_at || new Date()
                            ]
                        );
                    } else if (isOverdue) {
                        await pool.query(
                            'INSERT INTO notifications (type, title, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [
                                'invoice',
                                `Invoice Overdue: #${inv.invoice_number}`,
                                `Overdue amount £${amountFormatted} for ${inv.tenant_name || 'Tenant'}`,
                                '/admin/invoices',
                                0,
                                inv.created_at || new Date()
                            ]
                        );
                    } else {
                        await pool.query(
                            'INSERT INTO notifications (type, title, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [
                                'invoice',
                                `New Invoice Generated: #${inv.invoice_number}`,
                                `Invoice of £${amountFormatted} issued for ${inv.tenant_name || 'Tenant'}`,
                                '/admin/invoices',
                                0,
                                inv.created_at || new Date()
                            ]
                        );
                    }
                }
            } catch (err) {
                console.error('[NOTIFICATIONS SEED] Invoices seed error:', err.message);
            }

            // 3. Existing Activity Logs (Properties created)
            try {
                const [activities] = await pool.query(`
                    SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 5
                `);
                for (const act of activities) {
                    const isProp = (act.action || '').toLowerCase().includes('property');
                    await pool.query(
                        'INSERT INTO notifications (type, title, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                        [
                            isProp ? 'property' : 'system',
                            act.action || 'System Event',
                            act.details || 'Operational record updated',
                            isProp ? '/admin/properties' : '/admin/dashboard',
                            0,
                            act.timestamp || new Date()
                        ]
                    );
                }
            } catch (err) {
                console.error('[NOTIFICATIONS SEED] Activity logs seed error:', err.message);
            }

            // 4. Default system backup completed notification
            try {
                await pool.query(
                    'INSERT INTO notifications (type, title, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        'system',
                        'System Backup Completed',
                        'Database snapshots & live monitoring verified',
                        '/admin/dashboard',
                        1,
                        new Date(Date.now() - 5 * 3600 * 1000)
                    ]
                );
            } catch (err) {
                console.error('[NOTIFICATIONS SEED] System notif seed error:', err.message);
            }

            console.log('[NOTIFICATIONS] Initial notifications created successfully.');
        }
    } catch (error) {
        console.error('[NOTIFICATIONS INIT ERROR]', error.message);
    }
};

/**
 * Add a new notification
 */
const createNotification = async ({ user_id = null, type, title, message, link = null, is_read = 0 }) => {
    try {
        const [result] = await pool.query(
            'INSERT INTO notifications (user_id, type, title, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [user_id, type, title, message, link, is_read]
        );
        return { success: true, id: result.insertId };
    } catch (error) {
        console.error('[CREATE NOTIFICATION ERROR]', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Get notifications for a user/admin
 */
const getNotifications = async ({ userId, role, limit = 40 }) => {
    try {
        let query = 'SELECT * FROM notifications';
        let params = [];

        if (role === 'manager') {
            query += ' WHERE (user_id = ? OR user_id IS NULL)';
            params.push(userId);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(Number(limit) || 40);

        const [rows] = await pool.query(query, params);

        // Calculate unread count
        let countQuery = 'SELECT COUNT(*) as unread_count FROM notifications WHERE is_read = 0';
        let countParams = [];
        if (role === 'manager') {
            countQuery += ' AND (user_id = ? OR user_id IS NULL)';
            countParams.push(userId);
        }
        const [countRows] = await pool.query(countQuery, countParams);
        const unreadCount = countRows[0]?.unread_count || 0;

        // Augment rows with relative time
        const formattedRows = rows.map(item => ({
            ...item,
            time: formatRelativeTime(item.created_at)
        }));

        return {
            success: true,
            data: formattedRows,
            unreadCount
        };
    } catch (error) {
        console.error('[GET NOTIFICATIONS ERROR]', error.message);
        throw error;
    }
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async ({ userId, role }) => {
    try {
        let query = 'UPDATE notifications SET is_read = 1 WHERE is_read = 0';
        let params = [];

        if (role === 'manager') {
            query += ' AND (user_id = ? OR user_id IS NULL)';
            params.push(userId);
        }

        const [result] = await pool.query(query, params);
        return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
        console.error('[MARK ALL READ ERROR]', error.message);
        throw error;
    }
};

/**
 * Mark a single notification as read
 */
const markAsRead = async ({ id, userId, role }) => {
    try {
        let query = 'UPDATE notifications SET is_read = 1 WHERE id = ?';
        let params = [id];

        if (role === 'manager') {
            query += ' AND (user_id = ? OR user_id IS NULL)';
            params.push(userId);
        }

        const [result] = await pool.query(query, params);
        return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
        console.error('[MARK READ ERROR]', error.message);
        throw error;
    }
};

module.exports = {
    initNotificationsTable,
    createNotification,
    getNotifications,
    markAllAsRead,
    markAsRead
};
