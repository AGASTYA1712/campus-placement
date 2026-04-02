-- =============================================================
-- College Placement Management System (CPMS)
-- Database Schema  |  MySQL 8.0+  |  3NF Normalized
-- =============================================================

CREATE DATABASE IF NOT EXISTS railway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE railway;

-- -----------------------------------------------------------
-- 1. DEPARTMENTS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  department_id   INT            AUTO_INCREMENT PRIMARY KEY,
  dept_code       VARCHAR(10)    NOT NULL UNIQUE,
  dept_name       VARCHAR(100)   NOT NULL,
  hod_name        VARCHAR(100),
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- 2. STUDENTS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  student_id      VARCHAR(15)    PRIMARY KEY,           -- e.g. 21CSE001
  first_name      VARCHAR(50)    NOT NULL,
  last_name       VARCHAR(50)    NOT NULL,
  email           VARCHAR(100)   NOT NULL UNIQUE,
  phone           VARCHAR(15),
  department_id   INT            NOT NULL,
  cgpa            DECIMAL(4,2)   NOT NULL,
  backlogs        INT            NOT NULL DEFAULT 0,
  year_of_passing INT            NOT NULL,
  placed          BOOLEAN        NOT NULL DEFAULT FALSE,
  password_hash   VARCHAR(255)   NOT NULL,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- -----------------------------------------------------------
-- 3. SKILLS  (student ─< skills)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
  skill_id        INT            AUTO_INCREMENT PRIMARY KEY,
  student_id      VARCHAR(15)    NOT NULL,
  skill_name      VARCHAR(100)   NOT NULL,
  proficiency     ENUM('Beginner','Intermediate','Expert') DEFAULT 'Intermediate',
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- 4. COMPANIES
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  company_id      INT            AUTO_INCREMENT PRIMARY KEY,
  company_name    VARCHAR(100)   NOT NULL UNIQUE,
  sector          VARCHAR(50)    NOT NULL,
  hr_name         VARCHAR(100),
  hr_email        VARCHAR(100)   NOT NULL,
  website         VARCHAR(200),
  registered_on   DATE           NOT NULL DEFAULT (CURDATE()),
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- 5. PLACEMENT DRIVES
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS drives (
  drive_id        INT            AUTO_INCREMENT PRIMARY KEY,
  company_id      INT            NOT NULL,
  role            VARCHAR(100)   NOT NULL,
  ctc_min         DECIMAL(6,2)   NOT NULL,
  ctc_max         DECIMAL(6,2)   NOT NULL,
  min_cgpa        DECIMAL(4,2)   NOT NULL DEFAULT 6.50,
  max_backlogs    INT            NOT NULL DEFAULT 0,
  drive_date      DATE           NOT NULL,
  registration_deadline DATE,
  dept_eligible   JSON,                                    -- ["CSE","IT","ECE"]
  description     TEXT,
  status          ENUM('Upcoming','Active','Completed','Cancelled') DEFAULT 'Upcoming',
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- -----------------------------------------------------------
-- 6. APPLICATIONS  (student ─< applications >─ drive)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  application_id  INT            AUTO_INCREMENT PRIMARY KEY,
  student_id      VARCHAR(15)    NOT NULL,
  drive_id        INT            NOT NULL,
  status          ENUM('Applied','Shortlisted','Interview','Offered','Rejected','Withdrawn')
                                 NOT NULL DEFAULT 'Applied',
  applied_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  remarks         TEXT,
  UNIQUE KEY uq_student_drive (student_id, drive_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (drive_id)   REFERENCES drives(drive_id)
);

-- -----------------------------------------------------------
-- 7. INTERVIEWS  (application ─< interviews)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS interviews (
  interview_id    INT            AUTO_INCREMENT PRIMARY KEY,
  application_id  INT            NOT NULL,
  round_no        INT            NOT NULL DEFAULT 1,
  type            ENUM('Aptitude','Technical','Group Discussion','HR','Final') NOT NULL,
  interview_date  DATE           NOT NULL,
  score           DECIMAL(5,2),
  result          ENUM('Pass','Fail','Pending') NOT NULL DEFAULT 'Pending',
  notes           TEXT,
  FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- 8. OFFERS  (application ─◇─ offer)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
  offer_id        INT            AUTO_INCREMENT PRIMARY KEY,
  application_id  INT            NOT NULL UNIQUE,
  ctc             DECIMAL(6,2)   NOT NULL,
  offer_date      DATE           NOT NULL,
  joining_date    DATE,
  accepted        BOOLEAN        NOT NULL DEFAULT FALSE,
  offer_letter_url VARCHAR(300),
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(application_id)
);

-- -----------------------------------------------------------
-- 9. ADMIN USERS
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  admin_id        INT            AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100)   NOT NULL,
  email           VARCHAR(100)   NOT NULL UNIQUE,
  password_hash   VARCHAR(255)   NOT NULL,
  role            ENUM('superadmin','coordinator') DEFAULT 'coordinator',
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- INDEXES for performance
-- -----------------------------------------------------------
CREATE INDEX idx_students_dept   ON students(department_id);
CREATE INDEX idx_students_placed ON students(placed);
CREATE INDEX idx_apps_student    ON applications(student_id);
CREATE INDEX idx_apps_drive      ON applications(drive_id);
CREATE INDEX idx_apps_status     ON applications(status);
CREATE INDEX idx_drives_company  ON drives(company_id);
CREATE INDEX idx_drives_date     ON drives(drive_date);

-- -----------------------------------------------------------
-- SEED DATA
-- -----------------------------------------------------------
INSERT INTO departments (dept_code, dept_name, hod_name) VALUES
  ('CSE', 'Computer Science & Engineering', 'Dr. Ramesh Kumar'),
  ('IT',  'Information Technology',          'Dr. Sunita Rao'),
  ('ECE', 'Electronics & Communication',     'Dr. Anil Verma'),
  ('EEE', 'Electrical & Electronics',        'Dr. Priya Iyer'),
  ('ME',  'Mechanical Engineering',          'Dr. Suresh Nair'),
  ('CE',  'Civil Engineering',               'Dr. Mohan Lal');

INSERT INTO admins (name, email, password_hash, role) VALUES
  ('Admin User', 'admin@cpms.edu',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'superadmin');
-- default password: password

INSERT INTO companies (company_name, sector, hr_name, hr_email, website, registered_on) VALUES
  ('Google India', 'Technology', 'Divya Menon', 'hr@google.com', 'https://careers.google.com', CURDATE()),
  ('Microsoft India', 'Technology', 'Rahul Sen', 'hr@microsoft.com', 'https://careers.microsoft.com', CURDATE()),
  ('Amazon India', 'Technology', 'Priya Das', 'hr@amazon.com', 'https://amazon.jobs', CURDATE()),
  ('Infosys', 'IT Services', 'Rekha Iyer', 'hr@infosys.com', 'https://infosys.com/careers', CURDATE()),
  ('TCS', 'IT Services', 'Suman Roy', 'hr@tcs.com', 'https://tcs.com/careers', CURDATE()),
  ('Qualcomm India', 'Semiconductor', 'Venu Gopal', 'hr@qualcomm.com', 'https://qualcomm.com/careers', CURDATE()),
  ('Deloitte India', 'Consulting', 'Anita Sharma', 'hr@deloitte.com', 'https://deloitte.com/careers', CURDATE()),
  ('L&T Technology', 'Core Engineering', 'Raj Patil', 'hr@lnt.com', 'https://ltts.com/careers', CURDATE());
