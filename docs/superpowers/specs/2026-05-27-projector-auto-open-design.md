# Projector 自動偵測並提示開啟簽到

設計日期：2026-05-27
範圍：Projector launcher 頁面 (`/projector`)

## 動機

目前流程是：簽到專用平板開機 → 自動進入 `/projector` → 系統撈使用者的 open sessions → 跳到對應的 QR Code 投影頁。理論上只要登入 session 還在，平板就會自動顯示 QR Code。

但這個流程有兩個缺口：

1. **沒先開簽到的話什麼都不顯示**。使用者必須另外拿手機進 dashboard 開啟簽到，多一個步驟、容易忘。
2. **過期未關的 session 會殘留顯示**。`src/app/projector/page.tsx:36-38` 的 fallback 邏輯會在「今天沒有 open session 但有舊的」時，挑出最新的舊 session 並顯示其 QR Code，造成「錯誤內容投影出去」的狀況。

`courses.default_weekday`（INTEGER nullable, 0–6）已經記錄每門課的預設上課日，可以用來判斷「今天該不該開簽到」。`/api/sessions/open` 與 `/api/courses` 也都已依使用者權限過濾，自動提示開啟的所有資料來源都現成可用。

## 範圍

**做：**
- 重寫 `/projector` 的判斷邏輯，分為「有今日 session」、「今日是上課日但沒開」、「今日非上課日」三種分支
- 在「今日是上課日但沒開」分支加上自動提示 UI（單門用 confirm dialog、多門用課程清單）
- 移除舊 session fallback 行為，根除過期 QR 殘留問題
- 移除「2 秒自動跳 dashboard」行為（平板情境下不合理）

**不做：**
- 不新增任何 API endpoint（既有 `/api/sessions/open`、`/api/courses`、`POST /api/courses/[courseId]/sessions/create` 已足夠）
- 不動資料模型、不動權限模型
- 不在非上課日提供「手動選課」入口（避免檢修日打擾或誤觸）
- 不做倒數自動開啟（避免誤觸；改為使用者主動按確認）
- 不做 polling / 定時自動重整（Workers Free plan CPU 限制 + 簡潔）
- 不自動處理過期未關 session（dashboard 已有「結束」按鈕和「過期未關」標籤）

## 設計

### 判斷流程

進入 `/projector`：

1. **未登入** → 維持現行：導到 `/api/auth/signin?callbackUrl=/projector`
2. **已登入** → 並行載入 `/api/sessions/open` 與 `/api/courses`
3. 依今日（`Asia/Taipei`）分支：

| 分支 | 條件 | 行為 |
|---|---|---|
| **A** | open sessions 中存在 `class_date === today` | 跳轉 `/courses/{id}/sessions/{sid}/projector`。多筆時挑 `created_at` 最新者。 |
| **B** | 沒有今日 session，且今天是**剛好 1 門**可管理課程的 `default_weekday` | 顯示 confirm dialog：「要開啟『XX 課』的今日簽到嗎？」 |
| **B'** | 沒有今日 session，且今天是**多門**可管理課程的 `default_weekday` | 顯示課程卡片清單，每張一個「開啟」按鈕 |
| **C** | 沒有今日 session，且今天不是任何可管理課程的 `default_weekday` | 靜態顯示「今日無簽到」，不再自動跳轉 |

**關鍵：分支 A 完全不諮詢 `default_weekday`。** 補課 / 調課 場景下使用者只要在 dashboard 預建好該日 session，平板開機就會直接顯示其 QR Code。`default_weekday` 只在「沒有現成 session」時用來決定「要不要主動跳出提示」。

### 開啟簽到動作

使用者按下「開啟」後：

1. `POST /api/courses/{courseId}/sessions/create`（body 空，使用課程預設時間建立今日場次）
2. 成功 → 跳轉 `/courses/{courseId}/sessions/{returned_session_id}/projector`
3. 失敗 → 顯示錯誤訊息（特別處理 409 `session_already_exists`：提示重新整理頁面，因為理論上前面 `/api/sessions/open` 已應帶出該 session）

### UI 草圖

```
┌───────────────────────────────────┐
│            [icon]                 │
│         投影模式                  │
│                                   │
│   分支 A: （直接跳轉，過場顯示「正在開啟簽到...」）
│                                   │
│   分支 B (1 門):                  │
│   ┌─────────────────────────┐    │
│   │ 今日尚未開啟簽到          │    │
│   │ 要開啟「資料庫」的簽到？  │    │
│   │   [不開]    [開啟]       │    │
│   └─────────────────────────┘    │
│                                   │
│   分支 B' (多門):                  │
│   今日尚未開啟簽到                 │
│   ┌─────────────────────────┐    │
│   │ 資料庫            [開啟] │    │
│   │ 演算法            [開啟] │    │
│   └─────────────────────────┘    │
│                                   │
│   分支 C:                          │
│   今日無簽到                       │
└───────────────────────────────────┘
```

confirm dialog 沿用 `src/components/confirm-dialog.tsx`。多門清單沿用 dashboard「進行中的簽到」卡片樣式。

### 邊界情況

- **網路錯誤**：沿用現行「載入失敗，請確認網路連線」訊息
- **POST 回 409**：顯示「該日已有簽到場次，請重新整理」訊息（理論上 race condition 才會發生）
- **平板長時間無操作**：保持靜態畫面，不 polling 不自動跳轉。使用者重新整理即可重新判斷
- **未授權（401）**：沿用現行邏輯導到登入

## 涉及檔案

只動一個檔案：

- `src/app/projector/page.tsx`：
  - 移除 fallback 最新一筆 stale session 的邏輯（第 36–38 行）
  - 移除 2 秒跳 dashboard 邏輯（第 30 行）
  - 加上 `/api/courses` 載入
  - 加上今日 weekday 比對與三向分支 UI
  - 加上 `POST sessions/create` 呼叫與成功後跳轉

API 與資料模型不變。

## 驗收條件

1. 平板上今天已開簽到 → 直接顯示 QR Code（行為與現行相同）
2. 今天還沒開、是 default_weekday、且只有一門符合的課 → 出現 confirm dialog 詢問是否開啟
3. 今天還沒開、是 default_weekday、且有多門符合 → 出現課程清單可選擇開啟
4. 今天還沒開、不是任何 default_weekday → 顯示「今日無簽到」，不自動跳 dashboard
5. 昨天有 stale session 沒關、今天還沒開 → 不再 fallback 顯示昨天的 QR Code
6. 按下「開啟」→ 成功建立 session 並跳到該 session 的 projector 頁
