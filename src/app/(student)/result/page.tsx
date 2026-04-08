'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const STATUS_MAP: Record<string, { icon: string; title: string; desc: string; color: string }> = {
  on_time: { icon: '✅', title: '簽到成功 — 準時', desc: '已記錄您的出席', color: 'text-green-600' },
  late: { icon: '⚠️', title: '簽到成功 — 遲到', desc: '已記錄，但判定為遲到', color: 'text-yellow-600' },
  absent: { icon: '❌', title: '簽到失敗 — 缺席', desc: '已超過簽到截止時間', color: 'text-red-600' },
  too_early: { icon: '⏰', title: '尚未開放簽到', desc: '請在上課前 30 分鐘內再試', color: 'text-blue-600' },
  already_signed: { icon: '✅', title: '您已簽到過', desc: '本堂課已有簽到紀錄', color: 'text-green-600' },
};

function ResultContent() {
  const params = useSearchParams();
  const status = params.get('status') ?? 'unknown';
  const info = STATUS_MAP[status] ?? {
    icon: '❓', title: '未知狀態', desc: '請聯繫助教', color: 'text-gray-600',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">{info.icon}</p>
        <h1 className={`text-xl font-bold mb-2 ${info.color}`}>{info.title}</h1>
        <p className="text-gray-500">{info.desc}</p>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">載入中...</div>}>
      <ResultContent />
    </Suspense>
  );
}
