const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET /api/utils/departments  (Public)
router.get('/departments', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT department_id, dept_code, dept_name FROM departments ORDER BY dept_name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
