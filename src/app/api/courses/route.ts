import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function GET() {
  const { email } = await getSessionUser();
  const db = getDB();

  const superAdmin = await db
    .prepare('SELECT email FROM super_admins WHERE email = ?')
    .bind(email)
    .first();

  let courses;
  if (superAdmin) {
    courses = await db
      .prepare("SELECT * FROM courses WHERE status = 'active' ORDER BY created_at DESC")
      .all();
  } else {
    courses = await db
      .prepare(`
        SELECT c.* FROM courses c
        INNER JOIN course_admins ca ON c.id = ca.course_id
        WHERE ca.email = ? AND c.status = 'active'
        ORDER BY c.created_at DESC
      `)
      .bind(email)
      .all();
  }

  return NextResponse.json({ courses: courses.results });
}
