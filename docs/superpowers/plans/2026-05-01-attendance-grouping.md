# Attendance Grouping & Official Leave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the session attendance view around "needs attention" groups (late / leave / manual / absent), collapse on-time by default, and add a public-leave (公假) flag that's visible at-a-glance without polluting the status enum or CSV export.

**Architecture:** Add `is_official_leave` INTEGER column to `attendance` (D1/SQLite). Backend routes pass the flag through (manual create) or auto-clear on status transitions (edit). Frontend splits the existing 653-line page into two reusable group components (`AttendanceGroup`, `AbsentGroup`), then assembles them in a focus-flipped layout. The leave checkbox appears in the existing manual modal only when registering a leave.

**Tech Stack:** Next.js 16 App Router (`'use client'` page), Cloudflare D1 via wrangler migrations, React 19, Tailwind 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-01-attendance-grouping-design.md`

**Branch:** `feat/attendance-grouping` (already created and contains the spec commit).

**Note on TDD:** The lib has vitest unit tests for pure functions (`status.ts`, `nonce.ts`, etc.) and one heavy integration test with hand-rolled DB/KV mocks. There is **no component test framework** and the route changes here are passthrough field plumbing (no new pure logic). Per spec §5 we are not introducing component tests for this PR. Each task that touches a route includes a concrete manual verification step (curl against `npm run dev`) instead of an automated test step. This is a deliberate scope decision — do not "fix" it by inventing test scaffolding.

---

## File Map

**Migrations:**
- Create: `migrations/0004_official_leave.sql`

**Backend (modify):**
- `src/app/api/courses/[courseId]/manual/route.ts` — accept `is_official_leave` from body
- `src/app/api/courses/[courseId]/attendance/[attendanceId]/edit/route.ts` — clear flag on non-leave status transition
- `src/app/api/courses/[courseId]/sessions/[id]/list/route.ts` — expose `is_official_leave` in SELECT

**Frontend (new):**
- `src/app/(admin)/courses/[courseId]/sessions/[id]/_components/AttendanceGroup.tsx` — generic grouped table for late / leave / manual / on_time
- `src/app/(admin)/courses/[courseId]/sessions/[id]/_components/AbsentGroup.tsx` — combined absent + not-signed table with quick actions

**Frontend (modify):**
- `src/app/(admin)/courses/[courseId]/sessions/[id]/page.tsx` — slim down, render new layout, add 公假 checkbox + tag

---

### Task 1: Add `is_official_leave` column

**Files:**
- Create: `migrations/0004_official_leave.sql`

- [ ] **Step 1: Write the migration**

Create `migrations/0004_official_leave.sql`:

```sql
-- 0004_official_leave.sql
ALTER TABLE attendance ADD COLUMN is_official_leave INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Apply to local D1**

Run from project root:

```bash
npx wrangler d1 migrations apply ntut-checkin-db --local
```

Expected output: includes `🚣 Executed 1 command in ...ms` for `0004_official_leave.sql`.

- [ ] **Step 3: Verify column exists locally**

```bash
npx wrangler d1 execute ntut-checkin-db --local --command "PRAGMA table_info(attendance);"
```

Expected: the result table includes a row with `name = is_official_leave`, `type = INTEGER`, `notnull = 1`, `dflt_value = 0`.

- [ ] **Step 4: Commit**

```bash
git add migrations/0004_official_leave.sql
git commit -m "feat: add is_official_leave column to attendance"
```

---

### Task 2: Manual route — accept `is_official_leave`

**Files:**
- Modify: `src/app/api/courses/[courseId]/manual/route.ts`

- [ ] **Step 1: Update the route handler**

