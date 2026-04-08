'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';

const REFRESH_INTERVAL = 30_000; // 30 seconds

export default function ProjectorPage() {
  const { courseId, id } = useParams<{ courseId: string; id: string }>();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [currentTime, setCurrentTime] = useState('');
  const [mode, setMode] = useState<'dynamic' | 'static'>('dynamic');

  useEffect(() => {
    const fetchQR = async () => {
      const res = await fetch(`/api/courses/${courseId}/sessions/${id}/qr`);
      if (!res.ok) return;
      const data = await res.json() as { nonce: string; mode: string };
      const url = `${window.location.origin}/scan/${data.nonce}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512, margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setMode(data.mode as 'dynamic' | 'static');
      setCountdown(30);
    };

    fetchQR();
    const qrTimer = setInterval(fetchQR, REFRESH_INTERVAL);

    const tick = () => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      setCurrentTime(new Date().toLocaleTimeString('zh-TW', {
        timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    };
    tick();
    const countdownTimer = setInterval(tick, 1000);

    return () => {
      clearInterval(qrTimer);
      clearInterval(countdownTimer);
    };
  }, [courseId, id]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const doc = printWindow.document;
    doc.open();

    const html = doc.createElement('html');
    const head = doc.createElement('head');
    const title = doc.createElement('title');
    title.textContent = '簽到 QR Code';
    head.appendChild(title);

    const style = doc.createElement('style');
    style.textContent = 'body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;}h1{font-size:2rem;margin-bottom:0.5rem}p{color:#666;margin-bottom:1.5rem}img{width:400px;height:400px}.note{color:#999;margin-top:2rem;font-size:0.875rem}';
    head.appendChild(style);
    html.appendChild(head);

    const body = doc.createElement('body');

    const h1 = doc.createElement('h1');
    h1.textContent = '課堂簽到';
    body.appendChild(h1);

    const p = doc.createElement('p');
    p.textContent = '請用手機掃描 QR Code';
    body.appendChild(p);

    const img = doc.createElement('img');
    img.src = qrDataUrl;
    body.appendChild(img);

    const note = doc.createElement('p');
    note.className = 'note';
    note.textContent = '靜態 QR Code — 整堂課有效';
    body.appendChild(note);

    html.appendChild(body);
    doc.appendChild(html);
    doc.close();
    printWindow.print();
  };

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

        {mode === 'dynamic' ? (
          <div className="mt-4 w-64 mx-auto">
            <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                style={{ width: `${((30 - countdown) / 30) * 100}%` }}
              />
            </div>
            <p className="text-text-muted text-sm mt-2">{countdown}s 後更新</p>
          </div>
        ) : (
          <div className="mt-4">
            <span className="badge badge-info text-sm">靜態模式 — 整堂課有效</span>
            <div className="mt-3">
              <button onClick={handlePrint} className="btn btn-secondary btn-sm">
                列印 QR Code
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
