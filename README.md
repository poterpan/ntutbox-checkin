# NTUT 課堂簽到系統

北科大課程線上 QR Code 簽到系統。學生掃碼 + Google 登入即完成簽到，助教可即時檢視名單、匯出紀錄、追蹤異常。

## 技術棧

- **前端/後端**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **部署**: Cloudflare Workers via `@opennextjs/cloudflare`
- **資料庫**: Cloudflare D1 (SQLite)
- **快取**: Cloudflare KV (nonce / pending)
- **認證**: Auth.js v5 (Google OAuth, JWT session)
- **裝置指紋**: FingerprintJS OSS

## 本地開發

```bash
# 安裝依賴
npm install

# 設定環境變數（複製 .dev.vars.example 或手動建立 .dev.vars）
# 需要: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, ALLOWED_EMAIL_DOMAIN

# 執行 D1 migration（本地）
npx wrangler d1 execute ntut-checkin-db --local --file=./migrations/0001_init.sql

# 啟動開發伺服器（Node 環境，port 9202）
npm run dev

# 啟動 Workers 預覽（完整 Cloudflare runtime，含 D1/KV）
npm run preview
```

## 測試

```bash
npm test
```

## 部署

```bash
# 設定 secrets（首次）
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put NEXTAUTH_SECRET

# 執行遠端 migration（首次）
npx wrangler d1 execute ntut-checkin-db --remote --file=./migrations/0001_init.sql

# 部署
npm run deploy
```

## 專案結構

```
src/
├── app/
│   ├── (student)/     # 學生端：掃碼落地頁、結果頁
│   ├── (admin)/       # 助教端：控制台、簽到管理、異常分析
│   └── api/           # API routes
├── lib/               # 共用模組：auth、permissions、status、time、nonce
└── migrations/        # D1 schema
```

詳細規格請參考 `北科專題討論-線上簽到系統-技術文檔.md`。