Replace the body-destructuring and INSERT in `src/app/api/courses/[courseId]/manual/route.ts` so the route accepts and persists the flag. The full updated file:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const admin = await requireCourseAdmin(courseId);
  const {
    session_id, user_email, user_name, reason, status: reqStatus,
    is_official_leave,
  } = await req.json() as {
    session_id?: string; user_email?: string; user_name?: string; reason?: string;
    status?: string; is_official_leave?: boolean;
  };
  const allowedStatuses = ['on_time', 'late', 'leave', 'manual'] as const;
  const manualStatus = (allowedStatuses as readonly string[]).includes(reqStatus ?? '')
    ? (reqStatus as typeof allowedStatuses[number])
    : 'manual';

  // Only honor is_official_leave when status is 'leave'; force 0 otherwise.
  const officialLeaveFlag = manualStatus === 'leave' && is_official_leave === true ? 1 : 0;

  if (!session_id || !user_email) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? 'ntut.org.tw';
  if (!user_email.trim().toLowerCase().endsWith(`@${domain}`)) {
    return NextResponse.json({ error: 'invalid_email_domain' }, { status: 400 });
  }

  const db = getDB();

  const session = await db
    .prepare('SELECT id, status FROM sessions WHERE id = ? AND course_id = ?')
    .bind(session_id, courseId)
    .first<{ id: string; status: string }>();
  if (!session) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 400 });
  }

  const now = Date.now();

  try {
    await db.prepare(`
      INSERT INTO attendance
        (session_id, course_id, user_email, user_name,
         scan_time, login_time, status,
         is_manual, manual_reason, manual_by, is_official_leave, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).bind(
      session_id, courseId, user_email, user_name ?? null,
      now, now, manualStatus, reason ?? null, admin.email, officialLeaveFlag, now,
    ).run();
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'already_signed' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 3: Manual verify (deferred to Task 10)**

This route is exercised end-to-end via the UI in Task 10. We skip a curl verification here because the route requires admin auth (next-auth session cookie), which is awkward to script.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/courses/[courseId]/manual/route.ts
git commit -m "feat: accept is_official_leave in manual check-in route"
```

---

### Task 3: Edit route — clear flag when leaving 'leave' status

**Files:**
- Modify: `src/app/api/courses/[courseId]/attendance/[attendanceId]/edit/route.ts`

- [ ] **Step 1: Update the route handler**

Replace `src/app/api/courses/[courseId]/attendance/[attendanceId]/edit/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCourseAdmin } from '@/lib/permissions';
import { getDB } from '@/lib/cloudflare';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; attendanceId: string }> },
) {
  const { courseId, attendanceId } = await params;
  const admin = await requireCourseAdmin(courseId);
  const { status } = await req.json() as { status: string };

  const validStatuses = ['on_time', 'late', 'absent', 'leave', 'manual'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const db = getDB();
  // When transitioning away from 'leave', the official-leave flag is no longer
  // meaningful — clear it to 0. When staying on or transitioning to 'leave',
  // preserve whatever value is already there (UI doesn't expose toggling here in v1).
  if (status === 'leave') {
    await db.prepare(
      'UPDATE attendance SET status = ?, manual_by = ?, manual_reason = ? WHERE id = ? AND course_id = ?'
    ).bind(status, admin.email, `狀態修改為 ${status}`, attendanceId, courseId).run();
  } else {
    await db.prepare(
      'UPDATE attendance SET status = ?, manual_by = ?, manual_reason = ?, is_official_leave = 0 WHERE id = ? AND course_id = ?'
    ).bind(status, admin.email, `狀態修改為 ${status}`, attendanceId, courseId).run();
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/courses/[courseId]/attendance/[attendanceId]/edit/route.ts
git commit -m "feat: clear is_official_leave when status leaves 'leave'"
```

---

### Task 4: List route — expose `is_official_leave`

**Files:**
- Modify: `src/app/api/courses/[courseId]/sessions/[id]/list/route.ts`

- [ ] **Step 1: Add the column to the SELECT**

Edit `src/app/api/courses/[courseId]/sessions/[id]/list/route.ts`. Change the SELECT clause so the attendance query includes `is_official_leave`:

```ts
  const attendance = await db
    .prepare(`
      SELECT id, user_email, user_name, scan_time, login_time, status,
             fingerprint_hash, fingerprint_raw, ip, user_agent, reaction_ms, is_manual,
             is_official_leave, created_at
      FROM attendance
      WHERE session_id = ? AND course_id = ?
      ORDER BY scan_time ASC
    `)
    .bind(id, courseId)
    .all();
```

(Only the SELECT line changes — the rest of the file stays the same.)

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/courses/[courseId]/sessions/[id]/list/route.ts
git commit -m "feat: expose is_official_leave in session list endpoint"
```

---

### Task 5: Extract `AttendanceGroup` component

**Files:**
- Create: `src/app/(admin)/courses/[courseId]/sessions/[id]/_components/AttendanceGroup.tsx`

This is a generic table-section component used for `late` / `leave` / `manual` / `on_time` groups. Each row supports the device-info expander, status dropdown edit, and delete (same controls as today's "已簽到" table).

- [ ] **Step 1: Create the component file**

Create `src/app/(admin)/courses/[courseId]/sessions/[id]/_components/AttendanceGroup.tsx`:

```tsx
'use client';

import { Fragment } from 'react';

export type AttendanceRecord = {
  id: number;
  user_email: string;
  user_name: string | null;
  scan_time: number;
  status: string;
  is_manual: number;
  is_official_leave: number;
  fingerprint_hash: string | null;
  fingerprint_raw: string | null;
  ip: string | null;
  user_agent: string | null;
  reaction_ms: number | null;
  enrolled: boolean;
};

type Props = {
  rows: AttendanceRecord[];
  hasRoster: boolean;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
  editingStatus: Record<number, boolean>;
  onStatusChange: (recordId: number, newStatus: string) => void;
  onDelete: (recordId: number, email: string) => void;
};

const statusLabel = (s: string) => {
  switch (s) {
    case 'on_time': return '準時';
    case 'late': return '遲到';
    case 'absent': return '缺席';
    case 'leave': return '請假';
    case 'manual': return '補簽';
    default: return s;
  }
};

const statusBadge = (s: string) => {
  switch (s) {
    case 'on_time': return 'badge badge-success';
    case 'late': return 'badge badge-warning';
    case 'absent': return 'badge badge-danger';
    case 'leave': return 'badge badge-info';
    case 'manual': return 'badge badge-info';
    default: return 'badge badge-muted';
  }
};

export default function AttendanceGroup({
  rows, hasRoster, expandedId, setExpandedId,
  editingStatus, onStatusChange, onDelete,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <table className="w-full text-sm">
      <thead className="bg-surface-muted border-b border-border">
        <tr>
          <th className="text-left px-4 py-3 font-medium text-text-secondary">姓名</th>
          <th className="text-left px-4 py-3 font-medium text-text-secondary">Email</th>
          <th className="text-left px-4 py-3 font-medium text-text-secondary">掃碼時間</th>
          <th className="text-left px-4 py-3 font-medium text-text-secondary">狀態</th>
          <th className="text-left px-4 py-3 font-medium text-text-secondary">操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Fragment key={r.id}>
            <tr className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-text-primary">{r.user_name ?? '-'}</td>
              <td className="px-4 py-3 text-text-muted">
                {r.user_email}
                {hasRoster && !r.enrolled && (
                  <span className="ml-1.5 text-[10px] font-medium text-warning-600 bg-warning-50 px-1.5 py-0.5 rounded">非名冊</span>
                )}
              </td>
              <td className="px-4 py-3 text-text-muted">
                {new Date(r.scan_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}
                {r.is_manual ? <span className="ml-1.5 text-[10px] font-medium text-info-500 bg-info-50 px-1.5 py-0.5 rounded">手動</span> : null}
              </td>
              <td className="px-4 py-3">
                <span className={statusBadge(r.status)}>{statusLabel(r.status)}</span>
                {r.status === 'leave' && r.is_official_leave === 1 && (
                  <span className="ml-1.5 text-[10px] font-medium text-success-600 bg-success-50 px-1.5 py-0.5 rounded">公假</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <select
                    value={r.status}
                    disabled={editingStatus[r.id]}
                    onChange={(e) => onStatusChange(r.id, e.target.value)}
                    className="border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                  >
                    <option value="on_time">準時</option>
                    <option value="late">遲到</option>
                    <option value="absent">缺席</option>
                    <option value="leave">請假</option>
                    <option value="manual">補簽</option>
                  </select>
                  <button
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="btn btn-ghost btn-sm !min-h-0 !p-1"
                    title="查看裝置資訊"
                  >
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(r.id, r.user_email)}
                    className="btn btn-ghost btn-sm !min-h-0 !p-1 text-danger-500 hover:bg-danger-50"
                    title="刪除此紀錄"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            {expandedId === r.id && (
              <tr className="bg-surface-muted">
                <td colSpan={5} className="px-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium text-text-secondary">Fingerprint Hash:</span>{' '}
                      <span className="text-text-muted font-mono">{r.fingerprint_hash ?? '-'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-text-secondary">IP:</span>{' '}
                      <span className="text-text-muted font-mono">{r.ip ?? '-'}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium text-text-secondary">User Agent:</span>{' '}
                      <span className="text-text-muted break-all">{r.user_agent ?? '-'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-text-secondary">Reaction Time:</span>{' '}
                      <span className="text-text-muted">{r.reaction_ms != null ? `${r.reaction_ms} ms` : '-'}</span>
                    </div>
                    {r.fingerprint_raw && (
                      <div className="md:col-span-2">
                        <details>
                          <summary className="font-medium text-text-secondary cursor-pointer hover:text-text-primary">
                            Raw Fingerprint Components (JSON)
                          </summary>
                          <pre className="mt-2 p-3 bg-surface-dim rounded text-xs overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
                            {(() => {
                              try { return JSON.stringify(JSON.parse(r.fingerprint_raw as string), null, 2); }
                              catch { return r.fingerprint_raw; }
                            })()}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(admin)/courses/[courseId]/sessions/[id]/_components/AttendanceGroup.tsx'
git commit -m "feat: add AttendanceGroup component"
```

---

### Task 6: Extract `AbsentGroup` component

**Files:**
- Create: `src/app/(admin)/courses/[courseId]/sessions/[id]/_components/AbsentGroup.tsx`

Renders the combined table of (a) `attendance` rows whose status is `absent` and (b) roster entries who never scanned. Both have different action buttons.

- [ ] **Step 1: Create the component file**

Create `src/app/(admin)/courses/[courseId]/sessions/[id]/_components/AbsentGroup.tsx`:

```tsx
'use client';

import type { AttendanceRecord } from './AttendanceGroup';

export type NotSigned = { email: string; student_id: string | null; name: string | null };

type Props = {
  absent: AttendanceRecord[];
  notSigned: NotSigned[];
  editingStatus: Record<number, boolean>;
  quickActionLoading: Record<string, boolean>;
  onStatusChange: (recordId: number, newStatus: string) => void;
  onManualCheckIn: (s: NotSigned) => void;
  onOpenLeaveModal: (s: NotSigned) => void;
};

export default function AbsentGroup({
  absent, notSigned, editingStatus, quickActionLoading,
  onStatusChange, onManualCheckIn, onOpenLeaveModal,
}: Props) {
  if (absent.length + notSigned.length === 0) return null;

  return (
    <table className="w-full text-sm">
      <thead className="bg-danger-50 border-b border-danger-100">
        <tr>
          <th className="text-left px-4 py-3 font-medium text-text-secondary">姓名</th>
          <th className="text-left px-4 py-3 font-medium text-text-secondary">Email</th>
          <th className="text-left px-4 py-3 font-medium text-text-secondary">狀態</th>
          <th className="text-left px-4 py-3 font-medium text-text-secondary">操作</th>
        </tr>
      </thead>
      <tbody>
        {absent.map((r) => (
          <tr key={r.user_email} className="border-b border-border last:border-0">
            <td className="px-4 py-3 text-text-primary">{r.user_name ?? '-'}</td>
            <td className="px-4 py-3 text-text-muted">{r.user_email}</td>
            <td className="px-4 py-3">
              <span className="badge badge-danger">缺席</span>
              <span className="ml-1.5 text-xs text-text-muted">
                掃碼 {new Date(r.scan_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}
              </span>
            </td>
            <td className="px-4 py-3">
              <select
                value={r.status}
                disabled={editingStatus[r.id]}
                onChange={(e) => onStatusChange(r.id, e.target.value)}
                className="border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="on_time">準時</option>
                <option value="late">遲到</option>
                <option value="absent">缺席</option>
                <option value="leave">請假</option>
                <option value="manual">補簽</option>
              </select>
            </td>
          </tr>
        ))}
        {notSigned.map((s) => {
          const loading = !!quickActionLoading[s.email];
          return (
            <tr key={s.email} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-text-primary">{s.name ?? s.student_id ?? '-'}</td>
              <td className="px-4 py-3 text-text-muted">{s.email}</td>
              <td className="px-4 py-3"><span className="badge badge-muted">未簽到</span></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onManualCheckIn(s)}
                    disabled={loading}
                    className="btn btn-primary btn-sm disabled:opacity-50"
                  >
                    手動打卡
                  </button>
                  <button
                    onClick={() => onOpenLeaveModal(s)}
                    disabled={loading}
                    className="btn btn-secondary btn-sm disabled:opacity-50"
                  >
                    請假
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(admin)/courses/[courseId]/sessions/[id]/_components/AbsentGroup.tsx'
git commit -m "feat: add AbsentGroup component"
```

---

### Task 7: Reorganize page layout (focus-flipped)

**Files:**
- Modify: `src/app/(admin)/courses/[courseId]/sessions/[id]/page.tsx`

This task replaces the body of `page.tsx` with the new layout, importing the components from Tasks 5–6. Existing handlers (status change, delete, manual modal, etc.) stay; we only restructure the JSX and add the `is_official_leave` field to the local `AttendanceRecord` type plus state for the new modal checkbox.

- [ ] **Step 1: Replace the file**

Overwrite `src/app/(admin)/courses/[courseId]/sessions/[id]/page.tsx` with:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/confirm-dialog';
import AttendanceGroup, { type AttendanceRecord } from './_components/AttendanceGroup';
import AbsentGroup, { type NotSigned } from './_components/AbsentGroup';

type SessionInfo = { status: string; qr_mode: string } | null;

export default function SessionViewPage() {
  const { courseId, id } = useParams<{ courseId: string; id: string }>();
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notSigned, setNotSigned] = useState<NotSigned[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  const [qrMode, setQrMode] = useState<'dynamic' | 'static'>('dynamic');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualType, setManualType] = useState<'manual' | 'leave'>('manual');
  const [manualOfficial, setManualOfficial] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<Record<number, boolean>>({});
  const [quickActionLoading, setQuickActionLoading] = useState<Record<string, boolean>>({});
  const [hasRoster, setHasRoster] = useState(false);
  const [courseName, setCourseName] = useState<string>('');
  const [classDate, setClassDate] = useState<string>('');
  const [dialog, setDialog] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null);

  const fetchList = useCallback(async () => {
    const res = await fetch(`/api/courses/${courseId}/sessions/${id}/list`);
    if (res.ok) {
      const data = await res.json() as {
        attendance: AttendanceRecord[];
        not_signed: NotSigned[];
        has_roster: boolean;
        session: SessionInfo;
      };
      setAttendance(data.attendance);
      setNotSigned(data.not_signed);
      setHasRoster(data.has_roster);
      if (data.session) {
        setSessionStatus(data.session.status ?? 'active');
        setQrMode((data.session.qr_mode as 'dynamic' | 'static') ?? 'dynamic');
      }
    }
  }, [courseId, id]);

  useEffect(() => {
    fetchList();
    const timer = setInterval(fetchList, 10000);

    fetch('/api/courses')
      .then((r) => r.json() as Promise<{ courses?: { id: string; name: string }[] }>)
      .then((data) => {
        const c = data.courses?.find((c) => c.id === courseId);
        if (c) setCourseName(c.name);
      });

    fetch(`/api/courses/${courseId}/sessions/create`)
      .then((r) => r.json() as Promise<{ sessions?: { id: string; class_date: string }[] }>)
      .then((data) => {
        const s = data.sessions?.find((s) => s.id === id);
        if (s) setClassDate(s.class_date);
      });

    return () => clearInterval(timer);
  }, [fetchList, courseId, id]);

  const handleCloseSession = () => {
    setDialog({
      title: '結束簽到',
      message: '確定要結束此簽到？結束後學生將無法再掃碼簽到。',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/courses/${courseId}/sessions/${id}/close`, { method: 'POST' });
        if (res.ok) setSessionStatus('closed');
      },
    });
  };

  const handleReopenSession = () => {
    setDialog({
      title: '重新開啟簽到',
      message: '確定要重新開啟此簽到？開啟後學生將可以再次掃碼簽到。',
      onConfirm: async () => {
        const res = await fetch(`/api/courses/${courseId}/sessions/${id}/reopen`, { method: 'POST' });
        if (res.ok) setSessionStatus('open');
      },
    });
  };

  const handleDeleteSession = () => {
    setDialog({
      title: '刪除整個點名紀錄',
      message: `確定要刪除 ${classDate || id} 的點名紀錄？所有簽到資料將被永久刪除，此操作無法復原。`,
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/courses/${courseId}/sessions/${id}`, { method: 'DELETE' });
        if (res.ok) {
          router.push(`/courses/${courseId}`);
        } else {
          alert('刪除失敗');
        }
      },
    });
  };

  const handleToggleQrMode = async () => {
    const newMode = qrMode === 'dynamic' ? 'static' : 'dynamic';
    const res = await fetch(`/api/courses/${courseId}/sessions/${id}/qr-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode }),
    });
    if (res.ok) setQrMode(newMode);
  };

  const handleManualSubmit = async () => {
    if (!manualEmail.trim()) return;
    setManualLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: id,
          user_email: manualEmail.trim(),
          user_name: manualName.trim() || undefined,
          reason: manualReason.trim() || undefined,
          status: manualType,
          is_official_leave: manualType === 'leave' ? manualOfficial : undefined,
        }),
      });
      if (res.ok) {
        setShowManualModal(false);
        setManualEmail('');
        setManualName('');
        setManualReason('');
        setManualType('manual');
        setManualOfficial(false);
        fetchList();
      } else {
        const data = await res.json() as { error?: string };
        if (data.error === 'already_signed') {
          alert('該學生已經簽到過了');
        } else {
          alert('補簽失敗：' + (data.error ?? '未知錯誤'));
        }
      }
    } finally {
      setManualLoading(false);
    }
  };

  const handleStatusChange = (recordId: number, newStatus: string) => {
    const labels: Record<string, string> = { on_time: '準時', late: '遲到', absent: '缺席', leave: '請假', manual: '補簽' };
    setDialog({
      title: '修改簽到狀態',
      message: `確定要將此紀錄改為「${labels[newStatus] ?? newStatus}」？`,
      onConfirm: async () => {
        setEditingStatus((prev) => ({ ...prev, [recordId]: true }));
        try {
          const res = await fetch(`/api/courses/${courseId}/attendance/${recordId}/edit`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          });
          if (res.ok) {
            await fetchList();
          } else {
            const data = await res.json() as { error?: string };
            alert('修改失敗：' + (data.error ?? '未知錯誤'));
          }
        } finally {
          setEditingStatus((prev) => ({ ...prev, [recordId]: false }));
        }
      },
    });
  };

  const handleDeleteRecord = (recordId: number, email: string) => {
    setDialog({
      title: '刪除簽到紀錄',
      message: `確定要刪除 ${email} 的簽到紀錄？此操作無法復原。`,
      danger: true,
      onConfirm: async () => {
        await fetch(`/api/courses/${courseId}/attendance/${recordId}`, { method: 'DELETE' });
        await fetchList();
      },
    });
  };

  const handleManualCheckIn = (s: NotSigned) => {
    const displayName = s.name ?? s.student_id ?? s.email;
    setDialog({
      title: '手動打卡確認',
      message: `確定要將 ${displayName} 標記為「準時」？`,
      onConfirm: async () => {
        setQuickActionLoading((prev) => ({ ...prev, [s.email]: true }));
        try {
          const res = await fetch(`/api/courses/${courseId}/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: id,
              user_email: s.email,
              user_name: s.name ?? undefined,
              status: 'on_time',
            }),
          });
          if (res.ok) {
            await fetchList();
          } else {
            const data = await res.json() as { error?: string };
            alert('手動打卡失敗：' + (data.error ?? '未知錯誤'));
          }
        } finally {
          setQuickActionLoading((prev) => ({ ...prev, [s.email]: false }));
        }
      },
    });
  };

  const handleOpenLeaveModal = (s: NotSigned) => {
    setManualEmail(s.email);
    setManualName(s.name ?? '');
    setManualReason('');
    setManualType('leave');
    setManualOfficial(false);
    setShowManualModal(true);
  };

  const isClosed = sessionStatus === 'closed';

  // Group rows by status
  const lateRows = attendance.filter((r) => r.status === 'late');
  const leaveRows = attendance.filter((r) => r.status === 'leave');
  const manualRows = attendance.filter((r) => r.status === 'manual');
  const absentRows = attendance.filter((r) => r.status === 'absent');
  const onTimeRows = attendance.filter((r) => r.status === 'on_time');
  const attentionTotal =
    lateRows.length + leaveRows.length + manualRows.length
    + absentRows.length + notSigned.length;

  // Stats
  const onTimeCount = onTimeRows.length;
  const lateCount = lateRows.length;
  const manualCount = manualRows.length;
  const leaveCount = leaveRows.length;
  const absentOrNotSigned = absentRows.length + notSigned.length;
  const total = attendance.length + notSigned.length;

  const groupProps = {
    hasRoster,
    expandedId,
    setExpandedId,
    editingStatus,
    onStatusChange: handleStatusChange,
    onDelete: handleDeleteRecord,
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-text-muted mb-4">
        <a href="/dashboard" className="hover:text-brand-500">我的課程</a>
        <span className="mx-2">/</span>
        <a href={`/courses/${courseId}`} className="hover:text-brand-500">{courseName || courseId}</a>
        <span className="mx-2">/</span>
        <span className="text-text-primary">{classDate || id}</span>
      </nav>

      {/* Expired session warning */}
      {classDate && !isClosed && classDate < new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) && (
        <div className="bg-warning-50 border border-warning-300 rounded-lg px-4 py-3 mb-4 text-sm text-warning-700">
          此場次已過上課日期（{classDate}），學生掃碼將無法簽到。建議關閉此場次。
        </div>
      )}

      {/* Stats summary bar */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-text-primary">即時簽到名單</h1>
          <div className="flex items-center gap-2">
            {isClosed && <span className="badge badge-danger">已結束</span>}
            {!isClosed && qrMode === 'static' && <span className="badge badge-info">靜態 QR</span>}
            {!isClosed && qrMode === 'dynamic' && <span className="badge badge-success">動態 QR</span>}
          </div>
        </div>

        <div className={`grid grid-cols-3 ${hasRoster ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} gap-3 text-center`}>
          {hasRoster && (
            <div className="bg-surface-muted rounded-lg px-3 py-2">
              <p className="text-2xl font-bold text-text-primary">{total}</p>
              <p className="text-xs text-text-muted">總人數</p>
            </div>
          )}
          <div className="bg-success-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-success-500">{onTimeCount}</p>
            <p className="text-xs text-text-muted">準時</p>
          </div>
          <div className="bg-warning-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-warning-500">{lateCount}</p>
            <p className="text-xs text-text-muted">遲到</p>
          </div>
          <div className="bg-info-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-info-500">{leaveCount}</p>
            <p className="text-xs text-text-muted">請假</p>
          </div>
          <div className="bg-info-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-info-500">{manualCount}</p>
            <p className="text-xs text-text-muted">補簽</p>
          </div>
          <div className="bg-danger-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-danger-500">{absentOrNotSigned}</p>
            <p className="text-xs text-text-muted">缺席</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {isClosed ? (
          <span className="btn btn-primary btn-sm opacity-50 pointer-events-none">投影頁</span>
        ) : (
          <a href={`/courses/${courseId}/sessions/${id}/projector`} target="_blank" className="btn btn-primary btn-sm">
            投影頁
          </a>
        )}
        <button onClick={() => { setManualType('manual'); setManualOfficial(false); setShowManualModal(true); }} className="btn btn-primary btn-sm">
          手動補簽
        </button>

        <a href={`/api/courses/${courseId}/sessions/${id}/export`} className="btn btn-secondary btn-sm">
          匯出 CSV
        </a>
        <button onClick={handleToggleQrMode} disabled={isClosed} className="btn btn-secondary btn-sm">
          {qrMode === 'dynamic' ? '切換靜態 QR' : '切換動態 QR'}
        </button>
        {!isClosed && qrMode === 'static' && (
          <a href={`/courses/${courseId}/sessions/${id}/projector`} target="_blank" className="btn btn-secondary btn-sm">
            列印 QR Code
          </a>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isClosed ? (
            <button onClick={handleReopenSession} className="btn btn-primary btn-sm">重新開啟</button>
          ) : (
            <button onClick={handleCloseSession} className="btn btn-danger btn-sm">結束簽到</button>
          )}
          <button onClick={handleDeleteSession} className="btn btn-ghost btn-sm text-danger-500 hover:bg-danger-50">
            刪除
          </button>
        </div>
      </div>

      {/* Needs attention */}
      {attentionTotal > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-danger-500">需要關注</h2>
            <span className="badge badge-danger">{attentionTotal}</span>
          </div>

          {lateRows.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-warning-600">遲到</h3>
                <span className="badge badge-warning">{lateRows.length}</span>
              </div>
              <div className="card">
                <AttendanceGroup rows={lateRows} {...groupProps} />
              </div>
            </div>
          )}

          {leaveRows.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-info-600">請假</h3>
                <span className="badge badge-info">{leaveRows.length}</span>
              </div>
              <div className="card">
                <AttendanceGroup rows={leaveRows} {...groupProps} />
              </div>
            </div>
          )}

          {manualRows.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-info-600">補簽</h3>
                <span className="badge badge-info">{manualRows.length}</span>
              </div>
              <div className="card">
                <AttendanceGroup rows={manualRows} {...groupProps} />
              </div>
            </div>
          )}

          {(absentRows.length + notSigned.length) > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-danger-600">缺席 / 未簽到</h3>
                <span className="badge badge-danger">{absentRows.length + notSigned.length}</span>
              </div>
              <div className="card border-danger-100">
                <AbsentGroup
                  absent={absentRows}
                  notSigned={notSigned}
                  editingStatus={editingStatus}
                  quickActionLoading={quickActionLoading}
                  onStatusChange={handleStatusChange}
                  onManualCheckIn={handleManualCheckIn}
                  onOpenLeaveModal={handleOpenLeaveModal}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* On-time (collapsed by default; auto-open when there's nothing in attention) */}
      <details open={attentionTotal === 0} className="card mb-6">
        <summary className="cursor-pointer px-4 py-3 font-semibold text-success-600 hover:bg-surface-muted">
          準時 ({onTimeRows.length})
        </summary>
        {onTimeRows.length > 0 ? (
          <AttendanceGroup rows={onTimeRows} {...groupProps} />
        ) : (
          <div className="px-4 py-6 text-center text-text-muted text-sm">尚無準時簽到紀錄</div>
        )}
      </details>

      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        danger={dialog?.danger}
        onConfirm={() => { dialog?.onConfirm(); setDialog(null); }}
        onCancel={() => setDialog(null)}
      />

      {/* Manual Check-in Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card p-6 w-full max-w-md mx-4 shadow-lg">
            <h2 className="text-lg font-bold text-text-primary mb-4">
              {manualType === 'leave' ? '登記請假' : '手動補簽'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">類型</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setManualType('manual'); setManualOfficial(false); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${manualType === 'manual' ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-text-secondary border-border hover:bg-surface-dim'}`}
                  >
                    補簽
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualType('leave')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${manualType === 'leave' ? 'bg-info-500 text-white border-info-500' : 'bg-white text-text-secondary border-border hover:bg-surface-dim'}`}
                  >
                    請假
                  </button>
                </div>
              </div>
              {manualType === 'leave' && (
                <div>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={manualOfficial}
                      onChange={(e) => setManualOfficial(e.target.checked)}
                    />
                    公假（不影響出席率）
                  </label>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Email <span className="text-danger-500">*</span>
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="student@ntut.edu.tw"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">姓名</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="選填"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {manualType === 'leave' ? '請假事由' : '補簽原因'}
                </label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="選填"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowManualModal(false)} className="btn btn-ghost btn-sm">
                取消
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={manualLoading || !manualEmail.trim()}
                className="btn btn-primary btn-sm"
              >
                {manualLoading ? '送出中...' : manualType === 'leave' ? '確認請假' : '確認補簽'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: exit 0 (warnings OK, errors not OK).

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(admin)/courses/[courseId]/sessions/[id]/page.tsx'
git commit -m "feat: focus-flipped session view with grouped attention list"
```

---

### Task 8: Manual verification on local dev server

**Files:** none modified

This is the substitute for automated tests for the route + UI changes (see plan-level note about TDD scope).

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open http://localhost:9202 and log in as a course admin.

- [ ] **Step 2: Navigate to a session with mixed states**

Pick a course/session that has at least one student in each of: on_time, late, leave, absent, plus a roster entry that hasn't signed.

If you don't have such data, create it:
- Have a student scan now (on_time)
- Manually edit one record to "late"
- Manually register a "leave" for one student (don't tick 公假)
- Manually register a "leave" with 公假 ticked
- Manually edit one record to "absent"
- Leave one roster student unscanned

- [ ] **Step 3: Run the verification checklist from spec §Testing**

For each item, mark pass/fail and re-record any unexpected behavior:

1. [ ] All groups render correctly with mixed data
2. [ ] When attendance is all-on-time, "需要關注" block doesn't render and "準時" auto-expands
3. [ ] Empty session: "需要關注" only shows 未簽到, "準時 (0)" is collapsed
4. [ ] Editing a record from late/leave/absent → on_time moves it into the 準時 group within ~10s (or after manual refetch)
5. [ ] Registering a leave with 公假 ticked: row in 請假 group shows both "請假" badge and green "公假" tag
6. [ ] Editing a 公假 row to non-leave status (e.g., manual): after refetch, switching it back to leave shows no 公假 tag (flag was cleared on transition)
7. [ ] CSV download (`匯出 CSV` button) — open the CSV and confirm column headers and content match before-and-after (no new column, no format change)
8. [ ] Open a course without an enrolled roster (`hasRoster=false`) — 缺席 / 未簽到 group is absent, other groups still work

- [ ] **Step 4: If any check fails, fix the underlying code**

If a check fails, identify which task's output is wrong and amend it. Re-run the relevant `npx tsc --noEmit` / `npm run lint` and commit a fix with an explanatory message (do not amend earlier commits — append a `fix:` commit).

- [ ] **Step 5: Push branch**

```bash
git push -u origin feat/attendance-grouping
```

- [ ] **Step 6: Open PR**

```bash
gh pr create --title "feat: attendance grouping + official-leave flag" --body "$(cat <<'EOF'
## Summary
- Reorganizes session view around "needs attention" groups (late / leave / manual / absent + not-signed) with on-time collapsed by default
- Adds `is_official_leave` flag on `attendance` so 公假 is visible in the row without polluting the status enum
- CSV export untouched (per spec)

## Test plan
- [ ] Mixed-state session renders all groups correctly
- [ ] All-on-time session: "需要關注" hidden, "準時" auto-expanded
- [ ] Empty session: "需要關注" shows 未簽到 only
- [ ] Status edit moves row between groups after refetch
- [ ] 公假 ticked → row shows "請假 + 公假" double tag
- [ ] Editing a 公假 row to non-leave clears the flag (verified by toggling back to leave)
- [ ] CSV format unchanged
- [ ] No-roster course: 缺席/未簽到 group hidden, rest works

Spec: `docs/superpowers/specs/2026-05-01-attendance-grouping-design.md`
EOF
)"
```

- [ ] **Step 7: Wait for preview deploy**

Cloudflare Workers preview URL appears in the PR checks (per existing CI from commit #3). Re-run the same checklist on the preview URL to confirm it works in the deployed environment.

- [ ] **Step 8: Hand off to user for review and merge**

Stop here. Do not merge. The user reviews and merges manually.
