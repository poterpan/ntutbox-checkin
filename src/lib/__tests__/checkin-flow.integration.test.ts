import { describe, it, expect, vi, beforeEach } from 'vitest';

type PendingRecord = {
  course_id: string; session_id: string; nonce_created_at: number; scan_time: number;
  fingerprint: unknown; ip: string | null; user_agent: string | null;
};

// In-memory fakes to simulate full flow
const kvStore = new Map<string, unknown>();
const kvTtls = new Map<string, number>();

const kvMock = {
  get: vi.fn(async (key: string, _type?: string) => kvStore.get(key) ?? null),
  put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
    kvStore.set(key, JSON.parse(value));
    if (opts?.expirationTtl) kvTtls.set(key, Date.now() + opts.expirationTtl * 1000);
  }),
  delete: vi.fn(async (key: string) => { kvStore.delete(key); }),
};

const nonceLogRows: Array<{ nonce: string; session_id: string; created_at: number; expires_at: number }> = [];
const sessionsRows = new Map<string, {
  id: string; course_id: string; status: string; class_date: string;
  early_open_at: number; class_start_at: number; late_cutoff_at: number; qr_mode: string;
}>();
const attendanceRows: Array<{ session_id: string; user_email: string }> = [];

const dbMock = {
  prepare: vi.fn((sql: string) => {
    const stmt = {
      _binds: [] as unknown[],
      bind(...args: unknown[]) { this._binds = args; return this; },
      async first() {
        if (sql.includes('FROM nonce_log WHERE nonce = ? AND expires_at > ?')) {
          const [nonce, now] = this._binds as [string, number];
          const row = nonceLogRows.find(r => r.nonce === nonce && r.expires_at > now);
          return row ? { session_id: row.session_id, created_at: row.created_at, expires_at: row.expires_at } : null;
        }
        if (sql.includes('FROM sessions WHERE id = ?') && sql.includes('course_id')) {
          const [id] = this._binds as [string];
          const s = sessionsRows.get(id);
          return s ? { course_id: s.course_id } : null;
        }
        if (sql.includes('SELECT status, class_date FROM sessions')) {
          const [id] = this._binds as [string];
          const s = sessionsRows.get(id);
          return s ? { status: s.status, class_date: s.class_date } : null;
        }
        if (sql.includes('SELECT early_open_at, class_start_at, late_cutoff_at, status FROM sessions')) {
          const [id] = this._binds as [string];
          const s = sessionsRows.get(id);
          return s ? {
            early_open_at: s.early_open_at,
            class_start_at: s.class_start_at,
            late_cutoff_at: s.late_cutoff_at,
            status: s.status,
          } : null;
        }
        return null;
      },
      async run() {
        if (sql.startsWith('INSERT INTO nonce_log')) {
          const [nonce, session_id, created_at, expires_at] = this._binds as [string, string, number, number];
          nonceLogRows.push({ nonce, session_id, created_at, expires_at });
          return {};
        }
        if (sql.startsWith('\n      INSERT INTO attendance') || sql.includes('INSERT INTO attendance')) {
          const [session_id, , user_email] = this._binds as [string, string, string];
          const dup = attendanceRows.some(a => a.session_id === session_id && a.user_email === user_email);
          if (dup) {
            throw new Error('D1_ERROR: UNIQUE constraint failed: attendance.session_id, attendance.user_email');
          }
          attendanceRows.push({ session_id, user_email });
          return {};
        }
        return {};
      },
    };
    return stmt;
  }),
};

vi.mock('@/lib/cloudflare', () => ({
  getKV: () => kvMock,
  getDB: () => dbMock,
}));

vi.mock('@/lib/permissions', () => ({
  requireCourseAdmin: vi.fn(async () => undefined),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'student@ntut.org.tw', name: 'Student' } })),
}));

// Imports AFTER mocks
import { GET as qrGet } from '@/app/api/courses/[courseId]/sessions/[id]/qr/route';
import { POST as scanPost } from '@/app/api/scan/route';
import { GET as checkinGet } from '@/app/api/checkin/route';

const now = 1_700_000_000_000;

function reset() {
  kvStore.clear();
  kvTtls.clear();
  nonceLogRows.length = 0;
  attendanceRows.length = 0;
  sessionsRows.clear();
  vi.clearAllMocks();
  vi.setSystemTime(now);
  sessionsRows.set('s1', {
    id: 's1', course_id: 'c1', status: 'open', class_date: '2099-01-01',
    early_open_at: now - 60_000, class_start_at: now + 60_000, late_cutoff_at: now + 120_000,
    qr_mode: 'dynamic',
  });
}

