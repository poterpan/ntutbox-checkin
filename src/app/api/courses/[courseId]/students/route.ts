import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  await requireCourseAdmin(courseId);
  const { students } = await req.json();
  const db = getDB();
  const now = Date.now();

  for (const s of students) {
    await db.prepare(
      'INSERT OR REPLACE INTO enrolled_students (course_id, email, student_id, name, added_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(courseId, s.email, s.student_id ?? null, s.name ?? null, now).run();
  }

  return NextResponse.json({ ok: true, count: students.length });
}
