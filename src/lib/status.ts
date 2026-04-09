export type AttendanceStatus = 'too_early' | 'on_time' | 'late' | 'absent' | 'leave';

/**
 * Pure function: compares scan_time against session time boundaries.
 * All parameters are Unix milliseconds.
 */
export function determineStatus(
  scan_time_ms: number,
  early_open: number,
  class_start: number,
  late_cutoff: number,
): AttendanceStatus {
  if (scan_time_ms < early_open) return 'too_early';
  if (scan_time_ms <= class_start) return 'on_time';
  if (scan_time_ms <= late_cutoff) return 'late';
  return 'absent';
}
