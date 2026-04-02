const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initDB() {
  console.log('Connecting to Railway MySQL...');
  console.log(`Host: ${process.env.DB_HOST}`);
  console.log(`Port: ${process.env.DB_PORT}`);
  console.log(`User: ${process.env.DB_USER}`);
  console.log(`DB: ${process.env.DB_NAME}`);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL');

    const schemaPath = path.join(__dirname, '../config/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying schema...');
    await connection.query(schemaSql);
    console.log('✅ Schema applied successfully');

    await connection.end();
    console.log('👋 Connection closed');
  } catch (err) {
    console.error('❌ Database Initialization failed:', err.message);
    process.exit(1);
  }
}

initDB();
