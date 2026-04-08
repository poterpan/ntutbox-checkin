'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { getFingerprint } from '@/lib/fingerprint';

type ScanState = 'loading' | 'signing_in' | 'error';

export default function ScanPage() {
  const { nonce } = useParams<{ nonce: string }>();
  const [state, setState] = useState<ScanState>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
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
              : '發生錯誤，請重試'
          );
          setState('error');
          return;
        }

        const { pending_id } = await res.json() as { pending_id: string };
        setState('signing_in');

        signIn('google', {
          callbackUrl: `/api/checkin?pid=${pending_id}`,
        });
      } catch {
        setErrorMsg('網路錯誤，請確認網路連線後重試');
        setState('error');
      }
    })();
  }, [nonce]);

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-red-600 text-lg font-medium mb-4">{errorMsg}</p>
          <p className="text-gray-500 text-sm">請重新掃描教室投影幕上的 QR Code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4" />
        <p className="text-gray-600">
          {state === 'loading' ? '正在記錄簽到時間...' : '正在跳轉 Google 登入...'}
        </p>
      </div>
    </div>
  );
}
