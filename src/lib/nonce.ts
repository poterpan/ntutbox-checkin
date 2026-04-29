import { getKV, getDB } from '@/lib/cloudflare';

export type NonceData = {
  course_id: string;
  session_id: string;
  created_at: number;
  expires_at: number;
};

export async function validateNonce(nonce: string): Promise<NonceData | null> {
  const kv = getKV();

  // Dynamic nonce: KV first
  const dynamic = await kv.get<NonceData>(`nonce:${nonce}`, 'json');
  if (dynamic) {
    if (Date.now() > dynamic.expires_at) return null;
    return dynamic;
  }

  // Dynamic nonce: D1 fallback for KV propagation lag.
  // Static nonces are prefixed 'static-'; exclude them from this path.
  if (!nonce.startsWith('static-')) {
    const db = getDB();
    const row = await db
      .prepare('SELECT session_id, created_at, expires_at FROM nonce_log WHERE nonce = ? AND expires_at > ?')
      .bind(nonce, Date.now())
      .first<{ session_id: string; created_at: number; expires_at: number }>();
    if (row) {
      const session = await db
        .prepare('SELECT course_id FROM sessions WHERE id = ?')
        .bind(row.session_id)
        .first<{ course_id: string }>();
      if (session) {
        return {
          course_id: session.course_id,
          session_id: row.session_id,
          created_at: row.created_at,
          expires_at: row.expires_at,
        };
      }
    }
  }

  // Static nonce: try KV first, then fallback to DB
  const staticData = await kv.get<NonceData>(`nonce:static:${nonce}`, 'json');
  if (staticData) {
    return staticData; // static nonces don't expire by time
  }

  // DB fallback: KV may have expired but nonce is still valid if session is open
  if (nonce.startsWith('static-')) {
    const db = getDB();
    const row = await db
      .prepare('SELECT course_id, id AS session_id, status FROM sessions WHERE static_nonce = ? AND status = ?')
      .bind(nonce, 'open')
      .first<{ course_id: string; session_id: string }>();
    if (row) {
      return {
        course_id: row.course_id,
        session_id: row.session_id,
        created_at: Date.now(),
        expires_at: Date.now() + 86400000,
      };
    }
  }

  return null;
}
