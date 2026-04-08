'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ERROR_CONFIG: Record<string, { message: string; action: string; actionUrl?: string }> = {
  invalid_domain: {
    message: '請使用 @ntut.org.tw 學校帳號登入',
    action: '重新掃描 QR Code 並選擇正確帳號',
  },
  missing_pid: {
    message: '簽到連結無效',
    action: '請重新掃描投影幕上的 QR Code',
  },
  pending_expired: {
    message: '簽到逾時（超過 10 分鐘）',
    action: '請重新掃描投影幕上的 QR Code',
  },
  invalid_session: {
    message: '找不到簽到場次',
    action: '請確認簽到是否已開放，或聯繫助教',
  },
};

function ErrorContent() {
  const params = useSearchParams();
  const code = params.get('code') ?? 'unknown';
  const config = ERROR_CONFIG[code] ?? {
    message: '發生未知錯誤',
    action: '請聯繫助教處理',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
      <div className="result-card result-card-danger mx-auto">
        <div className="w-14 h-14 rounded-full bg-danger-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
          ✕
        </div>
        <h1 className="text-xl font-bold text-danger-600 mb-2">出錯了</h1>
        <p className="text-text-secondary text-sm mb-6">{config.message}</p>
        <div className="bg-white/60 rounded-lg px-4 py-3">
          <p className="text-xs text-text-muted mb-1">建議操作</p>
          <p className="text-sm text-text-primary font-medium">{config.action}</p>
        </div>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-dim">
        <p className="text-text-muted">載入中...</p>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
