import { NextRequest, NextResponse } from 'next/server';
import { checkCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; id: string }> },
) {
  const { courseId, id } = await params;
  const access = await checkCourseAdmin(courseId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = getDB();

  await db.prepare(
    'UPDATE sessions SET status = ?, closed_at = NULL WHERE id = ? AND course_id = ?'
  ).bind('open', id, courseId).run();

  return NextResponse.json({ ok: true });
}
