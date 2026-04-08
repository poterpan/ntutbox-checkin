'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';

export default function ProjectorPage() {
  const { courseId, id } = useParams<{ courseId: string; id: string }>();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [countdown, setCountdown] = useState(45);

  useEffect(() => {
    const fetchQR = async () => {
      const res = await fetch(`/api/courses/${courseId}/sessions/${id}/qr`);
      if (!res.ok) return;
      const { nonce } = await res.json();
      const url = `${window.location.origin}/scan/${nonce}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setCountdown(45);
    };

    fetchQR();
    const qrTimer = setInterval(fetchQR, 45_000);
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => { clearInterval(qrTimer); clearInterval(countdownTimer); };
  }, [courseId, id]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-2">課堂簽到</h1>
      <p className="text-gray-500 mb-8">請用手機掃描 QR Code</p>
      {qrDataUrl ? (
        <img src={qrDataUrl} alt="QR Code" className="w-80 h-80" />
      ) : (
        <div className="w-80 h-80 bg-gray-100 flex items-center justify-center">
          <p className="text-gray-400">載入中...</p>
        </div>
      )}
      <p className="mt-6 text-gray-400 text-sm">QR Code 將在 {countdown} 秒後更新</p>
    </div>
  );
}
