import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

function csvEscape(val: unknown): string {
  let s = String(val ?? '');
  if (s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  await requireCourseAdmin(courseId);
  const db = getDB();

  const course = await db
    .prepare('SELECT name FROM courses WHERE id = ?')
    .bind(courseId)
    .first<{ name: string }>();

  const rows = await db
    .prepare(`
      SELECT a.user_email, a.user_name, a.scan_time, a.login_time, a.status,
             a.is_manual, a.manual_reason, a.ip, a.reaction_ms,
             s.class_date,
             es.student_id
      FROM attendance a
      INNER JOIN sessions s ON a.session_id = s.id
      LEFT JOIN enrolled_students es
        ON a.course_id = es.course_id AND a.user_email = es.email
      WHERE a.course_id = ?
      ORDER BY s.class_date ASC, a.scan_time ASC
    `)
    .bind(courseId)
    .all();

  const BOM = '\uFEFF';
  const header = ['"日期"', '"學號"', '"姓名"', '"Email"', '"掃碼時間"', '"登入時間"', '"狀態"', '"是否手動"', '"備註"', '"IP"', '"反應時間ms"'].join(',');
  const csvRows = rows.results.map((r: Record<string, unknown>) => {
    const scanDate = r.scan_time ? new Date(r.scan_time as number).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '';
    const loginDate = r.login_time ? new Date(r.login_time as number).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '';
    return [
      csvEscape(r.class_date), csvEscape(r.student_id), csvEscape(r.user_name), csvEscape(r.user_email),
      csvEscape(scanDate), csvEscape(loginDate), csvEscape(r.status),
      csvEscape(r.is_manual ? '是' : '否'), csvEscape(r.manual_reason),
      csvEscape(r.ip), csvEscape(r.reaction_ms),
    ].join(',');
  });

  const csv = BOM + header + '\n' + csvRows.join('\n');

  const courseName = course?.name ?? courseId;
  const filename = `attendance-${courseName}-全學期.csv`;
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance-semester.csv"; filename*=UTF-8''${encodedFilename}`,
    },
  });
}
