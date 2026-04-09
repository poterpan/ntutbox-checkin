import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/cloudflare';

export const runtime = 'edge';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }

  const db = getDB();
  const rows = await db
    .prepare(
      `SELECT a.status, a.scan_time, a.is_manual,
              s.class_date, c.name AS course_name
       FROM attendance a
       JOIN sessions s ON s.id = a.session_id
       JOIN courses c ON c.id = a.course_id
       WHERE a.user_email = ?
       ORDER BY s.class_date DESC, a.scan_time DESC
       LIMIT 100`,
    )
    .bind(session.user.email)
    .all();

  return NextResponse.json({ records: rows.results });
}
