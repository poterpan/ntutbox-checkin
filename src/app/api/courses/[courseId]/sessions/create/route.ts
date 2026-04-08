import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';
import { computeSessionTimes } from '@/lib/time';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const admin = await requireCourseAdmin(courseId);
  const db = getDB();

  const course = await db
    .prepare('SELECT * FROM courses WHERE id = ?')
    .bind(courseId)
    .first<{
      default_class_start: string;
      default_early_open_min: number;
      default_late_cutoff_min: number;
      timezone: string;
    }>();

  if (!course) {
    return NextResponse.json({ error: 'course_not_found' }, { status: 404 });
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: course.timezone });

  const times = computeSessionTimes(
    dateStr,
    course.default_class_start,
    course.default_early_open_min,
    course.default_late_cutoff_min,
    course.timezone,
  );

  const sessionId = crypto.randomUUID();

  try {
    await db.prepare(`
      INSERT INTO sessions (id, course_id, class_date, class_start_at, early_open_at, late_cutoff_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId, courseId, dateStr,
      times.class_start_at, times.early_open_at, times.late_cutoff_at,
      admin.email, Date.now(),
    ).run();
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'session_already_exists' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ session_id: sessionId, class_date: dateStr, ...times });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  await requireCourseAdmin(courseId);
  const db = getDB();
  const sessions = await db
    .prepare('SELECT * FROM sessions WHERE course_id = ? ORDER BY class_date DESC')
    .bind(courseId)
    .all();
  return NextResponse.json({ sessions: sessions.results });
}
