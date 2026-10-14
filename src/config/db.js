const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// Test connection
pool.getConnection()
    .then(connection => {
        console.log('✅ MySQL Database Connected Successfully!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Error connecting to MySQL: ', err);
    });

module.exports = pool;
