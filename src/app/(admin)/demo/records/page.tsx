'use client';

import { useEffect, useState } from 'react';

type DemoRecord = {
  id: number;
  user_email: string;
  user_name: string | null;
  checkin_time: number;
  created_at: number;
};

export default function DemoRecordsPage() {
  const [records, setRecords] = useState<DemoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [demoUrl, setDemoUrl] = useState('/demo');

  useEffect(() => {
    setDemoUrl(`${window.location.origin}/demo`);
    fetch('/api/demo/records')
      .then((r) => r.json() as Promise<{ records: DemoRecord[] }>)
      .then((data) => {
        setRecords(data.records ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <nav className="text-sm text-text-muted mb-4">
        <a href="/dashboard" className="hover:text-brand-500">我的課程</a>
        <span className="mx-2">/</span>
        <span className="text-text-primary">測試簽到紀錄</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">測試簽到紀錄</h1>
        <span className="badge badge-info">{records.length} 人</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-text-muted">載入中...</div>
        </div>
      ) : records.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary text-lg mb-2">尚無測試紀錄</p>
          <p className="text-text-muted text-sm">學生透過 /demo 完成測試後會出現在這裡</p>
        </div>
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Email</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">測試時間</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text-primary">{r.user_name ?? '-'}</td>
                  <td className="px-4 py-3 text-text-muted">{r.user_email}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(r.checkin_time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span>Demo 連結：</span>
          <code className="bg-surface-muted px-2 py-0.5 rounded text-xs font-mono text-text-primary select-all">{demoUrl}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(demoUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="btn btn-ghost btn-sm !min-h-0 !py-0.5 !px-2 text-xs"
          >
            {copied ? '已複製' : '複製'}
          </button>
        </div>
        <p className="text-sm text-text-muted">
          QR Code 圖片：<a href="/api/demo/qr" target="_blank" className="text-brand-500 hover:text-brand-600 underline underline-offset-2">下載 Demo QR Code</a>
        </p>
      </div>
    </div>
  );
}
