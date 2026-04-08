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
      WHERE course_id = ? AND fingerprint_hash IS NOT NULL
      GROUP BY fingerprint_hash
      HAVING account_count > 1
      ORDER BY account_count DESC
    `)
    .bind(courseId)
    .all();

  const ipBurst = await db
    .prepare(`
      SELECT session_id, ip,
             COUNT(DISTINCT user_email) as cnt,
             GROUP_CONCAT(DISTINCT user_email) as users,
             MIN(scan_time) as first_scan,
             MAX(scan_time) as last_scan
      FROM attendance
      WHERE course_id = ?
      GROUP BY session_id, ip
      HAVING cnt >= 3
      ORDER BY cnt DESC
    `)
    .bind(courseId)
    .all();

  const fastReaction = await db
    .prepare(`
      SELECT id, user_email, session_id, scan_time, reaction_ms
      FROM attendance
      WHERE course_id = ? AND reaction_ms IS NOT NULL AND reaction_ms < 5000
      ORDER BY reaction_ms ASC
    `)
    .bind(courseId)
    .all();

  const fpDetails = await db
    .prepare(`
      SELECT id, user_email, session_id, fingerprint_hash, fingerprint_raw, scan_time
      FROM attendance
      WHERE course_id = ? AND fingerprint_hash IN (
        SELECT fingerprint_hash FROM attendance
        WHERE course_id = ? AND fingerprint_hash IS NOT NULL
        GROUP BY fingerprint_hash
        HAVING COUNT(DISTINCT user_email) > 1
      )
      ORDER BY fingerprint_hash, scan_time
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
