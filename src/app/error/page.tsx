'use client';

import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense } from 'react';

const ERROR_CONFIG: Record<string, { message: string; action: string; needsRelogin?: boolean }> = {
  invalid_domain: {
    message: '你登入的帳號不是學校帳號，請點下方重新登入並選擇 @ntut.org.tw',
    action: '重新登入並選擇學校帳號',
    needsRelogin: true,
  },
  AccessDenied: {
    message: '你登入的帳號不是學校帳號，請點下方重新登入並選擇 @ntut.org.tw',
    action: '重新登入並選擇學校帳號',
    needsRelogin: true,
  },
  Configuration: {
    message: '登入過程被中斷（可能按了返回鍵或等待過久），請重新開始登入流程',
    action: '重新登入',
    needsRelogin: true,
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
  session_closed: {
    message: '本次簽到已結束',
    action: '請聯繫助教處理',
  },
};

function ErrorContent() {
  const params = useSearchParams();
  // NextAuth v5 error redirects use ?error=AccessDenied; existing routes use ?code=...
  // Read both.
  const code = params.get('error') ?? params.get('code') ?? 'unknown';
  const config = ERROR_CONFIG[code] ?? {
    message: '發生未知錯誤',
    action: '請聯繫助教處理',
  };

  const handleRelogin = () => {
    const stored = typeof window !== 'undefined'
      ? sessionStorage.getItem('last_checkin_url')
      : null;
    const callbackUrl = stored ?? '/';
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('last_checkin_url');
    }
    signIn('google', { callbackUrl }, { prompt: 'select_account' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
      <div className="result-card result-card-danger mx-auto">
        <div className="w-14 h-14 rounded-full bg-danger-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
          ✕
        </div>
        <h1 className="text-xl font-bold text-danger-600 mb-2">出錯了</h1>
        <p className="text-text-secondary text-sm mb-6">{config.message}</p>
        {config.needsRelogin ? (
          <button onClick={handleRelogin} className="btn btn-primary w-full">
            {config.action}
          </button>
        ) : (
          <div className="bg-white/60 rounded-lg px-4 py-3">
            <p className="text-xs text-text-muted mb-1">建議操作</p>
            <p className="text-sm text-text-primary font-medium">{config.action}</p>
          </div>
        )}
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
