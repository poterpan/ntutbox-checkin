-- 0004_official_leave.sql
ALTER TABLE attendance ADD COLUMN is_official_leave INTEGER NOT NULL DEFAULT 0;
