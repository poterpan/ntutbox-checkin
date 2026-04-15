'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { getFingerprint } from '@/lib/fingerprint';
import { detectInAppBrowser, type InAppBrowserType } from '@/lib/in-app-browser';

type ScanState = 'in_app_browser' | 'privacy' | 'scanning' | 'redirecting' | 'error';

export default function ScanPage() {
  const { nonce } = useParams<{ nonce: string }>();
  const { status: authStatus } = useSession();
  const [state, setState] = useState<ScanState>('privacy');
  const [inAppType, setInAppType] = useState<InAppBrowserType>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanTimeStr, setScanTimeStr] = useState('');
  const [copied, setCopied] = useState(false);

  // Initial detection: in-app browser takes priority over privacy_accepted shortcut
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
      // openExternalBrowser=1 already set but still in LINE (rare old version)
      setInAppType('line');
      setState('in_app_browser');
      return;
    }

    if (type === 'ig' || type === 'fb' || type === 'messenger') {
      setInAppType(type);
      setState('in_app_browser');
      return;
    }

    // Regular browser: honor privacy_accepted shortcut
    if (localStorage.getItem('privacy_accepted') === '1') {
      setState('scanning');
    }
  }, []);

  useEffect(() => {
    if (state !== 'scanning') return;
    (async () => {
      try {
        const fp = await getFingerprint();
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nonce, fingerprint: fp }),
        });

        const formatTime = (ts: number) =>
          new Date(ts).toLocaleTimeString('zh-TW', {
            timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit',
          });

        const localTime = formatTime(Date.now());

        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setScanTimeStr(localTime);
          setErrorMsg(
            data.error === 'invalid_nonce'
              ? 'QR Code 已失效，請重新掃描投影幕上的 QR Code'
              : data.error === 'session_closed'
              ? '本次簽到已結束'
              : data.error === 'session_expired'
              ? '此場次已過上課日期，無法簽到'
              : '發生錯誤，請重試'
          );
          setState('error');
          return;
        }

        const { pending_id, scan_time } = await res.json() as { pending_id: string; scan_time: number };
        setScanTimeStr(formatTime(scan_time));
        setState('redirecting');

        const checkinUrl = `/api/checkin?pid=${pending_id}&t=${scan_time}`;

        // Send pre-OAuth beacon before redirecting to signIn (only when OAuth will happen)
        if (authStatus !== 'authenticated') {
          try {
            const beaconBody = JSON.stringify({
              phase: 'pre_oauth_signin',
              ua: navigator.userAgent.slice(0, 200),
              nonce_prefix: nonce.slice(0, 8),
              pending_id,
              auth_status: authStatus,
              in_app_browser_type: detectInAppBrowser(navigator.userAgent),
            });
            if (navigator.sendBeacon) {
              navigator.sendBeacon('/api/log/beacon', new Blob([beaconBody], { type: 'application/json' }));
            } else {
              fetch('/api/log/beacon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: beaconBody,
                keepalive: true,
              }).catch(() => undefined);
            }
          } catch { /* beacon failures must not block flow */ }
        }

        setTimeout(() => {
          if (authStatus === 'authenticated') {
            window.location.href = checkinUrl;
          } else {
            sessionStorage.setItem('last_checkin_url', checkinUrl);
            signIn('google', { callbackUrl: checkinUrl }, { prompt: 'select_account' });
          }
        }, 600);
      } catch {
        setErrorMsg('網路錯誤，請確認網路連線後重試');
        setState('error');
      }
    })();
  }, [nonce, state, authStatus]);

  const acceptPrivacy = () => {
    localStorage.setItem('privacy_accepted', '1');
    setState('scanning');
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
    // Fallback: show readonly input for long-press copy (covered in UI below)
    setCopied(false);
  };

  // In-app browser guide screen
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
            onClick={() => setState(localStorage.getItem('privacy_accepted') === '1' ? 'scanning' : 'privacy')}
            className="btn btn-ghost btn-sm w-full text-text-muted"
          >
            我知道風險，直接在此繼續
          </button>
        </div>
      </div>
    );
  }

  // Privacy screen
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
          <p className="text-danger-600 text-xs font-medium mb-5">請使用學校帳號 @ntut.org.tw 登入</p>
          <button onClick={acceptPrivacy} className="btn btn-primary w-full">
            我了解，開始簽到
          </button>
        </div>
      </div>
    );
  }

  // Error screen
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
        <div className="result-card result-card-danger mx-auto">
          <p className="text-4xl mb-3">✕</p>
          <h1 className="text-lg font-bold text-danger-600 mb-2">簽到失敗</h1>
          <p className="text-text-secondary text-sm mb-4">{errorMsg}</p>
          {scanTimeStr && (
            <div className="bg-white/60 rounded-lg px-3 py-2 mb-4 inline-block">
              <p className="text-xs text-text-muted">掃碼時間</p>
              <p className="text-sm font-mono font-medium text-text-primary">{scanTimeStr}</p>
            </div>
          )}
          <p className="text-text-muted text-xs">請重新掃描投影幕上的 QR Code</p>
        </div>
      </div>
    );
  }

  // Progress screen (scanning / redirecting)
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
      <div className="card p-6 max-w-sm w-full">
        <div className="flex flex-col gap-4">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-success-100 text-success-600 flex items-center justify-center text-sm font-bold flex-shrink-0">✓</span>
            <div>
              <p className="font-medium text-text-primary">掃碼成功</p>
              <p className="text-xs text-text-muted">QR Code 已驗證</p>
            </div>
          </div>
          {/* Step 2 */}
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              state === 'scanning'
                ? 'bg-brand-100 text-brand-500 animate-pulse'
                : 'bg-success-100 text-success-600'
            }`}>
              {state === 'scanning' ? '2' : '✓'}
            </span>
            <div>
              <p className="font-medium text-text-primary">
                {state === 'scanning' ? '正在記錄簽到時間...' : '時間已記錄'}
              </p>
              <p className="text-xs text-text-muted">
                {scanTimeStr ? `掃碼時間：${scanTimeStr}` : '以此刻時間作為簽到依據'}
              </p>
            </div>
          </div>
          {/* Step 3 */}
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              state === 'redirecting'
                ? 'bg-brand-100 text-brand-500 animate-pulse'
                : 'bg-surface-muted text-text-muted'
            }`}>3</span>
            <div>
              <p className={`font-medium ${state === 'redirecting' ? 'text-text-primary' : 'text-text-muted'}`}>
                {authStatus === 'authenticated' ? '完成簽到' : '跳轉 Google 登入'}
              </p>
              {state === 'redirecting' && authStatus !== 'authenticated' && (
                <p className="text-xs text-warning-500 font-medium">請選擇學校帳號 (@ntut.org.tw)</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
