'use client';

import { useEffect, useState } from 'react';

export default function ProjectorLauncher() {
  const [status, setStatus] = useState('正在尋找進行中的簽到...');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/projector/redirect', { redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (location) {
          window.location.href = location;
          return;
        }
      }
      // Fallback: fetch and follow normally
      window.location.href = '/api/projector/redirect';
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
