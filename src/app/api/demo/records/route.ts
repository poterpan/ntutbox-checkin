import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/cloudflare';

export async function GET() {
  const session = await auth();
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? 'ntut.org.tw';

  if (!session?.user?.email?.endsWith(`@${domain}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDB();
  const result = await db
    .prepare(`
      SELECT id, user_email, user_name, checkin_time, created_at
      FROM demo_attendance
      ORDER BY checkin_time DESC
    `)
    .all();

  return NextResponse.json({ records: result.results });
}
