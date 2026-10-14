const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');

/**
 * Fetch dynamic config from DB with .env fallback
 */
const getConfig = async () => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
        const dbConfig = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

        return {
            smtp_host: dbConfig.smtp_host || process.env.SMTP_HOST,
            smtp_port: dbConfig.smtp_port || process.env.SMTP_PORT,
            smtp_user: dbConfig.smtp_email || process.env.SMTP_USER,
            smtp_pass: dbConfig.smtp_pass || process.env.SMTP_PASS,
            twilio_sid: dbConfig.twilio_sid || process.env.TWILIO_ACCOUNT_SID,
            twilio_token: dbConfig.twilio_token || process.env.TWILIO_AUTH_TOKEN,
            twilio_phone: dbConfig.twilio_phone || process.env.TWILIO_PHONE_NUMBER,
        };
    } catch (e) {
        console.error('Config fetch error, using .env fallback');
        return {
            smtp_host: process.env.SMTP_HOST,
            smtp_port: process.env.SMTP_PORT,
            smtp_user: process.env.SMTP_USER,
            smtp_pass: process.env.SMTP_PASS,
            twilio_sid: process.env.TWILIO_ACCOUNT_SID,
            twilio_token: process.env.TWILIO_AUTH_TOKEN,
            twilio_phone: process.env.TWILIO_PHONE_NUMBER,
        };
    }
};

/**
 * Send Email Notification
 */
const sendEmail = async (to, subject, html) => {
    const cfg = await getConfig();
    try {
        const transporter = nodemailer.createTransport({
            host: cfg.smtp_host,
            port: cfg.smtp_port,
            secure: cfg.smtp_port == 465,
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
        });

        const info = await transporter.sendMail({
            from: `"Property & Lease" <${cfg.smtp_user}>`,
            to,
            subject,
            html,
        });
        console.log('Email sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send SMS Notification
 */
const sendSMS = async (to, body) => {
    const cfg = await getConfig();
    try {
        const client = twilio(cfg.twilio_sid, cfg.twilio_token);
        const message = await client.messages.create({
            body,
            from: cfg.twilio_phone,
            to,
        });
        console.log('SMS sent: %s', message.sid);
        return { success: true, sid: message.sid };
    } catch (error) {
        console.error('SMS Error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail, sendSMS };
