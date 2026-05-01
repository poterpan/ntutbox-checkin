import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; attendanceId: string }> },
) {
  const { courseId, attendanceId } = await params;
  const admin = await requireCourseAdmin(courseId);
  const { status } = await req.json() as { status: string };

  const validStatuses = ['on_time', 'late', 'absent', 'leave', 'manual'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const db = getDB();
  // When transitioning away from 'leave', the official-leave flag is no longer
  // meaningful — clear it to 0. When staying on or transitioning to 'leave',
  // preserve whatever value is already there (UI doesn't expose toggling here in v1).
  if (status === 'leave') {
    await db.prepare(
      'UPDATE attendance SET status = ?, manual_by = ?, manual_reason = ? WHERE id = ? AND course_id = ?'
    ).bind(status, admin.email, `狀態修改為 ${status}`, attendanceId, courseId).run();
  } else {
    await db.prepare(
      'UPDATE attendance SET status = ?, manual_by = ?, manual_reason = ?, is_official_leave = 0 WHERE id = ? AND course_id = ?'
    ).bind(status, admin.email, `狀態修改為 ${status}`, attendanceId, courseId).run();
  }

  return NextResponse.json({ ok: true });
}
