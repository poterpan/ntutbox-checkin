/**
 * Import historical attendance from Excel into local D1.
 * Usage: node scripts/import-excel.mjs
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const EXCEL_PATH = '/Users/poterpan/Documents/Coding/LLM/seminar-auto-grade-reports/114-2_grade.xlsx';
const COURSE_ID = 'iai-seminar-2026s';
const CREATED_BY = 't114c73029@ntut.org.tw';

// Date mapping: column header → class_date (2026)
const DATE_MAP = {
  '第一週': '2026-02-25',
  '3/4': '2026-03-04',
  '3/11': '2026-03-11',
  '3/18': '2026-03-18',
  // skip 3/25 (holiday)
  '4/1': '2026-04-01',
  '4/8': '2026-04-08',
};

// Class time: 13:10 Taiwan time, early_open 12:40, late_cutoff 13:20
function getSessionTimes(dateStr) {
  const base = new Date(dateStr + 'T13:10:00+08:00');
  const class_start_at = base.getTime();
  const early_open_at = class_start_at - 30 * 60 * 1000;
  const late_cutoff_at = class_start_at + 10 * 60 * 1000;
  return { class_start_at, early_open_at, late_cutoff_at };
}

// Status mapping from Excel values
function mapStatus(val) {
  if (val === null || val === undefined || val === '') return 'on_time';
  const v = String(val).trim();
  if (v === '遲') return 'late';
  if (v === '缺') return 'absent';
  if (v === '假') return 'leave';
  return 'on_time';
}

function sql(cmd) {
  const result = execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--command', cmd], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result;
}

// ── Main ────────────────────────────────────────────────────
const wb = XLSX.readFile(EXCEL_PATH);
const ws = wb.Sheets['點名+提問'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
const header = rows[0];

// Find column indices for each date
const colMap = {};
for (const [label, date] of Object.entries(DATE_MAP)) {
  const idx = header.indexOf(label);
  if (idx === -1) { console.error(`Column "${label}" not found`); process.exit(1); }
  colMap[date] = idx;
}

// Parse students (rows 1..N until empty student_id)
const students = [];
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const sid = row[0];
  if (!sid || String(sid).trim() === '') break;
  students.push({
    student_id: String(sid).trim(),
    name: String(row[1]).trim(),
    email: `t${String(sid).trim().toLowerCase()}@ntut.org.tw`,
    row,
  });
}
console.log(`Found ${students.length} students`);

// 1. Delete existing test data
console.log('\n── Cleaning existing data ──');
sql(`DELETE FROM attendance WHERE course_id = '${COURSE_ID}'`);
sql(`DELETE FROM nonce_log WHERE session_id IN (SELECT id FROM sessions WHERE course_id = '${COURSE_ID}')`);
sql(`DELETE FROM sessions WHERE course_id = '${COURSE_ID}'`);
sql(`DELETE FROM enrolled_students WHERE course_id = '${COURSE_ID}'`);
console.log('Cleared existing sessions, attendance, enrolled_students');

// 2. Insert enrolled students
console.log('\n── Inserting enrolled students ──');
const now = Date.now();
for (const s of students) {
  sql(`INSERT INTO enrolled_students (course_id, email, student_id, name, added_at) VALUES ('${COURSE_ID}', '${s.email}', '${s.student_id}', '${s.name}', ${now})`);
}
console.log(`Inserted ${students.length} enrolled students`);

// 3. Create sessions and attendance
console.log('\n── Creating sessions & attendance ──');
let totalAttendance = 0;

for (const [date, colIdx] of Object.entries(colMap)) {
  const { class_start_at, early_open_at, late_cutoff_at } = getSessionTimes(date);
  const sessionId = `imported-${date}`;

  sql(`INSERT INTO sessions (id, course_id, class_date, class_start_at, early_open_at, late_cutoff_at, qr_mode, status, created_by, created_at) VALUES ('${sessionId}', '${COURSE_ID}', '${date}', ${class_start_at}, ${early_open_at}, ${late_cutoff_at}, 'dynamic', 'closed', '${CREATED_BY}', ${now})`);

  let count = 0;
  for (const s of students) {
    const val = s.row[colIdx];
    const status = mapStatus(val);

    let scan_time;
    if (status === 'on_time') scan_time = class_start_at - 5 * 60 * 1000;
    else if (status === 'late') scan_time = class_start_at + 5 * 60 * 1000;
    else if (status === 'absent') scan_time = late_cutoff_at;
    else scan_time = class_start_at; // leave

    sql(`INSERT INTO attendance (session_id, course_id, user_email, user_name, scan_time, login_time, status, is_manual, manual_reason, manual_by, created_at) VALUES ('${sessionId}', '${COURSE_ID}', '${s.email}', '${s.name}', ${scan_time}, ${scan_time}, '${status}', 1, 'Excel匯入', '${CREATED_BY}', ${now})`);
    count++;
  }
  totalAttendance += count;
  console.log(`  ${date}: ${count} records`);
}

console.log(`\n✅ Done! ${Object.keys(colMap).length} sessions, ${totalAttendance} attendance records`);