beforeEach(() => reset());

describe('QR → scan → checkin integration', () => {
  it('QR creation writes expires_at to nonce_log', async () => {
    // qr route reads more columns; stub the complex SELECT separately
    dbMock.prepare.mockImplementationOnce(() => ({
      bind() { return this; },
      async first() {
        return { status: 'open', qr_mode: 'dynamic', static_nonce: null, class_date: '2099-01-01', course_name: 'Test' };
      },
      async run() { return {}; },
    } as unknown as ReturnType<typeof dbMock.prepare>));

    const res = await qrGet(
      new Request('http://x/api/courses/c1/sessions/s1/qr') as unknown as Parameters<typeof qrGet>[0],
      { params: Promise.resolve({ courseId: 'c1', id: 's1' }) },
    );
    expect(res.status).toBe(200);
    expect(nonceLogRows).toHaveLength(1);
    expect(nonceLogRows[0].expires_at).toBe(now + 60_000);
  });

  it('3 different emails scan same nonce → 3 attendance rows', async () => {
    // Seed nonce directly
    const nonce = 'share-n-1';
    kvStore.set(`nonce:${nonce}`, {
      course_id: 'c1', session_id: 's1',
      created_at: now, expires_at: now + 60_000,
    });
    nonceLogRows.push({ nonce, session_id: 's1', created_at: now, expires_at: now + 60_000 });

    const authMod = await import('@/lib/auth');
    const emails = ['a@ntut.org.tw', 'b@ntut.org.tw', 'c@ntut.org.tw'];
    const pendingIds: string[] = [];

    for (const email of emails) {
      vi.mocked(authMod.auth).mockResolvedValueOnce({
        user: { email, name: email.split('@')[0] },
      } as unknown as Awaited<ReturnType<typeof authMod.auth>>);
      const scanRes = await scanPost(
        new Request('http://x/api/scan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nonce }),
        }) as unknown as Parameters<typeof scanPost>[0],
      );
      const body = await scanRes.json() as { pending_id: string };
      pendingIds.push(body.pending_id);

      const checkinRes = await checkinGet(
        new Request(`http://x/api/checkin?pid=${body.pending_id}&t=${now}`) as unknown as Parameters<typeof checkinGet>[0],
      );
      // Successful checkin redirects to /result?status=...
      expect(checkinRes.status).toBeGreaterThanOrEqual(300);
      expect(checkinRes.status).toBeLessThan(400);
    }

    expect(attendanceRows).toHaveLength(3);
    expect(new Set(pendingIds).size).toBe(3);
  });

  it('KV miss → D1 fallback path: scan still succeeds', async () => {
    const nonce = 'kv-miss-n';
    // Intentionally do NOT seed KV; only D1
    nonceLogRows.push({ nonce, session_id: 's1', created_at: now, expires_at: now + 60_000 });

    const scanRes = await scanPost(
      new Request('http://x/api/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce }),
      }) as unknown as Parameters<typeof scanPost>[0],
    );
    expect(scanRes.status).toBe(200);
    const body = await scanRes.json() as { pending_id: string };
    expect(body.pending_id).toBeTruthy();
  });

  it('same email scans twice → second checkin → already_signed', async () => {
    const nonce = 'dup-n';
    kvStore.set(`nonce:${nonce}`, {
      course_id: 'c1', session_id: 's1',
      created_at: now, expires_at: now + 60_000,
    });
    nonceLogRows.push({ nonce, session_id: 's1', created_at: now, expires_at: now + 60_000 });

    // First checkin
    const scan1 = await scanPost(
      new Request('http://x/api/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce }),
      }) as unknown as Parameters<typeof scanPost>[0],
    );
    const { pending_id: p1 } = await scan1.json() as { pending_id: string };
    const c1 = await checkinGet(
      new Request(`http://x/api/checkin?pid=${p1}`) as unknown as Parameters<typeof checkinGet>[0],
    );
    expect(c1.headers.get('location')).toMatch(/status=(on_time|late|absent|too_early)/);

    // Second scan + checkin (same email) → already_signed
    const scan2 = await scanPost(
      new Request('http://x/api/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce }),
      }) as unknown as Parameters<typeof scanPost>[0],
    );
    const { pending_id: p2 } = await scan2.json() as { pending_id: string };
    const c2 = await checkinGet(
      new Request(`http://x/api/checkin?pid=${p2}`) as unknown as Parameters<typeof checkinGet>[0],
    );
    expect(c2.headers.get('location')).toContain('status=already_signed');
  });
});
