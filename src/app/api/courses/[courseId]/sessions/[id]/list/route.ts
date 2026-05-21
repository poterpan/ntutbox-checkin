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
      SELECT id, user_email, user_name, scan_time, status,
             is_manual, is_official_leave
      FROM attendance
      WHERE session_id = ? AND course_id = ?
      ORDER BY scan_time ASC
    `)
    .bind(id, courseId)
    .all();

  const sessionInfo = await db
    .prepare('SELECT status, qr_mode FROM sessions WHERE id = ? AND course_id = ?')
    .bind(id, courseId)
    .first<{ status: string; qr_mode: string }>();

  return NextResponse.json({
    attendance: attendance.results,
    session: sessionInfo,
  });
}
