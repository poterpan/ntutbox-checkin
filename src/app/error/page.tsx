'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ERROR_MAP: Record<string, string> = {
  invalid_domain: '請使用 @ntut.org.tw 學校帳號登入',
  missing_pid: '簽到連結無效，請重新掃描 QR Code',
  pending_expired: '簽到逾時（超過 10 分鐘），請重新掃描 QR Code',
  invalid_session: '找不到簽到場次，請聯繫助教',
};

function ErrorContent() {
  const params = useSearchParams();
  const code = params.get('code') ?? 'unknown';
  const message = ERROR_MAP[code] ?? '發生未知錯誤，請聯繫助教';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">😵</p>
        <h1 className="text-xl font-bold text-red-600 mb-2">出錯了</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">載入中...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
