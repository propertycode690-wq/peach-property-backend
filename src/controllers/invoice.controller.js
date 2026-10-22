const pool = require('../config/db');
const { sendEmail, sendSMS } = require('../config/notifications');

const fmtAmt = (n) => Number(n || 0).toLocaleString();

// @desc    Get all invoices
const getInvoices = async (req, res) => {
    try {
        let query = `SELECT i.*, t.full_name as tenant_name, t.email as tenant_email, t.phone as tenant_phone
                     FROM invoices i 
                     LEFT JOIN tenants t ON i.tenant_id = t.id`;
        let params = [];
        if (req.user.role === 'manager') {
            query += ' WHERE i.added_by = ?';
            params.push(req.user.id);
        }
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create Invoice
const createInvoice = async (req, res) => {
    const { invoice_number, tenant_id, lease_id, amount, due_date, status, type, paid_amount } = req.body;
    let pAmt = paid_amount || 0;
    const isPaid = (status || '').toLowerCase() === 'paid';
    if (isPaid && !paid_amount) pAmt = amount;
    const paid_date = isPaid ? new Date() : null;
    const invoiceType = type || 'Rent';
    try {
        const [result] = await pool.query(
            'INSERT INTO invoices (invoice_number, tenant_id, lease_id, amount, due_date, status, paid_date, type, paid_amount, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [invoice_number, tenant_id, lease_id, amount, due_date, status, paid_date, invoiceType, pAmt, req.user.id]
        );

        // Fetch tenant for notification
        const [tenant] = await pool.query('SELECT full_name, email, phone FROM tenants WHERE id = ?', [tenant_id]);
        if (tenant.length > 0) {
            const t = tenant[0];
            const msg = `Hello ${t.full_name}, a new invoice #${invoice_number} for ${invoiceType} has been generated. Amount: EUR €${fmtAmt(amount)}. Due Date: ${due_date}. Please settle by the due date.`;

            if (t.email) sendEmail(t.email, `New Invoice Issued - #${invoice_number}`, `<h1>New Invoice</h1><p>${msg}</p>`);
            if (t.phone) sendSMS(t.phone, msg);
        }

        // Dynamic system notification
        const { createNotification } = require('../services/notificationService');
        createNotification({
            type: 'invoice',
            title: 'New Invoice Issued',
            message: `Invoice #${invoice_number} for EUR €${fmtAmt(amount)} generated (${invoiceType})`,
            link: '/admin/invoices',
            user_id: null
        }).catch(e => console.error('[NOTIF ERROR]', e.message));

        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Invoice Status
const updateInvoice = async (req, res) => {
    const { id } = req.params;
    const { status, paid_date, paid_amount, amount_paid, payment_method, reference, notes } = req.body;
    try {
        // Get old data for comparison
        const [oldInv] = await pool.query('SELECT status, invoice_number, tenant_id, paid_amount, amount FROM invoices WHERE id = ?', [id]);
        if (oldInv.length === 0) return res.status(404).json({ success: false, message: 'Invoice not found' });

        let query = 'UPDATE invoices SET status=?, paid_date=?, paid_amount=? WHERE id=?';
        let params = [status, paid_date, paid_amount, id];
        if (req.user.role === 'manager') {
            query += ' AND added_by=?';
            params.push(req.user.id);
        }
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Invoice not found' });

        // Calculate incremental payment amount
        const oldPaid = Number(oldInv[0].paid_amount || 0);
        const newPaid = Number(paid_amount || 0);
        const incrementalAmt = amount_paid !== undefined && amount_paid !== null 
            ? Number(amount_paid) 
            : (newPaid > oldPaid ? (newPaid - oldPaid) : (status === 'Paid' ? (Number(oldInv[0].amount) - oldPaid) : 0));

        // Insert audit record into payment_history if status is Paid or Partial and payment occurred
        if ((status === 'Paid' || status === 'Partial') && incrementalAmt > 0) {
            const payDate = paid_date || new Date().toISOString().split('T')[0];
            const payMethod = (typeof payment_method === 'string' && payment_method.trim() !== '') ? payment_method.trim() : 'Bank Transfer';
            const payRef = (typeof reference === 'string' && reference.trim() !== '') ? reference.trim() : null;
            const payNotes = (typeof notes === 'string' && notes.trim() !== '') ? notes.trim() : null;

            await pool.query(
                `INSERT INTO payment_history (invoice_id, amount_paid, payment_date, payment_method, reference, notes, recorded_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, incrementalAmt, payDate, payMethod, payRef, payNotes, req.user?.id || null]
            );

            // Dynamic system notification for payment
            const { createNotification } = require('../services/notificationService');
            createNotification({
                type: 'payment',
                title: status === 'Paid' ? 'Lease Payment Received' : 'Partial Payment Received',
                message: `Payment of EUR €${fmtAmt(incrementalAmt)} recorded for Invoice #${oldInv[0].invoice_number}`,
                link: '/admin/invoices',
                user_id: null
            }).catch(e => console.error('[NOTIF ERROR]', e.message));
        }

        // If marked as Paid, send receipt
        if (status === 'Paid' && oldInv[0].status !== 'Paid') {
            const [tenant] = await pool.query('SELECT full_name, email, phone FROM tenants WHERE id = ?', [oldInv[0].tenant_id]);
            if (tenant.length > 0) {
                const t = tenant[0];
                const msg = `Thank you ${t.full_name}. We have received your payment for Invoice #${oldInv[0].invoice_number}. Your balance is now cleared.`;
                if (t.email) sendEmail(t.email, `Payment Received - Receipt #${oldInv[0].invoice_number}`, `<h1>Payment Confirmation</h1><p>${msg}</p>`);
                if (t.phone) sendSMS(t.phone, msg);
            }
        }

        res.json({ success: true, message: 'Invoice updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Manual Send Notification
const sendInvoiceNotification = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT i.*, t.full_name, t.email, t.phone 
            FROM invoices i 
            JOIN tenants t ON i.tenant_id = t.id 
            WHERE i.id = ?`, [id]);

        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Invoice not found' });

        const inv = rows[0];
        const msg = `Reminder: Invoice #${inv.invoice_number} is ${inv.status}. Amount: EUR €${fmtAmt(inv.amount)}. Due Date: ${inv.due_date}. Please pay to avoid late fees.`;

        let emailSent = false, smsSent = false;
        if (inv.email) {
            await sendEmail(inv.email, `Payment Reminder - Invoice #${inv.invoice_number}`, `<h1>Invoice Reminder</h1><p>${msg}</p>`);
            emailSent = true;
        }
        if (inv.phone) {
            await sendSMS(inv.phone, msg);
            smsSent = true;
        }

        res.json({ success: true, message: `Notification sent! (Email: ${emailSent ? 'Yes' : 'No'}, SMS: ${smsSent ? 'Yes' : 'No'})` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get payment history for an invoice
const getInvoicePayments = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT ph.*, u.name as recorded_by_name 
             FROM payment_history ph
             LEFT JOIN users u ON ph.recorded_by = u.id
             WHERE ph.invoice_id = ?
             ORDER BY ph.payment_date DESC, ph.id DESC`,
            [id]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Invoice
const deleteInvoice = async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? 'DELETE FROM invoices WHERE id=?' : 'DELETE FROM invoices WHERE id=? AND added_by=?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Invoice not found' });
        res.json({ success: true, message: 'Invoice deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getInvoices, createInvoice, updateInvoice, deleteInvoice, sendInvoiceNotification, getInvoicePayments };
