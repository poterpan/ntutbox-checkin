# Demo Test Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/demo` page where students practice the full check-in flow (privacy consent → Google OAuth → result), writing records to a `demo_attendance` table, with an admin page to view who tested.

**Architecture:** New `demo_attendance` table via migration. Student-facing `/demo` page reuses scan page patterns (in-app browser detection, privacy consent, OAuth) but replaces nonce/QR scanning with a direct "start" button. Dedicated `/demo/result` page with custom messaging. Server-side `/api/demo/checkin` GET endpoint (OAuth callback target) writes to demo table. `/api/demo/qr` generates a downloadable QR PNG. Admin `/demo/records` page lists test participants.

**Tech Stack:** Next.js App Router, D1 (SQLite via Cloudflare), NextAuth (Google OAuth), `qrcode` npm package (already installed), Tailwind CSS v4.

**Domain:** `checkin.ntutbox.com` (from `NEXTAUTH_URL` env var)

---

### Task 1: Database Migration

**Files:**
- Create: `migrations/0003_demo_attendance.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 0003_demo_attendance.sql
CREATE TABLE demo_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL UNIQUE,
  user_name TEXT,
  checkin_time INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 2: Apply migration locally**

Run: `npx wrangler d1 execute ntut-checkin --local --file=migrations/0003_demo_attendance.sql`
Expected: table created successfully

- [ ] **Step 3: Commit**

```bash
git add migrations/0003_demo_attendance.sql
git commit -m "feat: add demo_attendance table migration"
```

---

### Task 2: Demo Check-in API Endpoint

**Files:**
- Create: `src/app/api/demo/checkin/route.ts`

This endpoint is the OAuth callback target. After Google login, the browser redirects here. It validates the user, upserts into `demo_attendance`, and redirects to `/demo/result`.

- [ ] **Step 1: Create the API route**

```typescript
// src/app/api/demo/checkin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/cloudflare';

