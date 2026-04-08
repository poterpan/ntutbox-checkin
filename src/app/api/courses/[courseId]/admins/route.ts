import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

const ROLE_LEVEL: Record<string, number> = { ta: 1, instructor: 2, owner: 3, super: 4 };

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

  const callerLevel = ROLE_LEVEL[admin.role] ?? 0;
  const targetLevel = ROLE_LEVEL[role ?? 'ta'] ?? 0;
  if (targetLevel > callerLevel) {
    return NextResponse.json({ error: 'cannot_assign_higher_role' }, { status: 403 });
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

  // Prevent deleting the last owner
  const target = await db.prepare('SELECT role FROM course_admins WHERE course_id = ? AND email = ?').bind(courseId, email).first<{ role: string }>();
  if (target?.role === 'owner') {
    const ownerCount = await db.prepare('SELECT COUNT(*) as cnt FROM course_admins WHERE course_id = ? AND role = ?').bind(courseId, 'owner').first<{ cnt: number }>();
    if ((ownerCount?.cnt ?? 0) <= 1) {
      return NextResponse.json({ error: 'cannot_delete_last_owner' }, { status: 400 });
    }
  }

  await db.prepare(
    'DELETE FROM course_admins WHERE course_id = ? AND email = ?'
  ).bind(courseId, email).run();

  return NextResponse.json({ ok: true });
}
