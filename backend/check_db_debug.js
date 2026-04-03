const mysql = require('mysql2');
const path = require('path');
require('dotenv').config();

async function check() {
  console.log('Connecting to:', process.env.DB_HOST);
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    ssl: { rejectUnauthorized: false }
  });

  const connection = pool.promise();

  try {
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables found:', tables.length);

    for (const table of tables) {
      const tableName = Object.values(table)[0];
      const [count] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`Table ${tableName}: ${count[0].count} rows`);
    }
  } catch (err) {
    console.error('Error querying DB:', err.message);
  } finally {
    await pool.end();
  }
}

check().catch(err => {
  console.error('Connection failed:', err.message);
});
