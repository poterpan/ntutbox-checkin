'use client';

import { useEffect, useState } from 'react';

export default function ProjectorLauncher() {
  const [status, setStatus] = useState('正在尋找進行中的簽到...');

  useEffect(() => {
    (async () => {
      // Find the latest open session via courses + sessions APIs
      const coursesRes = await fetch('/api/courses');
      if (!coursesRes.ok) {
        window.location.href = '/api/auth/signin?callbackUrl=/projector';
        return;
      }

      const { courses } = await coursesRes.json() as { courses?: { id: string }[] };
      if (!courses?.length) {
        setStatus('沒有可管理的課程');
        return;
      }

      // Check each course for an open session
      for (const course of courses) {
        const sessionsRes = await fetch(`/api/courses/${course.id}/sessions/create`);
        if (!sessionsRes.ok) continue;
        const { sessions } = await sessionsRes.json() as { sessions?: { id: string; status: string }[] };
        const openSession = sessions?.find((s) => s.status === 'open');
        if (openSession) {
          window.location.href = `/courses/${course.id}/sessions/${openSession.id}/projector`;
          return;
        }
      }

      // No open session found
      setStatus('目前沒有進行中的簽到');
      setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
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
