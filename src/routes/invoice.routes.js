const express = require('express');
const router = express.Router();
const { 
    getInvoices, 
    createInvoice, 
    updateInvoice, 
    deleteInvoice, 
    sendInvoiceNotification,
    getInvoicePayments 
} = require('../controllers/invoice.controller');
const { protect } = require('../middleware/auth');
const { validateInvoice } = require('../middleware/validate');

router.route('/')
    .get(protect, getInvoices)
    .post(protect, validateInvoice, createInvoice);

router.post('/:id/notify', protect, sendInvoiceNotification);
router.get('/:id/payments', protect, getInvoicePayments);

router.route('/:id')
    .put(protect, updateInvoice)
    .delete(protect, deleteInvoice);

module.exports = router;
