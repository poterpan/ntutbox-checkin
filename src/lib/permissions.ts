import { auth } from '@/lib/auth';
import { getDB } from '@/lib/cloudflare';

export type AdminInfo = {
  role: 'super' | 'owner' | 'instructor' | 'ta';
  email: string;
};

export type SessionUser = { email: string; name: string | null };

/**
 * Return-based session lookup.
 *
 * Prefer this in new route handlers. `getSessionUser` below signals failure
 * with `throw new Response(...)`, which is a Remix idiom — Next's App Router
 * treats a thrown Response as an unhandled error and serves an empty-bodied
 * 500, so callers can never see the intended 401/403. Returning null lets the
 * handler `return` a real status the client can branch on.
 */
export async function getSessionUserOrNull(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  return { email: session.user.email, name: session.user.name ?? null };
}

export async function getSessionUser(): Promise<{ email: string; name: string | null }> {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return { email: session.user.email, name: session.user.name ?? null };
}

export async function requireCourseAdmin(courseId: string): Promise<AdminInfo> {
  const { email } = await getSessionUser();
  const db = getDB();

  // Check super_admins first
  const superAdmin = await db
    .prepare('SELECT email FROM super_admins WHERE email = ?')
    .bind(email)
    .first();
  if (superAdmin) return { role: 'super', email };

  // Check course_admins
  const courseAdmin = await db
    .prepare('SELECT role FROM course_admins WHERE course_id = ? AND email = ?')
    .bind(courseId, email)
    .first<{ role: string }>();
  if (courseAdmin) return { role: courseAdmin.role as AdminInfo['role'], email };

  throw new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function requireSuperAdmin(): Promise<AdminInfo> {
  const { email } = await getSessionUser();
  const db = getDB();

  const superAdmin = await db
    .prepare('SELECT email FROM super_admins WHERE email = ?')
    .bind(email)
    .first();
  if (superAdmin) return { role: 'super', email };

  throw new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
