import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getKV, getDB } from '@/lib/cloudflare';
import { determineStatus } from '@/lib/status';

type PendingData = {
  course_id: string;
  session_id: string;
  nonce_created_at: number;
  scan_time: number;
  fingerprint: { visitorId?: string; components?: unknown } | null;
  ip: string | null;
  user_agent: string | null;
};

function logTerminal(req: NextRequest, outcome: string, pending_id: string | null) {
  console.log('[beacon]', JSON.stringify({
    phase: 'checkin_terminal',
    outcome,
    pending_id,
    ua: req.headers.get('user-agent'),
  }));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? 'ntut.org.tw';
  const pending_id = new URL(req.url).searchParams.get('pid');

  if (!session?.user?.email?.endsWith(`@${domain}`)) {
    logTerminal(req, 'invalid_domain', pending_id);
    return NextResponse.redirect(new URL('/error?code=invalid_domain', req.url));
  }

  if (!pending_id) {
    logTerminal(req, 'no_pid_dashboard_redirect', null);
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  const kv = getKV();
  const pending = await kv.get<PendingData>(`pending:${pending_id}`, 'json');
  if (!pending) {
    logTerminal(req, 'pending_expired', pending_id);
    return NextResponse.redirect(new URL('/error?code=pending_expired', req.url));
  }

  await kv.delete(`pending:${pending_id}`);

  const db = getDB();
  const sessionRow = await db
    .prepare('SELECT early_open_at, class_start_at, late_cutoff_at, status FROM sessions WHERE id = ?')
    .bind(pending.session_id)
    .first<{ early_open_at: number; class_start_at: number; late_cutoff_at: number; status: string }>();

  if (!sessionRow) {
    logTerminal(req, 'invalid_session', pending_id);
    return NextResponse.redirect(new URL('/error?code=invalid_session', req.url));
  }

  if (sessionRow.status !== 'open') {
    logTerminal(req, 'session_closed', pending_id);
    return NextResponse.redirect(new URL('/error?code=session_closed', req.url));
  }

  const status = determineStatus(
    pending.scan_time,
    sessionRow.early_open_at,
    sessionRow.class_start_at,
    sessionRow.late_cutoff_at,
  );

  const t = pending.scan_time;

  if (status === 'too_early') {
    logTerminal(req, 'too_early', pending_id);
    return NextResponse.redirect(new URL(`/result?status=too_early&t=${t}`, req.url));
  }

  const reaction_ms = pending.scan_time - pending.nonce_created_at;

  try {
    await db.prepare(`
      INSERT INTO attendance
        (session_id, course_id, user_email, user_name,
         scan_time, login_time, status,
         fingerprint_hash, fingerprint_raw,
         ip, user_agent, reaction_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      pending.session_id,
      pending.course_id,
      session.user.email,
      session.user.name ?? null,
      pending.scan_time,
      Date.now(),
      status,
      pending.fingerprint?.visitorId ?? null,
      pending.fingerprint?.components ? JSON.stringify(pending.fingerprint.components) : null,
      pending.ip,
      pending.user_agent,
      reaction_ms,
      Date.now(),
    ).run();
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('UNIQUE')) {
      logTerminal(req, 'already_signed', pending_id);
      return NextResponse.redirect(new URL(`/result?status=already_signed&t=${t}`, req.url));
    }
    throw err;
  }

  logTerminal(req, status, pending_id);
  return NextResponse.redirect(new URL(`/result?status=${status}&t=${t}`, req.url));
}
