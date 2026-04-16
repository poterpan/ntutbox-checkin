# Demo Test Check-in Feature

## Overview

A demo page that lets students practice the full check-in flow (privacy consent, Google OAuth, result) without affecting real attendance data. Stores test records in a separate table so admins can track who has tested. Also serves as a way to pre-establish login sessions — subsequent real check-ins become one-tap.

## Routes

| Route | Type | Purpose |
|-------|------|---------|
| `GET /demo` | Student page | Test entry point (same flow as `/scan/[nonce]` but no nonce required) |
| `GET /api/demo/checkin` | API | OAuth callback → write `demo_attendance` → redirect to result |
| `GET /demo/result` | Student page | Custom result page with success message and guidance |
| `GET /api/demo/qr` | API | Returns QR Code PNG pointing to `/demo` |
| `GET /demo/records` | Admin page | List of all students who completed the demo |
| `GET /dashboard` (existing) | Admin page | Add "測試紀錄" entry point linking to `/demo/records` |

## Student Flow

1. Student opens `/demo` via URL or scanned QR code.
2. **Privacy consent**: Same `localStorage('privacy_accepted')` mechanism as real check-in. If already accepted, skip. Accepting here carries over to real check-ins.
3. **Google OAuth**: Same NextAuth flow. If already logged in (session valid), skip. Logging in here establishes the session for future real check-ins.
4. `GET /api/demo/checkin` runs:
   - Validate email domain (`@ntut.org.tw`)
   - `INSERT OR REPLACE` into `demo_attendance` (upsert on email)
   - Redirect to `/demo/result`
5. **Result page** shows:
   - "測試簽到成功" with success styling
   - Login account (email) and timestamp
   - "登入紀錄已保存，往後正式簽到僅需掃碼即可快速完成"
   - If duplicate visit, still show success (upsert means no error)

## Database

New table in a new migration (`0003_demo_attendance.sql`):

```sql
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

- `UNIQUE(user_email)` — one record per student, upsert on repeat visits (update `checkin_time`).
- No `session_id` or `course_id` — this is independent of any real course/session.

## QR Code Generation

- `GET /api/demo/qr` uses existing `qrcode` package (already in dependencies) to generate a PNG.
- Points to the full `/demo` URL (using `NEXTAUTH_URL` or `NEXT_PUBLIC_BASE_URL` env var for the domain).
- Admin downloads the image to share in announcements/group chats.

## Admin Records Page

- **Entry point**: Dashboard page (`/dashboard`) gets a card/button "測試紀錄" linking to `/demo/records`.
- **Page content**: Table listing all demo participants (email, name, test time), sorted by most recent first.
- **Auth**: Same admin auth as other admin pages (course admin or super admin).
- **API**: `GET /api/demo/records` returns the list.

## UI Details

### `/demo` page
- Reuse scan page layout and privacy consent screen.
- Replace QR scanning UI with a simple "開始測試簽到" button (no nonce/QR scanning step needed).
- In-app browser detection: same logic as real scan page — guide students to open in external browser.

### `/demo/result` page
- Similar visual style to `/result` but distinct messaging:
  - Large success checkmark
  - "測試簽到成功"
  - Account email and timestamp
  - Key message: "登入紀錄已保存，往後正式簽到僅需掃碼即可快速完成"
  - Brief note about what to expect during real check-in (just scan, no re-login needed)

## Scope Exclusions

- No demo-specific projector page.
- No test attempt limits.
- No expiry mechanism (demo stays available indefinitely).
- No cross-referencing with enrolled_students to show "who hasn't tested" (can add later if needed).
