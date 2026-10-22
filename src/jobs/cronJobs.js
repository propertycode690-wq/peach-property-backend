/**
 * cronJobs.js — Automated Reminder & Maintenance Jobs
 * Runs on server startup
 * 
 * Jobs:
 *  1. daily_reminders  — 8:00 AM every day
 *     - Lease expiry alerts (90 / 60 / 30 days before)
 *     - Rent review alerts (60 / 30 days before)
 *     - Break clause alerts (30 days before)
 *  2. mark_overdue     — 12:00 AM (midnight) every day
 *     - Auto marks invoices as Overdue if past due_date + grace period
 *
 * Uses reminder_logs to prevent duplicate sends
 * Uses cron_logs to record every run
 */

const cron = require('node-cron');
const pool = require('../config/db');
const { sendEmail, sendSMS } = require('../config/notifications');

// ─── Helper: Log cron run ────────────────────────────────────────
const logCronRun = async (jobName, status, message, recordsProcessed = 0) => {
    try {
        await pool.query(
            'INSERT INTO cron_logs (job_name, status, message, records_processed) VALUES (?, ?, ?, ?)',
            [jobName, status, message, recordsProcessed]
        );
    } catch (e) {
        console.error('[CRON LOG ERROR]', e.message);
    }
};

// ─── Helper: Check if reminder already sent ──────────────────────
const wasReminderSent = async (type, referenceId, daysBefore) => {
    const [rows] = await pool.query(
        'SELECT id FROM reminder_logs WHERE type = ? AND reference_id = ? AND days_before = ?',
        [type, referenceId, daysBefore]
    );
    return rows.length > 0;
};

// ─── Helper: Mark reminder as sent ──────────────────────────────
const markReminderSent = async (type, referenceId, daysBefore, sentTo) => {
    await pool.query(
        'INSERT IGNORE INTO reminder_logs (type, reference_id, days_before, sent_to) VALUES (?, ?, ?, ?)',
        [type, referenceId, daysBefore, sentTo]
    );
};

// ─── Helper: Get notification settings ──────────────────────────
const getNotifSettings = async () => {
    const [rows] = await pool.query('SELECT * FROM notification_settings WHERE id = 1');
    if (rows.length === 0) return {
        lease_expiry_days: '90,60,30',
        rent_review_days: '60,30',
        overdue_grace_days: 3,
        email_enabled: 1,
        sms_enabled: 0,
        notify_admin_email: null,
    };
    return rows[0];
};

