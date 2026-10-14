const pool = require('./src/config/db');

async function run() {
    try {
        await pool.query("ALTER TABLE invoices ADD COLUMN type ENUM('Rent', 'Deposit') DEFAULT 'Rent'");
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
