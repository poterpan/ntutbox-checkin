'use client';

import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense } from 'react';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, {
  icon: string; title: string; desc: string; next: string;
  cardClass: string; iconBg: string;
}> = {
  on_time: {
    icon: '✓', title: '簽到成功', desc: '判定結果：準時',
    next: '可以關閉此頁面了',
    cardClass: 'result-card-success', iconBg: 'bg-success-500',
  },
  late: {
    icon: '!', title: '簽到成功', desc: '判定結果：遲到',
    next: '可以關閉此頁面了',
    cardClass: 'result-card-warning', iconBg: 'bg-warning-500',
  },
  absent: {
    icon: '✕', title: '簽到記錄', desc: '判定結果：缺席（已超過截止時間）',
    next: '如有疑問請聯繫助教',
    cardClass: 'result-card-danger', iconBg: 'bg-danger-500',
  },
  too_early: {
    icon: '⏳', title: '尚未開放', desc: '簽到時間還沒到',
    next: '請在上課前 30 分鐘內重新掃碼',
    cardClass: 'result-card-info', iconBg: 'bg-info-500',
  },
  already_signed: {
    icon: '✓', title: '已簽到', desc: '本堂課已有您的簽到紀錄',
    next: '無需重複簽到，可以關閉此頁面',
    cardClass: 'result-card-muted', iconBg: 'bg-text-muted',
  },
  leave: {
    icon: '📋', title: '請假', desc: '本堂課已核准請假',
    next: '可以關閉此頁面了',
    cardClass: 'result-card-info', iconBg: 'bg-info-500',
  },
};

function ResultContent() {
  const params = useSearchParams();
  const { data: session } = useSession();
  const status = params.get('status') ?? 'unknown';
  const scanTimeParam = params.get('t');
  const scanTimeStr = scanTimeParam
    ? new Date(Number(scanTimeParam)).toLocaleTimeString('zh-TW', {
        timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null;
  const config = STATUS_CONFIG[status] ?? {
    icon: '?', title: '未知狀態', desc: '發生未預期的錯誤',
    next: '請聯繫助教', cardClass: 'result-card-muted', iconBg: 'bg-text-muted',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dim">
      <div className={`result-card ${config.cardClass} mx-auto`}>
        <div className={`w-14 h-14 rounded-full ${config.iconBg} text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4`}>
          {config.icon}
        </div>
        <h1 className="text-xl font-bold mb-1">{config.title}</h1>
        <p className="text-text-secondary text-sm mb-4">{config.desc}</p>

        <div className="bg-white/60 rounded-lg px-3 py-2 mb-4 inline-block">
          {scanTimeStr && (
            <>
              <p className="text-xs text-text-muted">掃碼時間</p>
              <p className="text-sm font-mono font-medium text-text-primary mb-1">{scanTimeStr}</p>
            </>
          )}
          {session?.user?.name && (
            <>
              <p className="text-xs text-text-muted">登入帳號</p>
              <p className="text-sm font-medium text-text-primary">{session.user.name}</p>
              <p className="text-xs text-text-muted">{session.user.email}</p>
            </>
          )}
        </div>

        <p className="text-text-muted text-xs">{config.next}</p>

        <Link
          href="/my-records"
          className="inline-block mt-4 text-xs text-brand-500 hover:text-brand-600 underline underline-offset-2"
        >
          查看我的簽到紀錄
        </Link>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-dim">
        <p className="text-text-muted">載入中...</p>
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
