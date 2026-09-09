import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMock = {
  prepare: vi.fn(),
  batch: vi.fn(),
};

vi.mock('@/lib/cloudflare', () => ({
  getDB: () => dbMock,
}));

vi.mock('@/lib/permissions', () => ({
  requireSuperAdmin: vi.fn(async () => ({ email: 'super@ntut.org.tw' })),
}));

import { POST } from '../route';
import { ALL_DAY_PRESET } from '@/lib/course-presets';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/super/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function makeStmt() {
  const stmt = {
    bind: vi.fn((...args: unknown[]) => { void args; return stmt; }),
    run: vi.fn(async () => ({})),
  };
  return stmt;
}

const base = {
  id: 'iai-special-115-1',
  name: '創新AI碩/博班 特殊活動簽到',
  semester: '115-1',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/super/courses', () => {
  it('accepts the all-day preset and persists its minutes verbatim', async () => {
    const stmt = makeStmt();
    dbMock.prepare.mockReturnValue(stmt);

    const res = await POST(makeRequest({ ...base, ...ALL_DAY_PRESET, default_weekday: null }));

    expect(res.status).toBe(200);
    const bound = stmt.bind.mock.calls[0];
    expect(bound).toContain('23:59');
    expect(bound).toContain(1439);
    // default_weekday must land as NULL so /projector never auto-prompts it
    expect(bound[6]).toBeNull();
  });

  it('rejects a malformed class start rather than writing NaN boundaries', async () => {
    dbMock.prepare.mockReturnValue(makeStmt());
    for (const bad of ['1310', '25:00', '13:70', '', 'noon']) {
      const res = await POST(makeRequest({ ...base, default_class_start: bad }));
      expect(res.status).toBe(400);
    }
    expect(dbMock.prepare).not.toHaveBeenCalled();
  });

  it('rejects out-of-range or fractional minute values', async () => {
    dbMock.prepare.mockReturnValue(makeStmt());
    const bads = [
      { default_early_open_min: -1 },
      { default_early_open_min: 1441 },
      { default_early_open_min: 30.5 },
      { default_late_cutoff_min: -5 },
      { default_late_cutoff_min: 99999 },
    ];
    for (const bad of bads) {
      const res = await POST(makeRequest({ ...base, default_class_start: '13:10', ...bad }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_minutes' });
    }
    expect(dbMock.prepare).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range weekday', async () => {
    dbMock.prepare.mockReturnValue(makeStmt());
    const res = await POST(makeRequest({ ...base, default_class_start: '13:10', default_weekday: 7 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_weekday' });
  });

  it('still requires id / name / semester / class start', async () => {
    dbMock.prepare.mockReturnValue(makeStmt());
    const res = await POST(makeRequest({ name: 'x' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'missing_fields' });
  });

  it('defaults the minutes when the caller omits them', async () => {
    const stmt = makeStmt();
    dbMock.prepare.mockReturnValue(stmt);

    const res = await POST(makeRequest({ ...base, default_class_start: '13:10' }));

    expect(res.status).toBe(200);
    const bound = stmt.bind.mock.calls[0];
    expect(bound).toContain(30);
    expect(bound).toContain(10);
  });
});
