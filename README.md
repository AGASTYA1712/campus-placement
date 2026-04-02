# College Placement Management System (CPMS)

A full-stack web application for managing campus placements — students, companies, drives, applications, interviews, and offer letters.

---

## Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | HTML5, CSS3, Vanilla JS (fetch API)     |
| Backend   | Node.js + Express.js                    |
| Database  | MySQL 8.0+                              |
| Auth      | JWT (JSON Web Tokens) + bcrypt          |

---

## Project Structure

```
cpms/
├── backend/
│   ├── config/
│   │   ├── db.js           ← MySQL connection pool
│   │   └── schema.sql      ← Full DB schema + seed data
│   ├── middleware/
│   │   └── auth.js         ← JWT protect + adminOnly middleware
│   ├── routes/
│   │   ├── auth.js         ← Login (admin + student)
│   │   ├── students.js     ← CRUD + stats + applications
│   │   ├── companies.js    ← CRUD + offer summary
│   │   ├── drives.js       ← CRUD + eligibility check
│   │   ├── applications.js ← Apply + status update + pipeline
│   │   ├── offers.js       ← Offers + interviews
│   │   └── analytics.js    ← Dashboard + CTC dist + monthly
│   ├── server.js           ← Express app entry point
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── css/
    │   └── style.css       ← Full dark-theme design system
    ├── js/
    │   ├── api.js          ← Centralised API client (fetch wrapper)
    │   └── app.js          ← Page controllers + rendering
    ├── index.html          ← Main dashboard (all pages)
    ├── login.html          ← Login page (admin + student tabs)
    └── package.json
```

---

## Database Schema (9 Tables)

```
departments     — dept_id, dept_code, dept_name, hod_name
students        — student_id (PK), name, email, cgpa, backlogs, placed, department_id (FK)
skills          — skill_id, student_id (FK), skill_name, proficiency
companies       — company_id, company_name, sector, hr_email
drives          — drive_id, company_id (FK), role, ctc_min/max, min_cgpa, drive_date, dept_eligible
applications    — application_id, student_id (FK), drive_id (FK), status, applied_at
interviews      — interview_id, application_id (FK), round_no, type, score, result
offers          — offer_id, application_id (FK), ctc, offer_date, accepted
admins          — admin_id, name, email, password_hash, role
```

**Relationships:**
- `departments` 1──< `students` (one dept, many students)
- `students` 1──< `applications` (one student, many applications)
- `companies` 1──< `drives` (one company, many drives)
- `drives` 1──< `applications` (one drive, many applicants)
- `applications` 1──◇ `offers` (one application → one offer)
- `applications` 1──< `interviews` (one application, many interview rounds)
- `students` 1──< `skills` (one student, many skills)

---

## REST API Endpoints

### Auth
| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| POST   | /api/auth/login            | Admin login              |
| POST   | /api/auth/student-login    | Student login            |
| GET    | /api/auth/me               | Get current user (JWT)   |

### Students
| Method | Endpoint                          | Description           |
|--------|-----------------------------------|-----------------------|
| GET    | /api/students                     | List all (filterable) |
| GET    | /api/students/stats               | Placement statistics  |
| GET    | /api/students/:id                 | Single student        |
| POST   | /api/students                     | Create student        |
| PUT    | /api/students/:id                 | Update student        |
| DELETE | /api/students/:id                 | Delete student        |
| GET    | /api/students/:id/applications    | Student's applications|

### Companies
| Method | Endpoint              | Description        |
|--------|-----------------------|--------------------|
| GET    | /api/companies        | List all companies |
| GET    | /api/companies/:id    | Company + drives   |
| POST   | /api/companies        | Register company   |
| PUT    | /api/companies/:id    | Update company     |
| DELETE | /api/companies/:id    | Delete company     |

### Drives
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | /api/drives                 | List drives (filterable) |
| POST   | /api/drives                 | Create drive             |
| PUT    | /api/drives/:id             | Update drive             |
| GET    | /api/drives/:id/eligible    | Eligible students        |

