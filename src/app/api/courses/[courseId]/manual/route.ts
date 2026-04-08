import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const admin = await requireCourseAdmin(courseId);
  const { session_id, user_email, user_name, reason } = await req.json();

  if (!session_id || !user_email) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const db = getDB();
  const now = Date.now();

  try {
    await db.prepare(`
      INSERT INTO attendance
        (session_id, course_id, user_email, user_name,
         scan_time, login_time, status,
         is_manual, manual_reason, manual_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'manual', 1, ?, ?, ?)
    `).bind(
      session_id, courseId, user_email, user_name ?? null,
      now, now, reason ?? null, admin.email, now,
    ).run();
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'already_signed' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
