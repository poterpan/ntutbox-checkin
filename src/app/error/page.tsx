'use client';

import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense } from 'react';

type ErrorConfig = {
  message: string;
  action: string;
  needsRelogin?: boolean;
  details?: string[];
  secondaryAction?: { href: string; label: string };
};

const ERROR_CONFIG: Record<string, ErrorConfig> = {
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
    message: '登入流程沒有完成，瀏覽器搞砸了一些事情。',
    details: [
      '常見原因包含 Chrome iOS 切換 Google 帳號/Profile、等待太久、返回上一頁，或瀏覽器未保留登入流程 cookie。',
      '如果剛掃 QR Code 簽到，請回簽到區重新掃描；如果只是要登入系統，請回首頁重新登入。',
    ],
    action: '建議使用 Safari，或確認使用 @ntut.org.tw 學校帳號後重新掃碼。',
    secondaryAction: { href: '/', label: '不是簽到？回首頁' },
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
        <p className={`text-text-secondary text-sm ${config.details ? 'mb-4' : 'mb-6'}`}>
          {config.message}
        </p>
        {config.details && (
          <div className="text-left text-xs text-text-secondary mb-5 space-y-2">
            {config.details.map((detail) => (
              <p key={detail}>{detail}</p>
            ))}
          </div>
        )}
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
        {config.secondaryAction && (
          <a href={config.secondaryAction.href} className="btn btn-secondary w-full block mt-3">
            {config.secondaryAction.label}
          </a>
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