### Applications
| Method | Endpoint                         | Description         |
|--------|----------------------------------|---------------------|
| GET    | /api/applications                | List all            |
| GET    | /api/applications/pipeline       | Status count summary|
| POST   | /api/applications                | Apply to drive      |
| PUT    | /api/applications/:id/status     | Update status       |

### Offers & Interviews
| Method | Endpoint                            | Description       |
|--------|-------------------------------------|-------------------|
| GET    | /api/offers                         | All offers        |
| GET    | /api/offers/stats                   | Offer analytics   |
| POST   | /api/offers                         | Create offer      |
| PUT    | /api/offers/:id/accept              | Accept offer      |
| GET    | /api/offers/interviews/:app_id      | Interview rounds  |
| POST   | /api/offers/interviews              | Add round         |
| PUT    | /api/offers/interviews/:id          | Update round      |

### Analytics
| Method | Endpoint                            | Description           |
|--------|-------------------------------------|-----------------------|
| GET    | /api/analytics/dashboard            | Full dashboard data   |
| GET    | /api/analytics/ctc-distribution     | CTC range buckets     |
| GET    | /api/analytics/monthly-placements   | Month-wise trend      |

---

## Setup & Installation

### Prerequisites
- Node.js ≥ 18
- MySQL 8.0+

### 1. Clone / extract the project
```bash
unzip cpms.zip
cd cpms
```

### 2. Set up the database
```bash
mysql -u root -p < backend/config/schema.sql
```

### 3. Configure backend
```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials
npm install
npm run dev
# API now running at http://localhost:5000
```

### 4. Run the frontend
```bash
cd ../frontend
npm install
npm start
# App now at http://localhost:1234
```

Or just open `frontend/index.html` directly in a browser — no build step needed if you update `js/api.js` BASE URL to your live API.

---

## Default Login

| Role        | Email              | Password  |
|-------------|--------------------|-----------|
| Admin       | admin@cpms.edu     | password  |

Student login uses Roll Number + password (default = roll number).

---

## Key SQL Queries

### Top offers by CTC
```sql
SELECT s.first_name, s.last_name, c.company_name, d.role, o.ctc
FROM offers o
JOIN applications a ON o.application_id = a.application_id
JOIN students s     ON a.student_id = s.student_id
JOIN drives d       ON a.drive_id = d.drive_id
JOIN companies c    ON d.company_id = c.company_id
ORDER BY o.ctc DESC LIMIT 10;
```

### Department-wise placement rate
```sql
SELECT dep.dept_code,
       COUNT(*) AS total,
       SUM(s.placed) AS placed,
       ROUND(SUM(s.placed)*100.0/COUNT(*), 2) AS placement_pct
FROM students s
JOIN departments dep ON s.department_id = dep.department_id
GROUP BY dep.dept_code
ORDER BY placement_pct DESC;
```

### Students eligible for a drive
```sql
SELECT s.student_id, s.first_name, s.last_name, s.cgpa
FROM students s
JOIN departments d ON s.department_id = d.department_id
WHERE s.cgpa >= ? AND s.backlogs <= ? AND s.placed = 0
  AND JSON_CONTAINS((SELECT dept_eligible FROM drives WHERE drive_id = ?), JSON_QUOTE(d.dept_code))
  AND s.student_id NOT IN (SELECT student_id FROM applications WHERE drive_id = ?);
```

---

## Features

- **Dashboard** — real-time stats, dept bar chart, application donut chart, recent offers, top companies
- **Student Management** — full CRUD, search/filter by dept/status/CGPA, skills tracking
- **Company Management** — registration, offer summaries, sector tagging
- **Placement Drives** — scheduling with eligibility rules (CGPA, backlogs, dept)
- **Application Pipeline** — Kanban board with inline status updates
- **Offers** — offer letter records with CTC, acceptance tracking
- **Interviews** — multi-round tracking (Aptitude/Technical/GD/HR)
- **Auth** — JWT-based login for admins and students, protected routes
- **Analytics API** — CTC distribution, monthly trends, dept-wise rates
