import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getKV, getDB } from '@/lib/cloudflare';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; id: string }> },
) {
  const { courseId, id } = await params;
  await requireCourseAdmin(courseId);
  const { mode } = await req.json() as { mode: 'dynamic' | 'static' };
  const db = getDB();

  if (mode === 'static') {
    // Generate a long-lived static nonce (3 hours)
    const nonce = `static-${crypto.randomUUID()}`;
    const created_at = Date.now();
    const expires_at = created_at + 3 * 60 * 60 * 1000;

    const kv = getKV();
    await kv.put(
      `nonce:static:${nonce}`,
      JSON.stringify({ course_id: courseId, session_id: id, created_at, expires_at }),
      { expirationTtl: 3 * 60 * 60 },
    );

    await db.prepare(
      'UPDATE sessions SET qr_mode = ?, static_nonce = ? WHERE id = ? AND course_id = ?'
    ).bind('static', nonce, id, courseId).run();

    return NextResponse.json({ ok: true, mode: 'static', nonce });
  } else {
    // Switch back to dynamic
    await db.prepare(
      'UPDATE sessions SET qr_mode = ?, static_nonce = NULL WHERE id = ? AND course_id = ?'
    ).bind('dynamic', id, courseId).run();

    return NextResponse.json({ ok: true, mode: 'dynamic' });
  }
}
