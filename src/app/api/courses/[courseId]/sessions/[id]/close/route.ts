import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; id: string }> },
) {
  const { courseId, id } = await params;
  await requireCourseAdmin(courseId);
  const db = getDB();

  await db.prepare(
    'UPDATE sessions SET status = ?, closed_at = ? WHERE id = ? AND course_id = ?'
  ).bind('closed', Date.now(), id, courseId).run();

  return NextResponse.json({ ok: true });
}
