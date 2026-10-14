const pool = require('./src/config/db');

async function run() {
    try {
        await pool.query("ALTER TABLE invoices MODIFY COLUMN status ENUM('Unpaid', 'Paid', 'Overdue', 'Partial') DEFAULT 'Unpaid'");
        await pool.query("ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0.00");
        console.log("Migration successful");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column already exists");
        } else {
            console.error(e);
        }
    } finally {
        process.exit();
    }
}
run();
