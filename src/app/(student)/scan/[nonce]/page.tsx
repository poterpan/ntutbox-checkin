'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { getFingerprint } from '@/lib/fingerprint';

type ScanState = 'privacy' | 'scanning' | 'redirecting' | 'error';

export default function ScanPage() {
  const { nonce } = useParams<{ nonce: string }>();
  const { status: authStatus } = useSession();
  const [state, setState] = useState<ScanState>('privacy');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('privacy_accepted') === '1') {
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

        if (!res.ok) {
          const data = await res.json() as { error?: string };
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

        const { pending_id } = await res.json() as { pending_id: string };
        setState('redirecting');

        const checkinUrl = `/api/checkin?pid=${pending_id}`;
        setTimeout(() => {
          if (authStatus === 'authenticated') {
            window.location.href = checkinUrl;
          } else {
            signIn('google', { callbackUrl: checkinUrl });
          }
        }, 600);
      } catch {
        setErrorMsg('網路錯誤，請確認網路連線後重試');
        setState('error');
      }
    })();
  }, [nonce, state]);

  const acceptPrivacy = () => {
    localStorage.setItem('privacy_accepted', '1');
    setState('scanning');
  };

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
          <p className="text-text-muted text-xs mb-5">僅供課程出席管理，學期結束後可申請刪除。</p>
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
          <p className="text-text-secondary text-sm mb-6">{errorMsg}</p>
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
              <p className={`font-medium ${state === 'scanning' ? 'text-text-primary' : 'text-text-primary'}`}>
                {state === 'scanning' ? '正在記錄簽到時間...' : '時間已記錄'}
              </p>
              <p className="text-xs text-text-muted">以此刻時間作為簽到依據</p>
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
