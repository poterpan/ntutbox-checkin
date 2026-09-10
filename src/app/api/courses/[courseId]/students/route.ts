import { NextRequest, NextResponse } from 'next/server';
import { checkCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const access = await checkCourseAdmin(courseId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = getDB();
  const rows = await db
    .prepare('SELECT email, student_id, name, added_at FROM enrolled_students WHERE course_id = ? ORDER BY student_id')
    .bind(courseId)
    .all();
  return NextResponse.json({ students: rows.results });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const access = await checkCourseAdmin(courseId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { students } = await req.json() as { students: { email: string; student_id?: string; name?: string }[] };
  const db = getDB();
  const now = Date.now();

  for (const s of students) {
    await db.prepare(
      'INSERT OR REPLACE INTO enrolled_students (course_id, email, student_id, name, added_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(courseId, s.email, s.student_id ?? null, s.name ?? null, now).run();
  }

  return NextResponse.json({ ok: true, count: students.length });
}
