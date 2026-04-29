import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

type OpenSession = {
  session_id: string;
  course_id: string;
  course_name: string;
  class_date: string;
  qr_mode: string;
  created_at: number;
};

export async function GET() {
  const { email } = await getSessionUser();
  const db = getDB();

  const superAdmin = await db
    .prepare('SELECT email FROM super_admins WHERE email = ?')
    .bind(email)
    .first();

  let sessions;
  if (superAdmin) {
    sessions = await db
      .prepare(`
        SELECT s.id AS session_id, s.course_id, c.name AS course_name,
               s.class_date, s.qr_mode, s.created_at
        FROM sessions s
        INNER JOIN courses c ON c.id = s.course_id
        WHERE s.status = 'open' AND c.status = 'active'
        ORDER BY s.class_date ASC, s.created_at ASC
      `)
      .all<OpenSession>();
  } else {
    sessions = await db
      .prepare(`
        SELECT s.id AS session_id, s.course_id, c.name AS course_name,
               s.class_date, s.qr_mode, s.created_at
        FROM sessions s
        INNER JOIN courses c ON c.id = s.course_id
        INNER JOIN course_admins ca ON ca.course_id = c.id
        WHERE s.status = 'open' AND c.status = 'active' AND ca.email = ?
        ORDER BY s.class_date ASC, s.created_at ASC
      `)
      .bind(email)
      .all<OpenSession>();
  }

  return NextResponse.json({ sessions: sessions.results });
}
