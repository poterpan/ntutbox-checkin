import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; id: string }> },
) {
  const { courseId, id } = await params;
  await requireCourseAdmin(courseId);

  const db = getDB();
  const attendance = await db
    .prepare(`
      SELECT id, user_email, user_name, scan_time, login_time, status,
             fingerprint_hash, fingerprint_raw, ip, user_agent, reaction_ms, is_manual, created_at
      FROM attendance
      WHERE session_id = ? AND course_id = ?
      ORDER BY scan_time ASC
    `)
    .bind(id, courseId)
    .all();

  const enrolled = await db
    .prepare(`
      SELECT es.email, es.student_id, es.name
      FROM enrolled_students es
      WHERE es.course_id = ?
        AND es.email NOT IN (
          SELECT user_email FROM attendance WHERE session_id = ?
        )
    `)
    .bind(courseId, id)
    .all();

  const sessionInfo = await db
    .prepare('SELECT status, qr_mode FROM sessions WHERE id = ? AND course_id = ?')
    .bind(id, courseId)
    .first<{ status: string; qr_mode: string }>();

  return NextResponse.json({
    attendance: attendance.results,
    not_signed: enrolled.results,
    session: sessionInfo,
  });
}
