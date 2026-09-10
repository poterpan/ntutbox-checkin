import { auth } from '@/lib/auth';
import { getDB } from '@/lib/cloudflare';

export type AdminInfo = {
  role: 'super' | 'owner' | 'instructor' | 'ta';
  email: string;
};

export type SessionUser = { email: string; name: string | null };

/**
 * Access checks are return-based on purpose.
 *
 * These used to signal failure by throwing a Response object, a Remix idiom.
 * Next's App Router treats a thrown Response as an unhandled error and serves
 * an empty-bodied 500, so the intended 401/403 never reached the client — an
 * unauthenticated device got a 500 and no way to tell that it just needed to
 * sign in. Handlers now `return` the status themselves:
 *
 *   const access = await checkCourseAdmin(courseId);
 *   if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
 */
export type AccessResult =
  | { ok: true; admin: AdminInfo }
  | { ok: false; status: 401; error: 'unauthorized' }
  | { ok: false; status: 403; error: 'forbidden' };

const UNAUTHORIZED = { ok: false, status: 401, error: 'unauthorized' } as const;
const FORBIDDEN = { ok: false, status: 403, error: 'forbidden' } as const;

export async function getSessionUserOrNull(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  return { email: session.user.email, name: session.user.name ?? null };
}

async function isSuperAdmin(email: string): Promise<boolean> {
  const row = await getDB()
    .prepare('SELECT email FROM super_admins WHERE email = ?')
    .bind(email)
    .first();
  return !!row;
}

/** Super admins pass for every course; otherwise the course_admins row decides. */
export async function checkCourseAdmin(courseId: string): Promise<AccessResult> {
  const user = await getSessionUserOrNull();
  if (!user) return UNAUTHORIZED;
  const { email } = user;

  if (await isSuperAdmin(email)) return { ok: true, admin: { role: 'super', email } };

  const courseAdmin = await getDB()
    .prepare('SELECT role FROM course_admins WHERE course_id = ? AND email = ?')
    .bind(courseId, email)
    .first<{ role: string }>();
  if (courseAdmin) {
    return { ok: true, admin: { role: courseAdmin.role as AdminInfo['role'], email } };
  }

  return FORBIDDEN;
}

export async function checkSuperAdmin(): Promise<AccessResult> {
  const user = await getSessionUserOrNull();
  if (!user) return UNAUTHORIZED;
  const { email } = user;

  if (await isSuperAdmin(email)) return { ok: true, admin: { role: 'super', email } };

  return FORBIDDEN;
}
