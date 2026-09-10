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

describe('GET /api/courses', () => {
  // The projector page decides whether to show its login button by looking for
  // a 401. A thrown Response becomes an empty-bodied 500 in Next's App Router,
  // which the page cannot tell apart from a real outage.
  it('returns 401 with a JSON body when nobody is signed in', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(dbMock.prepare).not.toHaveBeenCalled();
  });

  it('does not reach the database when the session has no email', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { name: 'no email' } } as never);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(dbMock.prepare).not.toHaveBeenCalled();
  });

  it('returns the course list for a signed-in course admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    dbMock.prepare
      .mockReturnValueOnce(makeStmt({ first: null })) // super_admins lookup
      .mockReturnValueOnce(makeStmt({ all: { results: [{ id: 'iai-seminar-115-1' }] } }));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      courses: [{ id: 'iai-seminar-115-1' }],
      is_super: false,
    });
  });

  it('flags a super admin and lists every active course', async () => {
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    dbMock.prepare
      .mockReturnValueOnce(makeStmt({ first: { email: 'ta@ntut.org.tw' } }))
      .mockReturnValueOnce(makeStmt({ all: { results: [{ id: 'a' }, { id: 'b' }] } }));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ courses: [{ id: 'a' }, { id: 'b' }], is_super: true });
  });
});
