import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/cloudflare';

/**
 * Auto-redirect to the latest open session's projector page.
 * If no open session, redirect to dashboard.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/api/auth/signin?callbackUrl=/api/projector/redirect', req.url));
  }

  const db = getDB();
  const email = session.user.email;

  // Find the latest open session for any course this admin manages
  const row = await db.prepare(`
    SELECT s.id as session_id, s.course_id
    FROM sessions s
    WHERE s.status = 'open'
      AND (
        s.course_id IN (SELECT course_id FROM course_admins WHERE email = ?)
        OR EXISTS (SELECT 1 FROM super_admins WHERE email = ?)
      )
    ORDER BY s.created_at DESC
    LIMIT 1
  `).bind(email, email).first<{ session_id: string; course_id: string }>();

  if (row) {
    return NextResponse.redirect(
      new URL(`/courses/${row.course_id}/sessions/${row.session_id}/projector`, req.url)
    );
  }

  // No open session — go to dashboard
  return NextResponse.redirect(new URL('/dashboard', req.url));
}
