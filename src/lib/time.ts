/**
 * Compute session time boundaries from a date string and course defaults.
 * Returns Unix ms timestamps.
 */
export function computeSessionTimes(
  classDate: string,          // 'YYYY-MM-DD'
  classStartTime: string,     // 'HH:MM'
  earlyOpenMin: number,       // e.g. 30
  lateCutoffMin: number,      // e.g. 10
  timezone: string = 'Asia/Taipei',
): { early_open_at: number; class_start_at: number; late_cutoff_at: number } {
  // Compute UTC offset for the given timezone dynamically
  const tempDate = new Date(`${classDate}T12:00:00Z`);
  const utcStr = tempDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = tempDate.toLocaleString('en-US', { timeZone: timezone });
  const utcTime = new Date(utcStr).getTime();
  const tzTime = new Date(tzStr).getTime();
  const offsetMs = tzTime - utcTime;

  // class_start in UTC = local time - offset
  const classStartUtc = new Date(`${classDate}T${classStartTime}:00Z`).getTime() - offsetMs;

  const class_start_at = classStartUtc;
  const early_open_at = class_start_at - earlyOpenMin * 60 * 1000;
  const late_cutoff_at = class_start_at + lateCutoffMin * 60 * 1000;

  return { early_open_at, class_start_at, late_cutoff_at };
}
