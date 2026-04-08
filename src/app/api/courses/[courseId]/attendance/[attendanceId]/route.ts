import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

// PATCH: mark as reviewed
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; attendanceId: string }> },
) {
  const { courseId, attendanceId } = await params;
  const admin = await requireCourseAdmin(courseId);
  const db = getDB();

  await db.prepare(
    'UPDATE attendance SET reviewed_at = ?, reviewed_by = ? WHERE id = ? AND course_id = ?'
  ).bind(Date.now(), admin.email, attendanceId, courseId).run();

  return NextResponse.json({ ok: true });
}

// DELETE: remove record
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; attendanceId: string }> },
) {
  const { courseId, attendanceId } = await params;
  await requireCourseAdmin(courseId);
  const db = getDB();

  await db.prepare(
    'DELETE FROM attendance WHERE id = ? AND course_id = ?'
  ).bind(attendanceId, courseId).run();

  return NextResponse.json({ ok: true });
}
