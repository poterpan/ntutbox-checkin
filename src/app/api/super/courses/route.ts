import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function POST(req: NextRequest) {
  await requireSuperAdmin();
  const body = await req.json();
  const { id, name, semester, default_class_start, default_early_open_min, default_late_cutoff_min, default_weekday } = body;

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
