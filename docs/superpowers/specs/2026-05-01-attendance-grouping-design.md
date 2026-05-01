# 簽到名單分組與公假標示

設計日期：2026-05-01
範圍：場次簽到頁面 (`/courses/[courseId]/sessions/[id]`) 重新分組、登記請假時可標記為公假

## 動機

目前場次頁面把所有「已簽到」（含準時、遲到、請假、補簽）混在同一張表格裡，缺席和未簽到放在獨立區塊。實際登記時很難一眼看出誰是非準時同學，因為準時的人佔了表格大半且和遲到/請假混雜。最終工作流是把「非準時」的同學回到整學期共用的 Excel 標記，所以 UI 應該以「需要關注的人」為主角。

另外「公假」目前無處安放 ── 這類請假都先經過授課老師批准，不影響成績，需要在 UI 上和一般請假區分，但少數案例不值得拉成獨立 status。

## 範圍

**做：**
- 場次頁面 (`sessions/[id]/page.tsx`) 重新版面，採焦點翻轉式（需要關注優先 + 準時摺疊）
- `attendance` 表新增 `is_official_leave` flag
- 請假登記 modal 加「公假」勾選；編輯既有紀錄時也能切換
- 表格列上以 tag 區分一般請假與公假

**不做：**
- 不動 CSV 匯出格式（保持單純）
- 不動學期總表、analytics、export 頁
- 不引入元件測試框架
- 不新增 status 值、不改 `AttendanceStatus` union
- 不拆 `manual_reason` 為獨立欄位

## 設計

### 版面架構

```
┌─────────────────────────────────────────────┐
│ 統計列（不動）                                  │
├─────────────────────────────────────────────┤
│ 操作按鈕列（不動）                              │
├─────────────────────────────────────────────┤
│ 需要關注 (N 人)                                 │
│   ├─ 遲到 (3)                                  │
│   ├─ 請假 (2)        ← 含公假，行內加 tag       │
│   ├─ 補簽 (1)                                  │
│   └─ 缺席 / 未簽到 (5)                          │
├─────────────────────────────────────────────┤
│ 準時 (30) ▸  [預設摺疊]                        │
└─────────────────────────────────────────────┘
```

規則：

- 「需要關注」內每個小組是獨立 section + 獨立 table；該組 0 人就整段不渲染
- 整塊「需要關注」總人數為 0 時整塊不渲染
- 「準時」用 `<details>` 摺疊；當「需要關注」為 0 時準時自動展開（邊角案例）
- 每組內排序維持掃碼時間 asc；缺席 / 未簽到組內，已掃但被判 absent 的排前、roster 中完全未掃的排後

### 資料模型

新增 migration `migrations/0004_official_leave.sql`：

```sql
ALTER TABLE attendance ADD COLUMN is_official_leave INTEGER NOT NULL DEFAULT 0;
```

語意：

- `0` = 一般請假，`1` = 公假
- 僅在 `status = 'leave'` 時有意義，其他狀態固定為 0（後端寫入時強制清零）
- 用 INTEGER flag 而非新 status 值，避免破壞既有 `AttendanceStatus` union 與所有狀態判斷邏輯

### API 變動

1. `POST /api/courses/[courseId]/manual`
   - body 新增可選 `is_official_leave?: boolean`
   - 僅在 `status === 'leave'` 時生效；其他 status 寫入時強制存 0

2. `PATCH /api/courses/[courseId]/attendance/[id]/edit`
   - 切換到非 `leave` 狀態時自動把 flag 清為 0
   - v1 **不**接受 client 傳入 `is_official_leave`（因為 UI 層也沒有對應的修改控制；保留欄位的責任在後端寫入時的強制邏輯）

3. `GET /api/courses/[courseId]/sessions/[id]/list`
   - 回傳的 attendance 物件新增 `is_official_leave: number` 欄位

4. CSV 匯出 (`sessions/[id]/export/route.ts`) ── **不變**

### 前端拆分

把 `sessions/[id]/page.tsx`（目前 653 行）拆出兩個本地子元件：

