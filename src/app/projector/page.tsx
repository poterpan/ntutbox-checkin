'use client';

import { useEffect, useState } from 'react';

type OpenSession = {
  session_id: string;
  course_id: string;
  course_name: string;
  class_date: string;
  qr_mode: string;
  created_at: number;
};

export default function ProjectorLauncher() {
  const [status, setStatus] = useState('正在尋找進行中的簽到...');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/sessions/open');
      if (res.status === 401) {
        window.location.href = '/api/auth/signin?callbackUrl=/projector';
        return;
      }
      if (!res.ok) {
        setStatus('載入失敗');
        return;
      }

      const { sessions } = await res.json() as { sessions?: OpenSession[] };
      if (!sessions?.length) {
        setStatus('目前沒有進行中的簽到');
        setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
        return;
      }

      // Prefer today's session; fall back to most recently created.
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      const todays = sessions.filter((s) => s.class_date === today);
      const pool = todays.length > 0 ? todays : sessions;
      const target = pool.reduce((a, b) => (b.created_at > a.created_at ? b : a));

      window.location.href = `/courses/${target.course_id}/sessions/${target.session_id}/projector`;
    })().catch(() => {
      setStatus('載入失敗，請確認網路連線');
    });
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <img src="/icons/icon-192x192.png" alt="icon" className="w-20 h-20 mb-6" />
      <h1 className="text-2xl font-bold text-text-primary mb-2">投影模式</h1>
      <p className="text-text-muted animate-pulse">{status}</p>
    </div>
  );
}
