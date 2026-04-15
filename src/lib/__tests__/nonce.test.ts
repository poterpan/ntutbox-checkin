import { describe, it, expect, vi, beforeEach } from 'vitest';

type KVMock = {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
type DBStmt = {
  bind: (...args: unknown[]) => DBStmt;
  first: () => Promise<unknown>;
  run: () => Promise<unknown>;
};
type DBMock = {
  prepare: ReturnType<typeof vi.fn>;
};

const kvMock: KVMock = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};
const dbMock: DBMock = {
  prepare: vi.fn(),
};

vi.mock('@/lib/cloudflare', () => ({
  getKV: () => kvMock,
  getDB: () => dbMock,
}));

// Import under test AFTER mock is set up
import { validateNonce } from '../nonce';

function makeStmt(firstResult: unknown): DBStmt {
  const stmt: DBStmt = {
    bind: vi.fn(() => stmt),
    first: vi.fn(async () => firstResult),
    run: vi.fn(async () => ({})),
  };
  return stmt;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('validateNonce (dynamic)', () => {
  const nonce = 'abc-123-def';
  const now = 1_700_000_000_000;

  beforeEach(() => {
    vi.setSystemTime(now);
  });

  it('dynamic KV hit + not expired → returns data', async () => {
    kvMock.get.mockResolvedValueOnce({
      course_id: 'c1', session_id: 's1',
      created_at: now - 10_000, expires_at: now + 30_000,
    });
    const result = await validateNonce(nonce);
    expect(result).toEqual({
      course_id: 'c1', session_id: 's1',
      created_at: now - 10_000, expires_at: now + 30_000,
    });
  });

  it('dynamic KV hit + expired → returns null', async () => {
    kvMock.get.mockResolvedValueOnce({
      course_id: 'c1', session_id: 's1',
      created_at: now - 120_000, expires_at: now - 60_000,
    });
    const result = await validateNonce(nonce);
    expect(result).toBeNull();
  });

  it('dynamic KV miss + D1 hit + not expired → returns data (NEW fallback)', async () => {
    kvMock.get.mockResolvedValueOnce(null); // dynamic KV miss
    kvMock.get.mockResolvedValueOnce(null); // static KV miss (called later)
    dbMock.prepare
      .mockReturnValueOnce(makeStmt({
        session_id: 's1', created_at: now - 10_000, expires_at: now + 30_000,
      }))
      .mockReturnValueOnce(makeStmt({ course_id: 'c1' }));
    const result = await validateNonce(nonce);
    expect(result).toEqual({
      course_id: 'c1', session_id: 's1',
      created_at: now - 10_000, expires_at: now + 30_000,
    });
  });

  it('dynamic KV miss + D1 hit + expired → returns null', async () => {
    kvMock.get.mockResolvedValueOnce(null);
    // D1 row filtered by WHERE expires_at > ? → first() returns null
    dbMock.prepare.mockReturnValueOnce(makeStmt(null));
    const result = await validateNonce(nonce);
    expect(result).toBeNull();
  });

  it('dynamic KV miss + D1 miss → returns null', async () => {
    kvMock.get.mockResolvedValueOnce(null);
    dbMock.prepare.mockReturnValueOnce(makeStmt(null));
    const result = await validateNonce(nonce);
    expect(result).toBeNull();
  });

  it('dynamic D1 hit but sessions lookup fails → returns null', async () => {
    kvMock.get.mockResolvedValueOnce(null);
    dbMock.prepare
      .mockReturnValueOnce(makeStmt({
        session_id: 's1', created_at: now - 10_000, expires_at: now + 30_000,
      }))
      .mockReturnValueOnce(makeStmt(null)); // sessions query returns null
    const result = await validateNonce(nonce);
    expect(result).toBeNull();
  });

  it('validateNonce does not delete KV entries', async () => {
    kvMock.get.mockResolvedValueOnce({
      course_id: 'c1', session_id: 's1',
      created_at: now - 10_000, expires_at: now + 30_000,
    });
    await validateNonce(nonce);
    expect(kvMock.delete).not.toHaveBeenCalled();
    expect(kvMock.put).not.toHaveBeenCalled();
  });

  it('same dynamic nonce validated 3 times → all succeed with unchanged state', async () => {
    const data = {
      course_id: 'c1', session_id: 's1',
      created_at: now - 10_000, expires_at: now + 30_000,
    };
    kvMock.get.mockResolvedValue(data);
    const r1 = await validateNonce(nonce);
    const r2 = await validateNonce(nonce);
    const r3 = await validateNonce(nonce);
    expect(r1).toEqual(data);
    expect(r2).toEqual(data);
    expect(r3).toEqual(data);
    expect(kvMock.delete).not.toHaveBeenCalled();
  });
});

describe('validateNonce (static)', () => {
  const staticNonce = 'static-abc-123';
  const now = 1_700_000_000_000;

  beforeEach(() => {
    vi.setSystemTime(now);
  });

  it('static KV hit → returns data (no expiry check)', async () => {
    kvMock.get.mockResolvedValueOnce(null); // dynamic KV miss (prefix-filtered anyway)
    kvMock.get.mockResolvedValueOnce({
      course_id: 'c1', session_id: 's1',
      created_at: now - 86_400_000, expires_at: now + 86_400_000,
    });
    const result = await validateNonce(staticNonce);
    expect(result?.course_id).toBe('c1');
  });

  it('static KV miss + D1 session open → returns data (regression)', async () => {
    kvMock.get.mockResolvedValueOnce(null);
    kvMock.get.mockResolvedValueOnce(null);
    dbMock.prepare.mockReturnValueOnce(makeStmt({
      course_id: 'c1', session_id: 's1', status: 'open',
    }));
    const result = await validateNonce(staticNonce);
    expect(result?.course_id).toBe('c1');
  });

  it('static KV miss + D1 session closed → returns null', async () => {
    kvMock.get.mockResolvedValueOnce(null);
    kvMock.get.mockResolvedValueOnce(null);
    dbMock.prepare.mockReturnValueOnce(makeStmt(null)); // WHERE status='open' filters out
    const result = await validateNonce(staticNonce);
    expect(result).toBeNull();
  });
});
