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
    .prepare('SELECT s.status, s.qr_mode, s.static_nonce, s.class_date, c.name as course_name FROM sessions s INNER JOIN courses c ON s.course_id = c.id WHERE s.id = ? AND s.course_id = ?')
    .bind(id, courseId)
    .first<{ status: string; qr_mode: string; static_nonce: string | null; class_date: string; course_name: string }>();

  if (!session || session.status !== 'open') {
    return NextResponse.json({ error: 'session_not_open' }, { status: 400 });
  }

  const meta = { course_name: session.course_name, class_date: session.class_date };

  if (session.qr_mode === 'static' && session.static_nonce) {
    return NextResponse.json({ nonce: session.static_nonce, mode: 'static', expires_at: null, ...meta });
  }

  const nonce = crypto.randomUUID();
  const created_at = Date.now();
  const expires_at = created_at + 60_000; // 60s TTL (KV minimum), 30s buffer over 30s refresh

  const kv = getKV();
  await kv.put(
    `nonce:${nonce}`,
    JSON.stringify({ course_id: courseId, session_id: id, created_at, expires_at }),
    { expirationTtl: 60 },
  );

  await db.prepare(
    'INSERT INTO nonce_log (nonce, session_id, created_at) VALUES (?, ?, ?)',
  ).bind(nonce, id, created_at).run();

  return NextResponse.json({ nonce, mode: 'dynamic', expires_at, ...meta });
}
