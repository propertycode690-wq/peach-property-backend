const pool = require('./src/config/db');

async function run() {
    try {
        console.log('--- Running Migration for Notes Columns ---');

        // 1. Check properties.notes
        const [propCols] = await pool.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'notes'"
        );
        if (propCols.length === 0) {
            await pool.query('ALTER TABLE properties ADD COLUMN notes TEXT NULL');
            console.log('✅ Added column `notes` to `properties` table.');
        } else {
            console.log('ℹ️ Column `notes` already exists in `properties` table.');
        }

        // 2. Check tenants.notes
        const [tenantCols] = await pool.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'notes'"
        );
        if (tenantCols.length === 0) {
            await pool.query('ALTER TABLE tenants ADD COLUMN notes TEXT NULL');
            console.log('✅ Added column `notes` to `tenants` table.');
        } else {
            console.log('ℹ️ Column `notes` already exists in `tenants` table.');
        }

        console.log('--- Migration Completed Successfully ---');
    } catch (e) {
        console.error('❌ Migration error:', e.message);
    } finally {
        process.exit();
    }
}

run();
