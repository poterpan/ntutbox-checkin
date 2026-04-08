import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getKV, getDB } from '@/lib/cloudflare';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; id: string }> },
) {
  const { courseId, id } = await params;
  await requireCourseAdmin(courseId);

  const db = getDB();
  const session = await db
    .prepare('SELECT status, qr_mode, static_nonce FROM sessions WHERE id = ? AND course_id = ?')
    .bind(id, courseId)
    .first<{ status: string; qr_mode: string; static_nonce: string | null }>();

  if (!session || session.status !== 'open') {
    return NextResponse.json({ error: 'session_not_open' }, { status: 400 });
  }

  if (session.qr_mode === 'static' && session.static_nonce) {
    return NextResponse.json({ nonce: session.static_nonce, mode: 'static', expires_at: null });
  }

  const nonce = crypto.randomUUID();
  const created_at = Date.now();
  const expires_at = created_at + 45_000; // 45s TTL (15s buffer over 30s refresh)

  const kv = getKV();
  await kv.put(
    `nonce:${nonce}`,
    JSON.stringify({ course_id: courseId, session_id: id, created_at, expires_at }),
    { expirationTtl: 45 },
  );

  await db.prepare(
    'INSERT INTO nonce_log (nonce, session_id, created_at) VALUES (?, ?, ?)',
  ).bind(nonce, id, created_at).run();

  return NextResponse.json({ nonce, mode: 'dynamic', expires_at });
}
