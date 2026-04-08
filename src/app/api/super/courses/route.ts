import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function POST(req: NextRequest) {
  await requireSuperAdmin();
  const { id, name, semester, default_class_start, default_early_open_min, default_late_cutoff_min, default_weekday } = await req.json() as {
    id?: string; name?: string; semester?: string; default_class_start?: string;
    default_early_open_min?: number; default_late_cutoff_min?: number; default_weekday?: number;
  };

  if (!id || !name || !semester || !default_class_start) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const db = getDB();
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

  return NextResponse.json({ ok: true, course_id: id });
}

export async function DELETE(req: NextRequest) {
  await requireSuperAdmin();
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