- `_components/AttendanceGroup.tsx`：通用的「狀態小組」，渲染標題 + 一張 table。`late` / `leave` / `manual` / `on_time` 四組都用這個元件，傳不同 props
- `_components/AbsentGroup.tsx`：缺席 + 未簽到專用，因為列同時包含 `AttendanceRecord`（已掃但 absent）和 `NotSigned` 兩種型別、按鈕也不同（手動打卡 / 請假）

`page.tsx` 自己只留：資料抓取、modal、dialog、組裝順序。預估降到 ~350 行。

分組純前端 derive：

```ts
const lateRows   = attendance.filter(r => r.status === 'late');
const leaveRows  = attendance.filter(r => r.status === 'leave');
const manualRows = attendance.filter(r => r.status === 'manual');
const absentRows = attendance.filter(r => r.status === 'absent');
const onTimeRows = attendance.filter(r => r.status === 'on_time');
const attentionTotal = lateRows.length + leaveRows.length
                     + manualRows.length + absentRows.length + notSigned.length;
```

### UI 細節

**請假 modal**：當 `manualType === 'leave'` 時顯示一個 checkbox「公假」（預設未勾）。送出時把 `is_official_leave` 一起帶上。`manualType === 'manual'` 時隱藏 checkbox。

**表格列**：狀態 badge 後若 `is_official_leave === 1`，加一個小 tag「公假」── 用 `success` 綠色（與一般請假的 `info` 藍色區分）。

**狀態切換 dropdown**：保留原本的 5 個選項。切到非 leave 時 flag 自動歸零（後端處理）；切到 `leave` 時 flag 預設為 0（從非 leave 切過來的話，原值 0 不變；本來就是 leave 切到 leave 不會發生）。要事後切換是否公假，目前唯一入口是「刪掉重新登記」── v1 接受這個限制，若實際使用發現常需修改再加 UI 與對應 PATCH 支援。

## 資料流

登記公假：
1. 使用者在「缺席 / 未簽到」組點「請假」
2. modal 開啟，勾「公假」、填事由、送出
3. POST `/manual`，後端寫入 `status='leave', is_official_leave=1`
4. 10 秒輪詢或手動 refetch，前端拿到新資料
5. 該人移到「請假」組顯示，badge 旁帶「公假」綠 tag

修改現有公假事由：刪除紀錄、重新登記（v1 限制）。

## 錯誤處理

- 既有的 alert / dialog 流程不變
- 後端對 `is_official_leave` 的合法值收斂為 boolean → 0/1，非預期型別當 0 處理
- migration apply 失敗 → 回滾 PR；schema rollback 為 `ALTER TABLE attendance DROP COLUMN is_official_leave`（D1 支援）

## Testing

無新的 pure logic 需要 unit test，分組是純前端 filter。

**手動驗證 checklist（PR 描述附）：**

1. 一個場次同時有準時/遲到/請假/公假/補簽/缺席/未簽到 → 各組正確顯示
2. 全班準時 → 「需要關注」整塊不渲染，「準時」自動展開
3. 完全沒人簽到 → 「需要關注」顯示未簽到，「準時 (0)」摺疊
4. 在「需要關注」改某人狀態為準時 → refetch 後跳到準時組
5. 登記請假勾「公假」→ 列上看到「請假 + 公假」雙 tag
6. 編輯請假紀錄 → 切換到非 leave 狀態時 `is_official_leave` 應清零（資料庫層級驗證）
7. CSV 匯出格式不變（diff = 0）
8. 沒有名冊（hasRoster=false）→ 不出現未簽到區，其他組正常運作

## PR 流程

- branch：`feat/attendance-grouping`
- migration `0004_official_leave.sql` 一起進這個 PR
- 本地 `wrangler d1 migrations apply`（dev）驗證後 push
- PR 開到 `main`，CI 跑 Cloudflare Workers preview deploy
- preview URL 上跑完上述 8 條 checklist
- review 通過再合，不在驗證前 merge、不 force push
