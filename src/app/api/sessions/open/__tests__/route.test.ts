import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMock = { prepare: vi.fn() };

vi.mock('@/lib/cloudflare', () => ({
  getDB: () => dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { GET } from '../route';
import { auth } from '@/lib/auth';

function makeStmt(result: { first?: unknown; all?: unknown }) {
  const stmt = {
    bind: vi.fn((...args: unknown[]) => { void args; return stmt; }),
    first: vi.fn(async () => result.first ?? null),
    all: vi.fn(async () => result.all ?? { results: [] }),
  };
  return stmt;
}

const signedIn = { user: { email: 'ta@ntut.org.tw', name: 'TA' } };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/sessions/open', () => {
  it('returns 401 with a JSON body when nobody is signed in', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(dbMock.prepare).not.toHaveBeenCalled();
  });

  it('returns the open sessions for a signed-in course admin', async () => {
    const open = [{ session_id: 's1', course_id: 'c1', class_date: '2026-09-09', created_at: 1 }];
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    dbMock.prepare
      .mockReturnValueOnce(makeStmt({ first: null })) // super_admins lookup
      .mockReturnValueOnce(makeStmt({ all: { results: open } }));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: open });
  });

  it('returns an empty list rather than an error when there is nothing open', async () => {
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    dbMock.prepare
      .mockReturnValueOnce(makeStmt({ first: null }))
      .mockReturnValueOnce(makeStmt({ all: { results: [] } }));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [] });
  });
});
