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

  const allEnrolled = await db
    .prepare('SELECT email, student_id, name FROM enrolled_students WHERE course_id = ?')
    .bind(courseId)
    .all<{ email: string; student_id: string | null; name: string | null }>();

  const enrolledEmails = new Set(allEnrolled.results.map((e) => e.email));
  const signedEmails = new Set(
    attendance.results.map((a) => (a as unknown as { user_email: string }).user_email),
  );
  const notSigned = allEnrolled.results.filter((e) => !signedEmails.has(e.email));

  const attendanceWithEnrolled = attendance.results.map((a) => {
    const row = a as unknown as { user_email: string };
    return { ...a, enrolled: enrolledEmails.has(row.user_email) };
  });

  const sessionInfo = await db
    .prepare('SELECT status, qr_mode FROM sessions WHERE id = ? AND course_id = ?')
    .bind(id, courseId)
    .first<{ status: string; qr_mode: string }>();

  return NextResponse.json({
    attendance: attendanceWithEnrolled,
    not_signed: notSigned,
    has_roster: allEnrolled.results.length > 0,
    session: sessionInfo,
  });
}