export async function GET(req: NextRequest) {
  const session = await auth();
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? 'ntut.org.tw';

  if (!session?.user?.email?.endsWith(`@${domain}`)) {
    return NextResponse.redirect(new URL('/error?code=invalid_domain', req.url));
  }

  const db = getDB();
  const now = Date.now();

  // Upsert: update checkin_time on repeat visits
  await db.prepare(`
    INSERT INTO demo_attendance (user_email, user_name, checkin_time, ip, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      user_name = excluded.user_name,
      checkin_time = excluded.checkin_time,
      ip = excluded.ip,
      user_agent = excluded.user_agent
  `).bind(
    session.user.email,
    session.user.name ?? null,
    now,
    req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null,
    req.headers.get('user-agent') ?? null,
    now,
  ).run();

  return NextResponse.redirect(new URL(`/demo/result?t=${now}`, req.url));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/demo/checkin/route.ts
git commit -m "feat: add demo check-in API endpoint"
```

---

### Task 3: Demo QR Code API

**Files:**
- Create: `src/app/api/demo/qr/route.ts`

Returns a PNG image of a QR code pointing to `/demo`. Uses the `qrcode` package already in dependencies. The domain comes from `NEXTAUTH_URL` env var.

- [ ] **Step 1: Create the QR API route**

```typescript
// src/app/api/demo/qr/route.ts
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const demoUrl = `${baseUrl}/demo`;

  const buffer = await QRCode.toBuffer(demoUrl, {
    width: 600,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline; filename="demo-qrcode.png"',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/demo/qr/route.ts
git commit -m "feat: add demo QR code PNG endpoint"
```

---

### Task 4: Demo Records API (Admin)

**Files:**
- Create: `src/app/api/demo/records/route.ts`

Returns all demo_attendance rows for the admin records page. Requires authentication (any logged-in admin).

- [ ] **Step 1: Create the records API route**

```typescript
// src/app/api/demo/records/route.ts
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
  const { results } = await db.prepare(
    'SELECT id, user_email, user_name, checkin_time, created_at FROM demo_attendance ORDER BY checkin_time DESC'
  ).all<{ id: number; user_email: string; user_name: string | null; checkin_time: number; created_at: number }>();

  return NextResponse.json({ records: results ?? [] });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/demo/records/route.ts
git commit -m "feat: add demo records API for admin"
```

---

### Task 5: Demo Student Page (`/demo`)

**Files:**
- Create: `src/app/(student)/demo/page.tsx`

This page reuses the scan page patterns: in-app browser detection → privacy consent → OAuth redirect. The key difference: no nonce/QR scanning step. Instead, after privacy consent, a "開始測試簽到" button triggers OAuth → `/api/demo/checkin`.

- [ ] **Step 1: Create the demo page**

```tsx
// src/app/(student)/demo/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { detectInAppBrowser, type InAppBrowserType } from '@/lib/in-app-browser';

type DemoState = 'in_app_browser' | 'privacy' | 'ready' | 'redirecting';

export default function DemoPage() {
  const { status: authStatus } = useSession();
  const [state, setState] = useState<DemoState>('privacy');
  const [inAppType, setInAppType] = useState<InAppBrowserType>(null);
  const [copied, setCopied] = useState(false);
  const redirectedRef = useRef(false);

  // In-app browser detection (same logic as scan page)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent;
    const type = detectInAppBrowser(ua);

    if (type === 'line') {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('openExternalBrowser')) {
        url.searchParams.set('openExternalBrowser', '1');
        window.location.replace(url.toString());
        return;
      }
      setInAppType('line');
      setState('in_app_browser');
      return;
    }

    if (type === 'ig' || type === 'fb' || type === 'messenger') {
      setInAppType(type);
      setState('in_app_browser');
      return;
    }

    // Regular browser: honor privacy_accepted shortcut
    if (localStorage.getItem('privacy_accepted') === '1') {
      setState('ready');
    }
  }, []);

  const acceptPrivacy = () => {
    localStorage.setItem('privacy_accepted', '1');
    setState('ready');
  };

  const handleStart = () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    setState('redirecting');

    const checkinUrl = '/api/demo/checkin';

    if (authStatus === 'authenticated') {
      window.location.href = checkinUrl;
    } else {
      signIn('google', { callbackUrl: checkinUrl }, { prompt: 'select_account' });
    }
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch { /* fall through */ }
    setCopied(false);
  };

  // In-app browser guide (same as scan page)
  if (state === 'in_app_browser') {
    const label =
      inAppType === 'line' ? 'LINE' :
      inAppType === 'ig' ? 'Instagram' :
      inAppType === 'fb' ? 'Facebook' :
      inAppType === 'messenger' ? 'Messenger' : '內建瀏覽器';
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
        <div className="card p-6 max-w-sm w-full">
          <h2 className="text-lg font-bold mb-2">請在外部瀏覽器中開啟</h2>
          <p className="text-text-secondary text-sm mb-4">
            {label} 內建瀏覽器不支援 Google 登入。請點選右上角「⋯」或「更多選項」，選擇「在瀏覽器中開啟」，或複製下方連結貼到 Chrome / Safari 開啟。
          </p>
          <button onClick={handleCopyLink} className="btn btn-primary w-full mb-2">
            {copied ? '已複製' : '複製連結'}
          </button>
          <input
            readOnly
            value={typeof window !== 'undefined' ? window.location.href : ''}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full text-xs font-mono p-2 border border-surface-muted rounded bg-surface-muted text-text-secondary mb-3"
          />
          <p className="text-text-muted text-xs mb-3">若按鈕無效，請長按上方網址選取複製。</p>
          <button
            onClick={() => setState(localStorage.getItem('privacy_accepted') === '1' ? 'ready' : 'privacy')}
            className="btn btn-ghost btn-sm w-full text-text-muted"
          >
            我知道風險，直接在此繼續
          </button>
        </div>
      </div>
    );
  }

  // Privacy screen (same as scan page)
  if (state === 'privacy') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
        <div className="card p-6 max-w-sm w-full">
          <h2 className="text-lg font-bold mb-3">簽到前須知</h2>
          <p className="text-text-secondary text-sm mb-3">本系統將記錄以下資訊用於出席管理：</p>
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-500 flex items-center justify-center text-xs flex-shrink-0">1</span>
              學校 Google 帳號
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-500 flex items-center justify-center text-xs flex-shrink-0">2</span>
              裝置識別碼與 IP
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-500 flex items-center justify-center text-xs flex-shrink-0">3</span>
              簽到時間
            </div>
          </div>
          <p className="text-text-muted text-xs mb-3">僅供課程出席管理，學期結束後可申請刪除。</p>
          <p className="text-danger-600 text-xs font-medium mb-5">請使用學校帳號 @ntut.org.tw 登入</p>
          <button onClick={acceptPrivacy} className="btn btn-primary w-full">
            我了解，繼續
          </button>
        </div>
      </div>
    );
  }

  // Ready / Redirecting screen
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
      <div className="card p-6 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-500 flex items-center justify-center text-2xl mx-auto mb-4">
          {state === 'redirecting' ? (
            <span className="animate-pulse">...</span>
          ) : (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          )}
        </div>
        <h2 className="text-lg font-bold mb-2">測試簽到</h2>
        <p className="text-text-secondary text-sm mb-1">
          這是一個測試頁面，用於練習簽到流程。
        </p>
        <p className="text-text-secondary text-sm mb-5">
          點擊下方按鈕後，請使用學校 Google 帳號登入。
        </p>
        <button
          onClick={handleStart}
          disabled={state === 'redirecting' || authStatus === 'loading'}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {state === 'redirecting' ? '跳轉中...' : '開始測試簽到'}
        </button>
        {authStatus === 'authenticated' && (
          <p className="text-xs text-success-500 mt-3">已偵測到登入狀態，點擊後將直接完成測試</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Test manually in browser**

Open: `http://localhost:9202/demo`
Expected flow:
1. Privacy consent screen appears (or skipped if already accepted)
2. "開始測試簽到" button visible
3. Clicking triggers Google OAuth (or direct redirect if already logged in)
4. After login → redirects to `/api/demo/checkin` → `/demo/result`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(student\)/demo/page.tsx
git commit -m "feat: add demo test check-in student page"
```

---

### Task 6: Demo Result Page (`/demo/result`)

**Files:**
- Create: `src/app/(student)/demo/result/page.tsx`

Custom result page with success messaging. Shows account info, timestamp, and guidance about future real check-ins.

- [ ] **Step 1: Create the demo result page**

```tsx
// src/app/(student)/demo/result/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense } from 'react';

function DemoResultContent() {
  const params = useSearchParams();
  const { data: session } = useSession();

  const timeParam = params.get('t');
  const timeStr = timeParam
    ? new Date(Number(timeParam)).toLocaleTimeString('zh-TW', {
        timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
      <div className="result-card result-card-success mx-auto">
        <div className="w-14 h-14 rounded-full bg-success-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
          ✓
        </div>
        <h1 className="text-xl font-bold mb-1">測試簽到成功</h1>
        <p className="text-text-secondary text-sm mb-4">你已成功完成簽到流程測試</p>

        <div className="bg-white/60 rounded-lg px-4 py-3 mb-4 inline-block text-left">
          {session?.user?.email && (
            <div className="mb-2">
              <p className="text-xs text-text-muted">登入帳號</p>
              <p className="text-sm font-medium text-text-primary">{session.user.name}</p>
              <p className="text-xs text-text-muted">{session.user.email}</p>
            </div>
          )}
          {timeStr && (
            <div>
              <p className="text-xs text-text-muted">測試時間</p>
              <p className="text-sm font-mono font-medium text-text-primary">{timeStr}</p>
            </div>
          )}
        </div>

        <div className="bg-info-50 rounded-lg px-4 py-3 mb-4 text-left">
          <p className="text-sm font-medium text-info-500 mb-1">登入紀錄已保存</p>
          <p className="text-xs text-text-secondary">
            往後正式簽到時，僅需掃描投影幕上的 QR Code 即可快速完成，不需要重新登入 Google 帳號。
          </p>
        </div>

        <p className="text-text-muted text-xs">此為測試紀錄，不會影響正式出席成績</p>
      </div>
    </div>
  );
}

export default function DemoResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-dim">
        <p className="text-text-muted">載入中...</p>
      </div>
    }>
      <DemoResultContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(student\)/demo/result/page.tsx
git commit -m "feat: add demo result page with guidance messaging"
```

---

### Task 7: Admin Demo Records Page

**Files:**
- Create: `src/app/(admin)/demo/records/page.tsx`
- Modify: `src/app/(admin)/dashboard/page.tsx` — add "測試紀錄" entry point

- [ ] **Step 1: Create the admin records page**

```tsx
// src/app/(admin)/demo/records/page.tsx
'use client';

import { useEffect, useState } from 'react';

type DemoRecord = {
  id: number;
  user_email: string;
  user_name: string | null;
  checkin_time: number;
  created_at: number;
};

export default function DemoRecordsPage() {
  const [records, setRecords] = useState<DemoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/demo/records')
      .then((r) => r.json() as Promise<{ records: DemoRecord[] }>)
      .then((data) => {
        setRecords(data.records ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <nav className="text-sm text-text-muted mb-4">
        <a href="/dashboard" className="hover:text-brand-500">我的課程</a>
        <span className="mx-2">/</span>
        <span className="text-text-primary">測試簽到紀錄</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">測試簽到紀錄</h1>
        <span className="badge badge-info">{records.length} 人</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-text-muted">載入中...</div>
        </div>
      ) : records.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary text-lg mb-2">尚無測試紀錄</p>
          <p className="text-text-muted text-sm">學生透過 /demo 完成測試後會出現在這裡</p>
        </div>
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Email</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">測試時間</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text-primary">{r.user_name ?? '-'}</td>
                  <td className="px-4 py-3 text-text-muted">{r.user_email}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(r.checkin_time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <p className="text-sm text-text-muted">
          QR Code 圖片：<a href="/api/demo/qr" target="_blank" className="text-brand-500 hover:text-brand-600 underline underline-offset-2">下載 Demo QR Code</a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add entry point on dashboard**

In `src/app/(admin)/dashboard/page.tsx`, add a "測試紀錄" card below the course grid. Insert after the closing `)}` of the course grid ternary (after line 73), before the closing `</div>` at line 74:

```tsx
      {/* Demo test records link */}
      <div className="mt-6">
        <a href="/demo/records"
          className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow group inline-block w-full sm:w-auto">
          <div>
            <h2 className="font-semibold text-text-primary group-hover:text-brand-500 transition-colors">測試簽到紀錄</h2>
            <p className="text-sm text-text-muted mt-1">查看哪些學生已完成簽到流程測試</p>
          </div>
        </a>
      </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/demo/records/page.tsx src/app/\(admin\)/dashboard/page.tsx
git commit -m "feat: add admin demo records page with dashboard entry"
```

---

### Task 8: End-to-End Manual Test

- [ ] **Step 1: Apply migration to local D1**

Run: `npx wrangler d1 execute ntut-checkin --local --file=migrations/0003_demo_attendance.sql`

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

- [ ] **Step 3: Test student demo flow**

1. Open `http://localhost:9202/demo`
2. Verify privacy consent screen appears (clear localStorage `privacy_accepted` first if needed)
3. Accept → see "開始測試簽到" button
4. Click → Google OAuth → `/demo/result` with success message
5. Verify result page shows: account, time, "登入紀錄已保存" info box
6. Revisit `/demo` → should skip privacy, click again → upsert (no error)

- [ ] **Step 4: Test admin records**

1. Open `http://localhost:9202/dashboard`
2. Verify "測試簽到紀錄" card appears at bottom
3. Click → `/demo/records` shows the test entry from step 3
4. Verify table shows name, email, time

- [ ] **Step 5: Test QR code**

1. Open `http://localhost:9202/api/demo/qr`
2. Verify PNG image downloads/displays with QR code
3. Scan QR with phone → should open `/demo` page

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -u
git commit -m "fix: demo check-in adjustments from manual testing"
```