// ─── Helper: Days difference from today ─────────────────────────
const daysFromToday = (dateStr) => {
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

// ─── Send notification helper ────────────────────────────────────
const notify = async (settings, email, phone, subject, htmlBody, smsText) => {
    if (settings.email_enabled && email) {
        await sendEmail(email, subject, htmlBody).catch(e => console.error('[EMAIL ERR]', e.message));
    }
    if (settings.sms_enabled && phone) {
        await sendSMS(phone, smsText).catch(e => console.error('[SMS ERR]', e.message));
    }
    // Always notify admin if set
    if (settings.notify_admin_email && settings.email_enabled) {
        await sendEmail(settings.notify_admin_email, `[ADMIN COPY] ${subject}`, htmlBody)
            .catch(e => console.error('[ADMIN EMAIL ERR]', e.message));
    }
};

// ═══════════════════════════════════════════════════════════════
// JOB 1: DAILY REMINDERS — runs at 8:00 AM every day
// ═══════════════════════════════════════════════════════════════
const runDailyReminders = async () => {
    console.log('[CRON] Running daily_reminders job...');
    const settings = await getNotifSettings();
    const leaseExpiryDays = (settings.lease_expiry_days || '90,60,30').split(',').map(Number);
    const rentReviewDays  = (settings.rent_review_days  || '60,30').split(',').map(Number);
    let processed = 0;

    try {
        // ── 1A: Lease Expiry Reminders ──────────────────────────
        const [activeLeases] = await pool.query(`
            SELECT l.id, l.end_date, l.monthly_rent, l.break_clause_date, l.rent_review_date,
                   t.full_name, t.email, t.phone, p.name as property_name
            FROM leases l
            JOIN tenants t ON l.tenant_id = t.id
            JOIN properties p ON l.property_id = p.id
            WHERE l.status = 'active'
        `);

        for (const lease of activeLeases) {
            const daysLeft = daysFromToday(lease.end_date);

            // Lease expiry check
            for (const threshold of leaseExpiryDays) {
                if (daysLeft === threshold) {
                    const alreadySent = await wasReminderSent('lease_expiry', lease.id, threshold);
                    if (!alreadySent) {
                        const subject = `Lease Expiry Notice — ${threshold} Days Remaining`;
                        const html = `
                            <h2>Lease Expiry Reminder</h2>
                            <p>Dear <strong>${lease.full_name}</strong>,</p>
                            <p>Your lease for <strong>${lease.property_name}</strong> will expire in 
                               <strong>${threshold} days</strong> on <strong>${lease.end_date}</strong>.</p>
                            <p>Monthly Rent: <strong>EUR €${Number(lease.monthly_rent).toLocaleString()}</strong></p>
                            <p>Please contact your landlord to discuss renewal options.</p>
                            <br><p>Property & Lease</p>
                        `;
                        const sms = `LEASE REMINDER: Your lease at ${lease.property_name} expires in ${threshold} days (${lease.end_date}). Contact your landlord to discuss renewal.`;

                        await notify(settings, lease.email, lease.phone, subject, html, sms);
                        await markReminderSent('lease_expiry', lease.id, threshold, lease.email);
                        processed++;
                        console.log(`[CRON] Lease expiry reminder sent: lease #${lease.id}, ${threshold} days`);

                        // System notification
                        const { createNotification } = require('../services/notificationService');
                        createNotification({
                            type: 'reminder',
                            title: `Lease Expiry (${threshold} Days)`,
                            message: `Lease for ${lease.full_name} (${lease.property_name}) expires in ${threshold} days`,
                            link: '/admin/leases'
                        }).catch(e => console.error('[NOTIF ERROR]', e.message));
                    }
                }
            }

            // Break clause check (30 days before)
            if (lease.break_clause_date) {
                const bcDays = daysFromToday(lease.break_clause_date);
                if (bcDays === 30) {
                    const alreadySent = await wasReminderSent('break_clause', lease.id, 30);
                    if (!alreadySent) {
                        const subject = `Break Clause Notice — ${lease.property_name}`;
                        const html = `
                            <h2>Break Clause Reminder</h2>
                            <p>Dear <strong>${lease.full_name}</strong>,</p>
                            <p>The break clause for your lease at <strong>${lease.property_name}</strong> 
                               is in <strong>30 days</strong> on <strong>${lease.break_clause_date}</strong>.</p>
                            <p>Please advise if you intend to exercise this clause.</p>
                            <br><p>Property & Lease</p>
                        `;
                        const sms = `BREAK CLAUSE: Your break clause date at ${lease.property_name} is in 30 days (${lease.break_clause_date}).`;
                        await notify(settings, lease.email, lease.phone, subject, html, sms);
                        await markReminderSent('break_clause', lease.id, 30, lease.email);
                        processed++;
                    }
                }
            }

            // Rent review check
            if (lease.rent_review_date) {
                const rrDays = daysFromToday(lease.rent_review_date);
                for (const threshold of rentReviewDays) {
                    if (rrDays === threshold) {
                        const alreadySent = await wasReminderSent('rent_review', lease.id, threshold);
                        if (!alreadySent) {
                            const subject = `Rent Review Upcoming — ${threshold} Days Notice`;
                            const html = `
                                <h2>Rent Review Notice</h2>
                                <p>Dear <strong>${lease.full_name}</strong>,</p>
                                <p>A rent review for your tenancy at <strong>${lease.property_name}</strong> 
                                   is scheduled in <strong>${threshold} days</strong> on 
                                   <strong>${lease.rent_review_date}</strong>.</p>
                                <p>Current Monthly Rent: <strong>EUR €${Number(lease.monthly_rent).toLocaleString()}</strong></p>
                                <p>Your landlord will be in touch regarding any adjustments.</p>
                                <br><p>Property & Lease</p>
                            `;
                            const sms = `RENT REVIEW: Your rent review at ${lease.property_name} is in ${threshold} days (${lease.rent_review_date}). Current rent: EUR €${Number(lease.monthly_rent).toLocaleString()}.`;
                            await notify(settings, lease.email, lease.phone, subject, html, sms);
                            await markReminderSent('rent_review', lease.id, threshold, lease.email);
                            processed++;
                            console.log(`[CRON] Rent review reminder sent: lease #${lease.id}, ${threshold} days`);
                        }
                    }
                }
            }
        }

        await logCronRun('daily_reminders', 'success', `Processed ${processed} reminders`, processed);
        console.log(`[CRON] daily_reminders done — ${processed} reminders sent`);

    } catch (err) {
        console.error('[CRON] daily_reminders FAILED:', err.message);
        await logCronRun('daily_reminders', 'error', err.message, 0);
    }
};

// ═══════════════════════════════════════════════════════════════
// JOB 2: MARK OVERDUE INVOICES — runs at midnight every day
// ═══════════════════════════════════════════════════════════════
const runMarkOverdue = async () => {
    console.log('[CRON] Running mark_overdue job...');
    try {
        const settings = await getNotifSettings();
        const graceDays = settings.overdue_grace_days || 3;

        // Mark Unpaid invoices as Overdue if past due_date + grace period
        const [result] = await pool.query(`
            UPDATE invoices
            SET status = 'Overdue'
            WHERE status = 'Unpaid'
              AND due_date < DATE_SUB(CURDATE(), INTERVAL ? DAY)
        `, [graceDays]);

        const affected = result.affectedRows;
        console.log(`[CRON] mark_overdue done — ${affected} invoices marked Overdue`);
        await logCronRun('mark_overdue', 'success', `${affected} invoices marked Overdue`, affected);

        if (affected > 0) {
            const { createNotification } = require('../services/notificationService');
            createNotification({
                type: 'invoice',
                title: 'Invoices Overdue Alert',
                message: `${affected} invoice(s) marked Overdue past grace period`,
                link: '/admin/invoices'
            }).catch(e => console.error('[NOTIF ERROR]', e.message));
        }

    } catch (err) {
        console.error('[CRON] mark_overdue FAILED:', err.message);
        await logCronRun('mark_overdue', 'error', err.message, 0);
    }
};

// ═══════════════════════════════════════════════════════════════
// START CRON JOBS
// ═══════════════════════════════════════════════════════════════

// Daily reminders at 8:00 AM every day
cron.schedule('0 8 * * *', runDailyReminders, {
    timezone: 'Europe/London', // UK landlord — change if needed
});

// Mark overdue at midnight (00:00) every day
cron.schedule('0 0 * * *', runMarkOverdue, {
    timezone: 'Europe/London',
});

console.log('[CRON] Jobs registered: daily_reminders (8:00 AM), mark_overdue (12:00 AM) — Europe/London timezone');

// Export for manual trigger (testing)
module.exports = { runDailyReminders, runMarkOverdue };
