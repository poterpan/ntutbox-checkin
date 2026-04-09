# NTUT 課堂簽到系統

[![Deploy](https://github.com/poterpan/ntutbox-checkin/actions/workflows/deploy.yml/badge.svg)](https://github.com/poterpan/ntutbox-checkin/actions/workflows/deploy.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

**Production**: [checkin.ntutbox.com](https://checkin.ntutbox.com)

北科大課程線上 QR Code 簽到系統。學生掃碼 + Google 登入即完成簽到，助教可即時檢視名單、匯出紀錄、追蹤異常。

## 功能

- **學生端**：掃碼簽到、查看歷史簽到紀錄、Google 帳號登入（@ntut.org.tw）
- **管理端**：即時簽到名單、手動補簽/請假、名冊管理、異常分析、CSV 匯出
- **QR Code**：動態（30 秒輪換）/ 靜態模式切換，投影頁全螢幕顯示
- **安全性**：裝置指紋、IP 記錄、nonce 防重放、過期場次自動拒絕簽到

## 技術棧

- **前端/後端**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **部署**: Cloudflare Workers via `@opennextjs/cloudflare`
- **資料庫**: Cloudflare D1 (SQLite)
- **快取**: Cloudflare KV (nonce / pending)
- **認證**: Auth.js v5 (Google OAuth, JWT session, 30 天滾動過期)
- **裝置指紋**: FingerprintJS OSS
- **CI/CD**: GitHub Actions（push to main 自動部署）

## 本地開發

```bash
# 安裝依賴
npm install

# 設定環境變數（複製 .dev.vars.example 或手動建立 .dev.vars）
# 需要: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, ALLOWED_EMAIL_DOMAIN
# 可選: IMPERSONATE_SECRET（啟用身份切換測試功能）

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

推送到 `main` 分支會透過 GitHub Actions 自動建置與部署。

首次設定需手動執行：

```bash
# 設定 secrets
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put NEXTAUTH_SECRET

# 可選：啟用 impersonate 功能
npx wrangler secret put IMPERSONATE_SECRET

# 執行遠端 migration
npx wrangler d1 execute ntut-checkin-db --remote --file=./migrations/0001_init.sql
```

GitHub Actions 需設定 repository secret：`CLOUDFLARE_API_TOKEN`

## 專案結構

```
src/
├── app/
│   ├── (student)/     # 學生端：掃碼、簽到結果、歷史紀錄
│   ├── (admin)/       # 管理端：控制台、簽到管理、名冊、異常分析
│   └── api/           # API routes（含 dev/impersonate 測試用）
├── lib/               # 共用模組：auth、permissions、status、time、nonce
└── components/        # 共用元件
migrations/            # D1 schema
scripts/               # 資料匯入腳本
```

詳細規格請參考 `北科專題討論-線上簽到系統-技術文檔.md`。
