-- Attendance module: per-user off-day pattern + daily attendance records.
-- off_mode: 'rotate' (rotating full day off) or 'half:0'..'half:6' (standing
-- half-day on that weekday, 0=Monday).
ALTER TABLE users ADD COLUMN off_mode VARCHAR(16) NOT NULL DEFAULT 'rotate';

-- One row per user per day, only for exceptions (present = no row).
-- status: 'absent' | 'half' | 'makeup'
CREATE TABLE IF NOT EXISTS attendance_records (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT         NOT NULL,
  work_date  DATE        NOT NULL,
  status     VARCHAR(10) NOT NULL,
  updated_by INT         NULL,
  updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_day (user_id, work_date),
  INDEX idx_date (work_date)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
