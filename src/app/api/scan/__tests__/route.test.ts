import { describe, it, expect, vi, beforeEach } from 'vitest';

const kvMock = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};
const dbMock = {
  prepare: vi.fn(),
};

vi.mock('@/lib/cloudflare', () => ({
  getKV: () => kvMock,
  getDB: () => dbMock,
}));

vi.mock('@/lib/nonce', () => ({
  validateNonce: vi.fn(),
}));

import { POST } from '../route';
import { validateNonce } from '@/lib/nonce';

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function makeStmt(firstResult: unknown) {
  const stmt = {
    bind: vi.fn(() => stmt),
    first: vi.fn(async () => firstResult),
    run: vi.fn(async () => ({})),
  };
  return stmt;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.setSystemTime(1_700_000_000_000);
  // crypto.randomUUID is native in Node 18+ test runtime — no mock needed.
});

describe('POST /api/scan', () => {
  const validNonce = {
    course_id: 'c1', session_id: 's1',
    created_at: 1_700_000_000_000 - 5_000,
    expires_at: 1_700_000_000_000 + 55_000,
  };

  it('valid nonce → 200 + pending_id + scan_time', async () => {
    vi.mocked(validateNonce).mockResolvedValueOnce(validNonce);
    dbMock.prepare.mockReturnValueOnce(makeStmt({ status: 'open', class_date: '2099-01-01' }));
    const res = await POST(makeRequest({ nonce: 'n1' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { pending_id: string; scan_time: number };
    expect(body.pending_id).toBeTruthy();
    expect(body.scan_time).toBe(1_700_000_000_000);
  });

  it('same nonce 3 times (different fingerprints) → all succeed with different pending_ids (MULTI-SCAN REGRESSION)', async () => {
    vi.mocked(validateNonce).mockResolvedValue(validNonce);
    // Each call: one DB SELECT for session status
    dbMock.prepare.mockImplementation(() => makeStmt({ status: 'open', class_date: '2099-01-01' }));

    const r1 = await POST(makeRequest({ nonce: 'shared-nonce', fingerprint: { visitorId: 'a' } }));
    const r2 = await POST(makeRequest({ nonce: 'shared-nonce', fingerprint: { visitorId: 'b' } }));
    const r3 = await POST(makeRequest({ nonce: 'shared-nonce', fingerprint: { visitorId: 'c' } }));

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    const b1 = await r1.json() as { pending_id: string };
    const b2 = await r2.json() as { pending_id: string };
    const b3 = await r3.json() as { pending_id: string };
    expect(new Set([b1.pending_id, b2.pending_id, b3.pending_id]).size).toBe(3);
  });

  it('POST /api/scan never calls kv.delete on nonce: keys (REGRESSION GUARD)', async () => {
    vi.mocked(validateNonce).mockResolvedValue(validNonce);
    dbMock.prepare.mockImplementation(() => makeStmt({ status: 'open', class_date: '2099-01-01' }));

    await POST(makeRequest({ nonce: 'n1' }));
    await POST(makeRequest({ nonce: 'n1' }));

    const nonceDeletes = kvMock.delete.mock.calls.filter(([key]) =>
      typeof key === 'string' && key.startsWith('nonce:')
    );
    expect(nonceDeletes).toHaveLength(0);
  });

  it('validateNonce returns null → 400 invalid_nonce', async () => {
    vi.mocked(validateNonce).mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ nonce: 'bad' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_nonce');
  });

  it('session status closed → 400 session_closed', async () => {
    vi.mocked(validateNonce).mockResolvedValueOnce(validNonce);
    dbMock.prepare.mockReturnValueOnce(makeStmt({ status: 'closed', class_date: '2099-01-01' }));
    const res = await POST(makeRequest({ nonce: 'n1' }));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('session_closed');
  });

  it('class_date in the past → 400 session_expired', async () => {
    vi.mocked(validateNonce).mockResolvedValueOnce(validNonce);
    dbMock.prepare.mockReturnValueOnce(makeStmt({ status: 'open', class_date: '2000-01-01' }));
    const res = await POST(makeRequest({ nonce: 'n1' }));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('session_expired');
  });

  it('missing nonce → 400 missing_nonce', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('missing_nonce');
  });
});
