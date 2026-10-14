/**
 * validate.js — Input Validation Middleware
 * Reusable validators — koi external library nahi
 * Usage: validate(rules)(req, res, next)
 */

const validate = (rules) => (req, res, next) => {
    const errors = [];

    for (const [field, checks] of Object.entries(rules)) {
        const value = req.body[field];
        const strVal = (value !== undefined && value !== null) ? String(value).trim() : '';

        // required
        if (checks.required && (value === undefined || value === null || strVal === '')) {
            errors.push(`${field} is required`);
            continue; // skip further checks for this field if missing
        }
        // skip optional empty fields
        if (!checks.required && strVal === '') continue;

        // email
        if (checks.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
            errors.push(`${field} must be a valid email`);
        }

        // min length
        if (checks.minLength && strVal.length < checks.minLength) {
            errors.push(`${field} must be at least ${checks.minLength} characters`);
        }

        // max length
        if (checks.maxLength && strVal.length > checks.maxLength) {
            errors.push(`${field} must not exceed ${checks.maxLength} characters`);
        }

        // numeric (positive number)
        if (checks.numeric) {
            const num = Number(value);
            if (isNaN(num) || num <= 0) {
                errors.push(`${field} must be a positive number`);
            }
        }

        // integer
        if (checks.integer) {
            const num = Number(value);
            if (!Number.isInteger(num) || num < 0) {
                errors.push(`${field} must be a non-negative integer`);
            }
        }

        // date format YYYY-MM-DD (or ISO string)
        if (checks.date) {
            const d = new Date(strVal);
            if (isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}/.test(strVal)) {
                errors.push(`${field} must be a valid date (YYYY-MM-DD)`);
            }
        }

        // enum — value must be one of allowed values (case-insensitive check + auto-normalization)
        if (checks.enum) {
            const match = checks.enum.find(e => String(e).toLowerCase() === strVal.toLowerCase());
            if (!match) {
                errors.push(`${field} must be one of: ${checks.enum.join(', ')}`);
            } else {
                req.body[field] = match; // Normalize to standard case
            }
        }

        // phone — digits, spaces, +, dashes, min 7 chars
        if (checks.phone && !/^[\d\s\+\-\(\)\.]{7,25}$/.test(strVal)) {
            errors.push(`${field} must be a valid phone number`);
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors[0], errors });
    }
    next();
};

// ─── Pre-built rule sets ────────────────────────────────────────

const validateLogin = validate({
    email:    { required: true, email: true },
    password: { required: true, minLength: 6 },
});

const validateTenant = validate({
    full_name:   { required: true, minLength: 2, maxLength: 150 },
    email:       { required: true, email: true },
    phone:       { required: true, phone: true },
    property_id: { required: true, integer: true },
});

const validateLease = validate({
    tenant_id:    { required: true, integer: true },
    property_id:  { required: true, integer: true },
    start_date:   { required: true, date: true },
    end_date:     { required: true, date: true },
    monthly_rent: { required: true, numeric: true },
});

const validateInvoice = validate({
    tenant_id: { required: true, integer: true },
    lease_id:  { required: false, integer: true },
    amount:    { required: true, numeric: true },
    due_date:  { required: true, date: true },
    type:      { required: false, enum: ['Rent', 'Deposit'] },
    status:    { required: false, enum: ['Unpaid', 'Paid', 'Overdue', 'Partial'] },
});

const validateExpense = validate({
    property_id:  { required: true, integer: true },
    amount:       { required: true, numeric: true },
    expense_date: { required: true, date: true },
});

const validateMaintenance = validate({
    title:       { required: true, minLength: 3, maxLength: 200 },
    property_id: { required: true, integer: true },
    priority:    { required: false, enum: ['Low', 'Medium', 'High', 'Emergency'] },
    status:      { required: false, enum: ['pending', 'in_progress', 'resolved'] },
});

module.exports = {
    validate,
    validateLogin,
    validateTenant,
    validateLease,
    validateInvoice,
    validateExpense,
    validateMaintenance,
};
