'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface AttendanceRecord {
  status: string;
  scan_time: number;
  is_manual: number;
  class_date: string;
  course_name: string;
}

const STATUS_LABEL: Record<string, { text: string; class: string }> = {
  on_time: { text: '準時', class: 'bg-success-50 text-success-600' },
  late: { text: '遲到', class: 'bg-warning-50 text-warning-600' },
  absent: { text: '缺席', class: 'bg-danger-50 text-danger-600' },
  too_early: { text: '過早', class: 'bg-info-50 text-info-500' },
  leave: { text: '請假', class: 'bg-info-50 text-info-500' },
};

function formatDate(dateStr: string) {
  // class_date is like "2026-04-09"
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  });
}

export default function MyRecordsPage() {
  const { data: session, status: authStatus } = useSession();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus !== 'authenticated') {
      signIn('google');
      return;
    }

    fetch('/api/my-records')
      .then(async (res) => {
        if (!res.ok) throw new Error('載入失敗');
        const data = (await res.json()) as { records: AttendanceRecord[] };
        setRecords(data.records);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authStatus]);

  if (authStatus !== 'authenticated' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dim">
        <p className="text-text-muted">載入中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dim p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-lg font-bold text-text-primary">我的簽到紀錄</h1>
          <p className="text-xs text-text-muted">{session?.user?.email}</p>
        </div>

        {error && (
          <div className="bg-danger-50 border border-danger-500 rounded-lg p-3 mb-4 text-sm text-danger-600">
            {error}
          </div>
        )}

        {records.length === 0 && !error ? (
          <div className="bg-surface rounded-lg border border-border p-6 text-center">
            <p className="text-text-muted text-sm">尚無簽到紀錄</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r, i) => {
              const label = STATUS_LABEL[r.status] ?? {
                text: r.status,
                class: 'bg-surface-muted text-text-muted',
              };
              return (
                <div
                  key={i}
                  className="bg-surface rounded-lg border border-border px-4 py-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {r.course_name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatDate(r.class_date)} {formatTime(r.scan_time)}
                      {r.is_manual ? ' (手動)' : ''}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ml-3 ${label.class}`}
                  >
                    {label.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
