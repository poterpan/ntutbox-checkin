-- migrations/0001_init.sql

-- Courses
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  semester TEXT NOT NULL,
  default_class_start TEXT NOT NULL,
  default_early_open_min INTEGER NOT NULL DEFAULT 30,
  default_late_cutoff_min INTEGER NOT NULL DEFAULT 10,
  default_weekday INTEGER,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX idx_courses_semester ON courses(semester);
CREATE INDEX idx_courses_status ON courses(status);

-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  class_date TEXT NOT NULL,
  class_start_at INTEGER NOT NULL,
  early_open_at INTEGER NOT NULL,
  late_cutoff_at INTEGER NOT NULL,
  qr_mode TEXT NOT NULL DEFAULT 'dynamic',
  static_nonce TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE INDEX idx_sessions_course ON sessions(course_id);
CREATE INDEX idx_sessions_date ON sessions(class_date);
CREATE UNIQUE INDEX idx_sessions_course_date ON sessions(course_id, class_date);

-- Attendance
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  scan_time INTEGER NOT NULL,
  login_time INTEGER NOT NULL,
  status TEXT NOT NULL,
  fingerprint_hash TEXT,
  fingerprint_raw TEXT,
  ip TEXT,
  user_agent TEXT,
  reaction_ms INTEGER,
  is_manual INTEGER DEFAULT 0,
  manual_reason TEXT,
  manual_by TEXT,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE(session_id, user_email)
);

CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_attendance_course ON attendance(course_id);
CREATE INDEX idx_attendance_email ON attendance(user_email);
CREATE INDEX idx_attendance_fp ON attendance(fingerprint_hash);
CREATE INDEX idx_attendance_ip ON attendance(ip);

-- Nonce log
CREATE TABLE nonce_log (
  nonce TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Course admins
CREATE TABLE course_admins (
  course_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'ta',
  added_at INTEGER NOT NULL,
  added_by TEXT,
  PRIMARY KEY (course_id, email),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE INDEX idx_course_admins_email ON course_admins(email);

-- Super admins
CREATE TABLE super_admins (
  email TEXT PRIMARY KEY,
  name TEXT,
  added_at INTEGER NOT NULL
);

-- Enrolled students
CREATE TABLE enrolled_students (
  course_id TEXT NOT NULL,
  email TEXT NOT NULL,
  student_id TEXT,
  name TEXT,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (course_id, email),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE INDEX idx_enrolled_email ON enrolled_students(email);
