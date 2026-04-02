const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/analytics/dashboard
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const [[studentCounts]] = await db.query(
      `SELECT COUNT(*) AS total, SUM(placed) AS placed, SUM(!placed) AS unplaced FROM students`
    );
    const [[companyCounts]] = await db.query(
      `SELECT COUNT(*) AS total FROM companies`
    );
    const [[offerStats]] = await db.query(
      `SELECT COUNT(*) AS total, SUM(accepted) AS accepted,
              ROUND(AVG(ctc),2) AS avg_ctc, MAX(ctc) AS max_ctc FROM offers`
    );
    const [appByStatus] = await db.query(
      `SELECT status, COUNT(*) AS count FROM applications GROUP BY status`
    );
    const [deptPlacement] = await db.query(
      `SELECT d.dept_code, COUNT(*) AS total, SUM(s.placed) AS placed,
              ROUND(SUM(s.placed)*100.0/COUNT(*),1) AS pct
       FROM students s JOIN departments d ON s.department_id=d.department_id
       GROUP BY d.dept_code ORDER BY pct DESC`
    );
    const [topCompanies] = await db.query(
      `SELECT c.company_name, COUNT(o.offer_id) AS offers, ROUND(AVG(o.ctc),2) AS avg_ctc
       FROM companies c
       JOIN drives d ON c.company_id=d.company_id
       JOIN applications a ON d.drive_id=a.drive_id
       JOIN offers o ON a.application_id=o.application_id
       GROUP BY c.company_id ORDER BY offers DESC LIMIT 5`
    );
    const [recentOffers] = await db.query(
      `SELECT o.offer_id, o.ctc, o.offer_date,
              CONCAT(s.first_name,' ',s.last_name) AS student_name,
              c.company_name, d.role
       FROM offers o
       JOIN applications a ON o.application_id=a.application_id
       JOIN students s ON a.student_id=s.student_id
       JOIN drives d ON a.drive_id=d.drive_id
       JOIN companies c ON d.company_id=c.company_id
       ORDER BY o.created_at DESC LIMIT 8`
    );

    res.json({
      success: true,
      data: {
        students: { ...studentCounts, placement_rate: Number(((studentCounts.placed / studentCounts.total) * 100).toFixed(1)) },
        companies: companyCounts,
        offers: offerStats,
        applicationsByStatus: appByStatus,
        departmentPlacements: deptPlacement,
        topCompanies,
        recentOffers
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/analytics/ctc-distribution
router.get('/ctc-distribution', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         SUM(ctc < 8)              AS below_8,
         SUM(ctc BETWEEN 8 AND 12)  AS r8_12,
         SUM(ctc BETWEEN 12 AND 18) AS r12_18,
         SUM(ctc BETWEEN 18 AND 25) AS r18_25,
         SUM(ctc BETWEEN 25 AND 35) AS r25_35,
         SUM(ctc > 35)              AS above_35
       FROM offers`
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/analytics/monthly-placements
router.get('/monthly-placements', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(offer_date,'%b %Y') AS month,
              COUNT(*) AS count, ROUND(AVG(ctc),2) AS avg_ctc
       FROM offers
       GROUP BY YEAR(offer_date), MONTH(offer_date)
       ORDER BY YEAR(offer_date), MONTH(offer_date)
       LIMIT 12`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
