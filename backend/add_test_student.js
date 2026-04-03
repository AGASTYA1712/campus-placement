const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function addTestStudent() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    ssl: { rejectUnauthorized: false }
  });

  const connection = pool.promise();
  const hash = await bcrypt.hash('password', 10);

  try {
    const student_id = '21CSE001';
    const email = 'test@example.com';
    
    // Check if exists
    const [existing] = await connection.query('SELECT * FROM students WHERE student_id=?', [student_id]);
    if (existing.length) {
      console.log('✅ Student 21CSE001 already exists.');
      return;
    }

    await connection.query(
      `INSERT INTO students (student_id, first_name, last_name, email, phone, department_id, cgpa, backlogs, year_of_passing, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, 'Test', 'Student', email, '1234567890', 1, 9.0, 0, 2025, hash]
    );
    console.log('✅ Test student added successfully!');
  } catch (err) {
    console.error('❌ Error adding student:', err.message);
  } finally {
    await pool.end();
  }
}

addTestStudent();
