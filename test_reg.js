const fetch = require('node-fetch');

async function testRegistration() {
  const baseUrl = 'http://localhost:5000/api';
  
  // 1. Test Student Registration
  console.log('--- Testing Student Registration ---');
  const studentData = {
    student_id: 'TEST_S_001',
    first_name: 'Test',
    last_name: 'Student',
    email: 'test_s@example.com',
    department_id: 1,
    cgpa: 8.5,
    year_of_passing: 2025,
    password: 'password123'
  };
  
  try {
    const res1 = await fetch(`${baseUrl}/auth/register-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    });
    const data1 = await res1.json();
    console.log('Student Registration:', data1);
  } catch (err) { console.error('Student Reg Error:', err.message); }

  // 2. Test Admin Registration
  console.log('\n--- Testing Admin Registration ---');
  const adminData = {
    name: 'Test Admin',
    email: 'test_a@example.com',
    admin_code: 'CPMS_2024_ADMIN',
    password: 'password123'
  };
  
  try {
    const res2 = await fetch(`${baseUrl}/auth/register-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminData)
    });
    const data2 = await res2.json();
    console.log('Admin Registration:', data2);
  } catch (err) { console.error('Admin Reg Error:', err.message); }
}

testRegistration();
