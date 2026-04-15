import { NextRequest, NextResponse } from 'next/server';
import { getKV, getDB } from '@/lib/cloudflare';
import { validateNonce } from '@/lib/nonce';

export async function POST(req: NextRequest) {
  const { nonce, fingerprint } = await req.json() as { nonce?: string; fingerprint?: unknown };

  if (!nonce) {
    return NextResponse.json({ error: 'missing_nonce' }, { status: 400 });
  }

  const nonceData = await validateNonce(nonce);
  if (!nonceData) {
    return NextResponse.json({ error: 'invalid_nonce' }, { status: 400 });
  }

  // Dynamic nonces are NOT consumed (single-use) — multiple students may scan
  // the same QR within its 30s display window. Per-student duplicate prevention
  // is enforced by attendance.UNIQUE(session_id, user_email).

  // Check session is still open and not past class date
  const db = getDB();
  const session = await db
    .prepare('SELECT status, class_date FROM sessions WHERE id = ?')
    .bind(nonceData.session_id)
    .first<{ status: string; class_date: string }>();
  if (!session || session.status !== 'open') {
    return NextResponse.json({ error: 'session_closed' }, { status: 400 });
  }

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  if (session.class_date < today) {
    return NextResponse.json({ error: 'session_expired' }, { status: 400 });
  }

  // Create pending record in KV
  const pending_id = crypto.randomUUID();
  const scan_time = Date.now();

  const kv = getKV();
  await kv.put(
    `pending:${pending_id}`,
    JSON.stringify({
      course_id: nonceData.course_id,
      session_id: nonceData.session_id,
      nonce_created_at: nonceData.created_at,
      scan_time,
      fingerprint: fingerprint ?? null,
      ip: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
    }),
    { expirationTtl: 600 },
  );

  return NextResponse.json({ pending_id, scan_time });
}
