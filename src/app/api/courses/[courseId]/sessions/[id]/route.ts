import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; id: string }> },
) {
  const { courseId, id } = await params;
  await requireCourseAdmin(courseId);

  const db = getDB();

  // Verify session belongs to this course
  const session = await db
    .prepare('SELECT id FROM sessions WHERE id = ? AND course_id = ?')
    .bind(id, courseId)
    .first();
  if (!session) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Delete in correct order (FK constraints)
  await db.prepare('DELETE FROM attendance WHERE session_id = ? AND course_id = ?').bind(id, courseId).run();
  await db.prepare('DELETE FROM nonce_log WHERE session_id = ?').bind(id).run();
  await db.prepare('DELETE FROM sessions WHERE id = ? AND course_id = ?').bind(id, courseId).run();

  return NextResponse.json({ ok: true });
}
