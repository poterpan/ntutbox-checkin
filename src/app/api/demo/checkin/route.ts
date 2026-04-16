import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/cloudflare';

export async function GET(req: NextRequest) {
  const session = await auth();
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? 'ntut.org.tw';

  if (!session?.user?.email?.endsWith(`@${domain}`)) {
    return NextResponse.redirect(new URL('/error?code=invalid_domain', req.url));
  }

  const now = Date.now();
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    null;
  const userAgent = req.headers.get('user-agent') ?? null;

  const db = getDB();

  await db.prepare(`
    INSERT INTO demo_attendance
      (user_email, user_name, checkin_time, ip, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      user_name    = excluded.user_name,
      checkin_time = excluded.checkin_time,
      ip           = excluded.ip,
      user_agent   = excluded.user_agent
  `).bind(
    session.user.email,
    session.user.name ?? null,
    now,
    ip,
    userAgent,
    now,
  ).run();

  return NextResponse.redirect(new URL(`/demo/result?t=${now}`, req.url));
}
