import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

// GET: list admins for this course
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  await requireCourseAdmin(courseId);
  const db = getDB();

  const admins = await db
    .prepare('SELECT * FROM course_admins WHERE course_id = ? ORDER BY added_at DESC')
    .bind(courseId)
    .all();

  return NextResponse.json({ admins: admins.results });
}

// POST: add a new admin
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const admin = await requireCourseAdmin(courseId);
  // Only instructor/owner/super can add admins
  if (admin.role === 'ta') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { email, name, role } = (await req.json()) as { email: string; name?: string; role?: string };
  if (!email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  }

  const validRoles = ['ta', 'instructor', 'owner'];
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }

  const db = getDB();
  try {
    await db.prepare(
      'INSERT INTO course_admins (course_id, email, name, role, added_at, added_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(courseId, email, name ?? null, role ?? 'ta', Date.now(), admin.email).run();
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'already_exists' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}

// DELETE: remove an admin
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const admin = await requireCourseAdmin(courseId);
  if (admin.role === 'ta') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { email } = (await req.json()) as { email: string };
  if (!email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  }

  const db = getDB();
  await db.prepare(
    'DELETE FROM course_admins WHERE course_id = ? AND email = ?'
  ).bind(courseId, email).run();

  return NextResponse.json({ ok: true });
}
