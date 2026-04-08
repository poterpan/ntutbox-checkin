'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';

export default function ProjectorPage() {
  const { courseId, id } = useParams<{ courseId: string; id: string }>();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [countdown, setCountdown] = useState(45);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const fetchQR = async () => {
      const res = await fetch(`/api/courses/${courseId}/sessions/${id}/qr`);
      if (!res.ok) return;
      const { nonce } = await res.json() as { nonce: string };
      const url = `${window.location.origin}/scan/${nonce}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512, margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setCountdown(45);
    };

    fetchQR();
    const qrTimer = setInterval(fetchQR, 45_000);

    const tick = () => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      setCurrentTime(new Date().toLocaleTimeString('zh-TW', {
        timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    };
    tick();
    const countdownTimer = setInterval(tick, 1000);

    return () => { clearInterval(qrTimer); clearInterval(countdownTimer); };
  }, [courseId, id]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-text-primary mb-1">課堂簽到</h1>
      <p className="text-text-muted text-lg mb-8">請用手機掃描 QR Code</p>

      {qrDataUrl ? (
        <img src={qrDataUrl} alt="QR Code" className="w-80 h-80 sm:w-96 sm:h-96" />
      ) : (
        <div className="w-80 h-80 sm:w-96 sm:h-96 bg-surface-muted rounded-2xl flex items-center justify-center">
          <p className="text-text-muted animate-pulse">載入中...</p>
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-5xl font-mono font-bold text-text-primary tracking-wider">{currentTime}</p>
        <div className="mt-4 w-64 mx-auto">
          <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-1000"
              style={{ width: `${((45 - countdown) / 45) * 100}%` }}
            />
          </div>
          <p className="text-text-muted text-sm mt-2">{countdown}s 後更新</p>
        </div>
      </div>
    </div>
  );
}
