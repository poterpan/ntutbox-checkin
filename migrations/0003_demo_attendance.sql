-- 0003_demo_attendance.sql
CREATE TABLE demo_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL UNIQUE,
  user_name TEXT,
  checkin_time INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);
