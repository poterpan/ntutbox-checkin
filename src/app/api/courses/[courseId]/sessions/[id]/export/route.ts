import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; id: string }> },
) {
  const { courseId, id } = await params;
  await requireCourseAdmin(courseId);

  const db = getDB();
  const rows = await db
    .prepare(`
      SELECT a.user_email, a.user_name, a.scan_time, a.login_time, a.status,
             a.is_manual, a.manual_reason, a.ip, a.reaction_ms,
             es.student_id
      FROM attendance a
      LEFT JOIN enrolled_students es
        ON a.course_id = es.course_id AND a.user_email = es.email
      WHERE a.session_id = ? AND a.course_id = ?
      ORDER BY a.scan_time ASC
    `)
    .bind(id, courseId)
    .all();

  const session = await db
    .prepare('SELECT class_date FROM sessions WHERE id = ?')
    .bind(id)
    .first<{ class_date: string }>();

  const BOM = '\uFEFF';
  const header = '學號,姓名,Email,掃碼時間,登入時間,狀態,是否手動,備註,IP,反應時間ms';
  const csvRows = rows.results.map((r: Record<string, unknown>) => {
    const scanDate = r.scan_time ? new Date(r.scan_time as number).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '';
    const loginDate = r.login_time ? new Date(r.login_time as number).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '';
    return [
      r.student_id ?? '', r.user_name ?? '', r.user_email,
      scanDate, loginDate, r.status,
      r.is_manual ? '是' : '否', r.manual_reason ?? '',
      r.ip ?? '', r.reaction_ms ?? '',
    ].join(',');
  });

  const csv = BOM + header + '\n' + csvRows.join('\n');
  const filename = `attendance-${session?.class_date ?? id}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
