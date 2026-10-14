const pool = require('./src/config/db');

async function run() {
    try {
        await pool.query("UPDATE invoices SET paid_amount = amount WHERE status = 'Paid' AND paid_amount = 0");
        console.log("Migration successful: fixed paid_amount for existing Paid invoices.");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
