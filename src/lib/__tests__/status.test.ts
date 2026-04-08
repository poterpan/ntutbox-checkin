import { describe, it, expect } from 'vitest';
import { determineStatus } from '../status';

const base = new Date('2026-04-08T12:40:00+08:00').getTime();
const early_open = base;
const class_start = base + 30 * 60 * 1000; // 13:10
const late_cutoff = base + 40 * 60 * 1000; // 13:20

describe('determineStatus', () => {
  it('returns too_early if scan_time < early_open', () => {
    expect(determineStatus(early_open - 1, early_open, class_start, late_cutoff)).toBe('too_early');
  });
  it('returns on_time at exactly early_open', () => {
    expect(determineStatus(early_open, early_open, class_start, late_cutoff)).toBe('on_time');
  });
  it('returns on_time between early_open and class_start', () => {
    expect(determineStatus(early_open + 15 * 60 * 1000, early_open, class_start, late_cutoff)).toBe('on_time');
  });
  it('returns on_time at exactly class_start', () => {
    expect(determineStatus(class_start, early_open, class_start, late_cutoff)).toBe('on_time');
  });
  it('returns late just after class_start', () => {
    expect(determineStatus(class_start + 1, early_open, class_start, late_cutoff)).toBe('late');
  });
  it('returns late at exactly late_cutoff', () => {
    expect(determineStatus(late_cutoff, early_open, class_start, late_cutoff)).toBe('late');
  });
  it('returns absent after late_cutoff', () => {
    expect(determineStatus(late_cutoff + 1, early_open, class_start, late_cutoff)).toBe('absent');
  });
});
