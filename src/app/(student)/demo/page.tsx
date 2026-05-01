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
      sessionStorage.setItem('last_checkin_url', checkinUrl);
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
          <p className="text-danger-600 text-sm font-semibold text-center mb-5">請使用學校帳號 @ntut.org.tw 登入</p>
          <button onClick={acceptPrivacy} className="btn btn-primary w-full">
            我了解，繼續
          </button>
        </div>
      </div>
    );
  }

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
        <p className="text-text-secondary text-sm mb-4">
          點擊下方按鈕後，請使用學校 Google 帳號登入。
        </p>

        <div className="bg-surface-muted rounded-lg px-4 py-3 mb-5 text-left text-xs">
          <p className="font-medium text-text-primary mb-2">學校 Google 帳號資訊</p>
          <ul className="space-y-1.5 text-text-secondary">
            <li><span className="font-medium">帳號：</span>與校內信箱相同，將 @ntut.edu.tw 改為 <span className="font-medium text-brand-500">@ntut.org.tw</span></li>
            <li><span className="font-medium">預設密碼：</span>身分證字號前 8 碼（英文字母<span className="font-medium">小寫</span>）加上 <span className="font-mono font-medium">tW</span>，共 10 碼，例如 <span className="font-mono">a1234567tW</span></li>
            <li><span className="font-medium">忘記密碼：</span>可透過 Google 備援手機/信箱重設，或聯繫計網中心（分機 3239）</li>
          </ul>
        </div>
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
