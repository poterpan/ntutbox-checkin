'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';

const REFRESH_INTERVAL = 30_000;

type QrData = {
  nonce: string;
  mode: string;
  course_name?: string;
  class_date?: string;
};

export default function ProjectorPage() {
  const { courseId, id } = useParams<{ courseId: string; id: string }>();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [currentTime, setCurrentTime] = useState('');
  const [mode, setMode] = useState<'dynamic' | 'static'>('dynamic');
  const [courseName, setCourseName] = useState('');
  const [classDate, setClassDate] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closed, setClosed] = useState(false);

  const fetchQR = useCallback(async () => {
    const res = await fetch(`/api/courses/${courseId}/sessions/${id}/qr`);
    if (!res.ok) {
      setClosed(true);
      return;
    }
    setClosed(false);
    const data = await res.json() as QrData;
    const url = `${window.location.origin}/scan/${data.nonce}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 600, margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    setQrDataUrl(dataUrl);
    setMode(data.mode as 'dynamic' | 'static');
    if (data.course_name) setCourseName(data.course_name);
    if (data.class_date) setClassDate(data.class_date);
    setCountdown(30);
  }, [courseId, id]);

  useEffect(() => {
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

    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      clearInterval(qrTimer);
      clearInterval(countdownTimer);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [fetchQR]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const doc = printWindow.document;
    doc.open();

    const html = doc.createElement('html');
    const head = doc.createElement('head');
    const title = doc.createElement('title');
    title.textContent = `簽到 QR Code — ${courseName}`;
    head.appendChild(title);

    const style = doc.createElement('style');
    style.textContent = [
      'body{display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'min-height:100vh;margin:0;font-family:sans-serif;padding:2rem}',
      '.course{font-size:2.5rem;font-weight:bold;margin-bottom:0.25rem}',
      '.date{font-size:1.25rem;color:#666;margin-bottom:2rem}',
      '.subtitle{color:#666;margin-bottom:2rem;font-size:1.1rem}',
      'img{width:400px;height:400px}',
      '.note{color:#999;margin-top:2rem;font-size:0.875rem}',
    ].join('');
    head.appendChild(style);
    html.appendChild(head);

    const body = doc.createElement('body');

    const courseEl = doc.createElement('div');
    courseEl.className = 'course';
    courseEl.textContent = courseName || '課堂簽到';
    body.appendChild(courseEl);

    const dateEl = doc.createElement('div');
    dateEl.className = 'date';
    dateEl.textContent = classDate || '';
    body.appendChild(dateEl);

    const subtitle = doc.createElement('div');
    subtitle.className = 'subtitle';
    subtitle.textContent = '請用手機掃描 QR Code 簽到';
    body.appendChild(subtitle);

    const img = doc.createElement('img');
    img.src = qrDataUrl;
    body.appendChild(img);

    const note = doc.createElement('div');
    note.className = 'note';
    note.textContent = '靜態 QR Code — 整堂課有效';
    body.appendChild(note);

    html.appendChild(body);
    doc.appendChild(html);
    doc.close();
    printWindow.print();
  };

  if (closed) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
        <h1 className="text-3xl sm:text-5xl font-bold text-text-primary mb-4 text-center">{courseName || '課堂簽到'}</h1>
        {classDate && <p className="text-text-muted text-lg mb-8">{classDate}</p>}
        <div className="card p-8 text-center">
          <p className="text-5xl mb-4">⏹</p>
          <p className="text-xl font-bold text-text-secondary">本次簽到已結束</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-white flex flex-col items-center justify-between overflow-hidden p-4 sm:p-6 relative">
      {/* Fullscreen toggle — top right */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-3 right-3 btn btn-ghost btn-sm text-text-muted z-10 print:hidden"
        title={isFullscreen ? '退出全螢幕' : '全螢幕'}
      >
        {isFullscreen ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        )}
      </button>

      {/* Top: course name + subtitle */}
      <div className="text-center shrink-0 pt-2">
        <h1 className="text-2xl sm:text-4xl font-bold text-brand-700 leading-tight">
          {courseName || '課堂簽到'}
        </h1>
        {classDate && (
          <p className="text-text-muted text-sm sm:text-base">{classDate}</p>
        )}
        <p className="text-text-secondary text-sm sm:text-lg">請用手機掃描 QR Code 簽到</p>
      </div>

      {/* Center: QR Code — fills available space, fixed aspect ratio */}
      <div className="flex-1 flex items-center justify-center min-h-0 py-2">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 max-h-full object-contain"
          />
        ) : (
          <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-surface-muted rounded-2xl flex items-center justify-center">
            <p className="text-text-muted animate-pulse">載入中...</p>
          </div>
        )}
      </div>

      {/* Bottom: time + countdown */}
      <div className="text-center shrink-0 pb-2">
        <p className="text-3xl sm:text-5xl font-mono font-bold text-text-primary tracking-wider">
          {currentTime}
        </p>

        {mode === 'dynamic' ? (
          <div className="mt-2 w-48 sm:w-64 mx-auto">
            <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                style={{ width: `${((30 - countdown) / 30) * 100}%` }}
              />
            </div>
            <p className="text-text-muted text-xs sm:text-sm mt-1">{countdown}s 後更新</p>
          </div>
        ) : (
          <div className="mt-2 flex flex-col items-center gap-2">
            <span className="badge badge-info text-sm">靜態模式 — 整堂課有效</span>
            <button onClick={handlePrint} className="btn btn-secondary btn-sm print:hidden">
              列印 QR Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
