'use client';

import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense } from 'react';

function DemoResultContent() {
  const params = useSearchParams();
  const { data: session } = useSession();

  const timeParam = params.get('t');
  const timeStr = timeParam
    ? new Date(Number(timeParam)).toLocaleTimeString('zh-TW', {
        timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
      <div className="result-card result-card-success mx-auto">
        <div className="w-14 h-14 rounded-full bg-success-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
          ✓
        </div>
        <h1 className="text-xl font-bold mb-1">測試簽到成功</h1>
        <p className="text-text-secondary text-sm mb-4">你已成功完成簽到流程測試</p>

        <div className="bg-white/60 rounded-lg px-4 py-3 mb-4 inline-block text-left">
          {session?.user?.email && (
            <div className="mb-2">
              <p className="text-xs text-text-muted">登入帳號</p>
              <p className="text-sm font-medium text-text-primary">{session.user.name}</p>
              <p className="text-xs text-text-muted">{session.user.email}</p>
            </div>
          )}
          {timeStr && (
            <div>
              <p className="text-xs text-text-muted">測試時間</p>
              <p className="text-sm font-mono font-medium text-text-primary">{timeStr}</p>
            </div>
          )}
        </div>

        <div className="bg-info-50 rounded-lg px-4 py-3 mb-4 text-left">
          <p className="text-sm font-medium text-info-500 mb-1">登入紀錄已保存</p>
          <p className="text-xs text-text-secondary">
            往後正式簽到時，僅需掃描投影幕上的 QR Code 即可快速完成，不需要重新登入 Google 帳號。
          </p>
        </div>

        <p className="text-text-muted text-xs">此為測試紀錄，不會影響正式出席成績</p>
      </div>
    </div>
  );
}

export default function DemoResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-dim">
        <p className="text-text-muted">載入中...</p>
      </div>
    }>
      <DemoResultContent />
    </Suspense>
  );
}
