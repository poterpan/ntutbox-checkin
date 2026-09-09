/**
 * Course-default presets for /super/courses.
 *
 * The scan window is derived from the course defaults at session-create time
 * (see computeSessionTimes), so "all day" is expressed purely as defaults:
 * class_start at 23:59 with a 1439-minute early open puts early_open_at at
 * local 00:00, which makes every same-day scan on_time.
 */

export type CourseTimingDefaults = {
  default_class_start: string;
  default_early_open_min: number;
  default_late_cutoff_min: number;
};

/** Regular class: opens 30 min early, 10 min late grace. */
export const REGULAR_PRESET: CourseTimingDefaults = {
  default_class_start: '13:10',
  default_early_open_min: 30,
  default_late_cutoff_min: 10,
};

/** All-day check-in (special events): scannable 00:00–23:59, everyone on_time. */
export const ALL_DAY_PRESET: CourseTimingDefaults = {
  default_class_start: '23:59',
  default_early_open_min: 1439,
  default_late_cutoff_min: 1,
};
