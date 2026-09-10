import { NextRequest, NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function POST(req: NextRequest) {
  const access = await checkSuperAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id, name, semester, default_class_start, default_early_open_min, default_late_cutoff_min, default_weekday } = await req.json() as {
    id?: string; name?: string; semester?: string; default_class_start?: string;
    default_early_open_min?: number; default_late_cutoff_min?: number; default_weekday?: number | null;
  };

  if (!id || !name || !semester || !default_class_start) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // These feed computeSessionTimes at session-create time. A malformed value
  // yields NaN boundaries and a course whose sessions nobody can check into,
  // so reject it here rather than writing an unusable course.
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(default_class_start)) {
    return NextResponse.json({ error: 'invalid_class_start' }, { status: 400 });
  }

  const inRange = (v: number | undefined, max: number) =>
    v === undefined || (Number.isInteger(v) && v >= 0 && v <= max);

  if (!inRange(default_early_open_min, 1440) || !inRange(default_late_cutoff_min, 1440)) {
    return NextResponse.json({ error: 'invalid_minutes' }, { status: 400 });
  }

  if (default_weekday != null && !(Number.isInteger(default_weekday) && default_weekday >= 0 && default_weekday <= 6)) {
    return NextResponse.json({ error: 'invalid_weekday' }, { status: 400 });
  }

  const db = getDB();
  try {
    await db.prepare(`
      INSERT INTO courses (id, name, semester, default_class_start,
                           default_early_open_min, default_late_cutoff_min,
                           default_weekday, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, name, semester, default_class_start,
      default_early_open_min ?? 30, default_late_cutoff_min ?? 10,
      default_weekday ?? null, Date.now(),
    ).run();
  } catch (err: unknown) {
    // courses.id is the primary key. Retyping an existing code is an easy
    // mistake to make, and an unhandled throw here surfaced as "失敗: undefined".
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('UNIQUE') || msg.includes('PRIMARY KEY')) {
      return NextResponse.json({ error: 'course_already_exists' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, course_id: id });
}

export async function DELETE(req: NextRequest) {
  const access = await checkSuperAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await req.json() as { id: string };
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const db = getDB();

  // Atomic delete: attendance → nonce_log → sessions → course_admins → enrolled_students → courses
  await db.batch([
    db.prepare('DELETE FROM attendance WHERE course_id = ?').bind(id),
    db.prepare('DELETE FROM nonce_log WHERE session_id IN (SELECT id FROM sessions WHERE course_id = ?)').bind(id),
    db.prepare('DELETE FROM sessions WHERE course_id = ?').bind(id),
    db.prepare('DELETE FROM course_admins WHERE course_id = ?').bind(id),
    db.prepare('DELETE FROM enrolled_students WHERE course_id = ?').bind(id),
    db.prepare('DELETE FROM courses WHERE id = ?').bind(id),
  ]);

  return NextResponse.json({ ok: true });
}
