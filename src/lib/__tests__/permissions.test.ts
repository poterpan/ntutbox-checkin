import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMock = { prepare: vi.fn() };

vi.mock('@/lib/cloudflare', () => ({
  getDB: () => dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { checkCourseAdmin, checkSuperAdmin, getSessionUserOrNull } from '../permissions';
import { auth } from '@/lib/auth';

function makeStmt(first: unknown) {
  const stmt = {
    bind: vi.fn((...args: unknown[]) => { void args; return stmt; }),
    first: vi.fn(async () => first),
  };
  return stmt;
}

const EMAIL = 'ta@ntut.org.tw';
const signedIn = { user: { email: EMAIL, name: 'TA' } };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getSessionUserOrNull', () => {
  it('returns null instead of throwing when there is no session', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    await expect(getSessionUserOrNull()).resolves.toBeNull();
  });

  it('returns null when the session carries no email', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { name: 'anon' } } as never);
    await expect(getSessionUserOrNull()).resolves.toBeNull();
  });

  it('normalises a missing name to null', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: EMAIL } } as never);
    await expect(getSessionUserOrNull()).resolves.toEqual({ email: EMAIL, name: null });
  });
});

describe('checkCourseAdmin', () => {
  it('denies with 401 when nobody is signed in, without touching the DB', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    await expect(checkCourseAdmin('c1')).resolves.toEqual({
      ok: false, status: 401, error: 'unauthorized',
    });
    expect(dbMock.prepare).not.toHaveBeenCalled();
  });

  it('grants super role without consulting course_admins', async () => {
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    dbMock.prepare.mockReturnValueOnce(makeStmt({ email: EMAIL }));

    await expect(checkCourseAdmin('c1')).resolves.toEqual({
      ok: true, admin: { role: 'super', email: EMAIL },
    });
    expect(dbMock.prepare).toHaveBeenCalledTimes(1);
  });

  it('grants the role recorded on course_admins', async () => {
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    dbMock.prepare
      .mockReturnValueOnce(makeStmt(null))
      .mockReturnValueOnce(makeStmt({ role: 'owner' }));

    await expect(checkCourseAdmin('c1')).resolves.toEqual({
      ok: true, admin: { role: 'owner', email: EMAIL },
    });
  });

  it('denies with 403 for a signed-in user who administers nothing', async () => {
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    dbMock.prepare
      .mockReturnValueOnce(makeStmt(null))
      .mockReturnValueOnce(makeStmt(null));

    await expect(checkCourseAdmin('c1')).resolves.toEqual({
      ok: false, status: 403, error: 'forbidden',
    });
  });

  it('scopes the course_admins lookup to the requested course', async () => {
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    const superStmt = makeStmt(null);
    const courseStmt = makeStmt({ role: 'ta' });
    dbMock.prepare.mockReturnValueOnce(superStmt).mockReturnValueOnce(courseStmt);

    await checkCourseAdmin('iai-special-115-1');

    expect(courseStmt.bind).toHaveBeenCalledWith('iai-special-115-1', EMAIL);
  });
});

describe('checkSuperAdmin', () => {
  it('denies with 401 when nobody is signed in, without touching the DB', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    await expect(checkSuperAdmin()).resolves.toEqual({
      ok: false, status: 401, error: 'unauthorized',
    });
    expect(dbMock.prepare).not.toHaveBeenCalled();
  });

  it('denies with 403 for a course admin who is not a super admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    dbMock.prepare.mockReturnValueOnce(makeStmt(null));

    await expect(checkSuperAdmin()).resolves.toEqual({
      ok: false, status: 403, error: 'forbidden',
    });
  });

  it('grants a super admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce(signedIn as never);
    dbMock.prepare.mockReturnValueOnce(makeStmt({ email: EMAIL }));

    await expect(checkSuperAdmin()).resolves.toEqual({
      ok: true, admin: { role: 'super', email: EMAIL },
    });
  });
});
