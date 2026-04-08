import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  await requireCourseAdmin(courseId);

  const db = getDB();

  const fpCrossAccount = await db
    .prepare(`
      SELECT fingerprint_hash,
             COUNT(DISTINCT user_email) as account_count,
             GROUP_CONCAT(DISTINCT user_email) as accounts,
             COUNT(*) as total_signs
      FROM attendance
      WHERE course_id = ? AND fingerprint_hash IS NOT NULL AND reviewed_at IS NULL
      GROUP BY fingerprint_hash
      HAVING account_count > 1
      ORDER BY account_count DESC
    `)
    .bind(courseId)
    .all();

  const ipBurst = await db
    .prepare(`
      SELECT a.session_id, s.class_date, a.ip,
             COUNT(DISTINCT a.user_email) as cnt,
             GROUP_CONCAT(DISTINCT a.user_email) as users,
             MIN(a.scan_time) as first_scan,
             MAX(a.scan_time) as last_scan
      FROM attendance a
      INNER JOIN sessions s ON a.session_id = s.id
      WHERE a.course_id = ?
      GROUP BY a.session_id, a.ip
      HAVING cnt >= 3
      ORDER BY cnt DESC
    `)
    .bind(courseId)
    .all();

  const fastReaction = await db
    .prepare(`
      SELECT a.id, a.user_email, a.session_id, s.class_date, a.scan_time, a.reaction_ms
      FROM attendance a
      INNER JOIN sessions s ON a.session_id = s.id
      WHERE a.course_id = ? AND a.reaction_ms IS NOT NULL AND a.reaction_ms < 5000 AND a.reviewed_at IS NULL
      ORDER BY a.reaction_ms ASC
    `)
    .bind(courseId)
    .all();

  const fpDetails = await db
    .prepare(`
      SELECT a.id, a.user_email, a.session_id, s.class_date, a.fingerprint_hash, a.fingerprint_raw, a.scan_time
      FROM attendance a
      INNER JOIN sessions s ON a.session_id = s.id
      WHERE a.course_id = ? AND a.reviewed_at IS NULL AND a.fingerprint_hash IN (
        SELECT fingerprint_hash FROM attendance
        WHERE course_id = ? AND fingerprint_hash IS NOT NULL AND reviewed_at IS NULL
        GROUP BY fingerprint_hash
        HAVING COUNT(DISTINCT user_email) > 1
      )
      ORDER BY a.fingerprint_hash, a.scan_time
    `)
    .bind(courseId, courseId)
    .all();

  return NextResponse.json({
    fp_cross_account: fpCrossAccount.results,
    ip_burst: ipBurst.results,
    fast_reaction: fastReaction.results,
    fp_details: fpDetails.results,
  });
}
