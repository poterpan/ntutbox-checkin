import { describe, it, expect } from 'vitest';
import { ALL_DAY_PRESET } from '../course-presets';
import { computeSessionTimes } from '../time';
import { determineStatus } from '../status';

// 全天簽到用的課程預設：整個活動日掃碼都要算「準時」。
// too_early 會讓 /api/checkin 直接擋掉不寫紀錄，absent 雖然會寫但標記缺席，
// 兩者對特殊活動簽到都是錯的 —— 這組數字就是為了讓一整天都落在 on_time。
const DATE = '2026-09-09';
const at = (hhmm: string) => new Date(`${DATE}T${hhmm}:00+08:00`).getTime();

describe('ALL_DAY_PRESET', () => {
  const t = computeSessionTimes(
    DATE,
    ALL_DAY_PRESET.default_class_start,
    ALL_DAY_PRESET.default_early_open_min,
    ALL_DAY_PRESET.default_late_cutoff_min,
    'Asia/Taipei',
  );
  const status = (hhmm: string) =>
    determineStatus(at(hhmm), t.early_open_at, t.class_start_at, t.late_cutoff_at);

  it('opens at local midnight', () => {
    expect(t.early_open_at).toBe(at('00:00'));
  });

  it('treats the whole day as on time', () => {
    expect(t.class_start_at).toBe(at('23:59'));
  });

  it.each(['00:00', '00:01', '06:30', '09:00', '12:00', '17:45', '21:00', '23:58', '23:59'])(
    'counts a %s scan as on_time',
    (hhmm) => {
      expect(status(hhmm)).toBe('on_time');
    },
  );

  it('never rejects a same-day scan as too_early', () => {
    expect(status('00:00')).not.toBe('too_early');
  });

  it('never marks a same-day scan absent', () => {
    expect(status('23:59')).not.toBe('absent');
  });

  it('leaves the cutoff after the last on_time minute', () => {
    expect(t.late_cutoff_at).toBeGreaterThan(t.class_start_at);
  });
});
