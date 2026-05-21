import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

// GET: heavy detail fields for the row-expanded view (kept out of polling /list)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; attendanceId: string }> },
) {
  const { courseId, attendanceId } = await params;
  await requireCourseAdmin(courseId);
  const db = getDB();

  const detail = await db
    .prepare(
      'SELECT fingerprint_hash, fingerprint_raw, ip, user_agent, reaction_ms FROM attendance WHERE id = ? AND course_id = ?'
    )
    .bind(attendanceId, courseId)
    .first<{
      fingerprint_hash: string | null;
      fingerprint_raw: string | null;
      ip: string | null;
      user_agent: string | null;
      reaction_ms: number | null;
    }>();

  if (!detail) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(detail);
}

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
