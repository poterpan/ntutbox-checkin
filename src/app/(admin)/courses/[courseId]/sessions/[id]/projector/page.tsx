'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';
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
      width: 1400, margin: 2,
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
      // 24-hour: zh-TW otherwise prefixes 上午/下午, two CJK glyphs that dominate
      // the clock's width in the narrow landscape column and force it to wrap.
      setCurrentTime(new Date().toLocaleTimeString('zh-TW', {
        timeZone: 'Asia/Taipei', hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    };
    tick();
    const countdownTimer = setInterval(tick, 1000);

    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);

    // Keep the screen awake while showing the QR (browser releases the lock
    // when the tab is hidden, so re-acquire on visibility change).
    let wakeLock: WakeLockSentinel | null = null;
    const acquireWakeLock = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch {
        // Permission denied or unsupported — fail silently.
      }
    };
    const onVisibilityChange = () => { void acquireWakeLock(); };
    void acquireWakeLock();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(qrTimer);
      clearInterval(countdownTimer);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void wakeLock?.release().catch(() => {});
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
      '@page{margin:0}',
      'body{display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'height:100vh;margin:0;font-family:sans-serif;padding:2rem;box-sizing:border-box}',
      '.course{font-size:2.5rem;font-weight:bold;margin-bottom:0.25rem}',
      '.date{font-size:1.25rem;color:#666;margin-bottom:1.5rem}',
      '.subtitle{color:#666;margin-bottom:1.5rem;font-size:1.1rem}',
      'img{width:350px;height:350px}',
      '.note{color:#999;margin-top:1.5rem;font-size:0.875rem}',
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

  // CSS offers a line break after "/" and "-", which split 創新AI碩/博士班 right
  // after the slash. A word joiner removes that opportunity; together with
  // break-keep on the heading (which does the same for runs of CJK) the spaces
  // in the course name become the only break points, so the title wraps where a
  // reader would put the break. An over-long segment can still break, because
  // wrap-break-word overrides both as a last resort.
  const displayName = (courseName || '課堂簽到').replace(/([/-])/g, '$1⁠');

  // Type scales off vmin (the viewport's short edge) rather than Tailwind's sm:
  // step. sm: tops out at 640px, so a 1280px tablet drew the title at exactly
  // the 30px a phone got. vmin — not vw — holds the ratio steady whichever way
  // the tablet is turned.
  if (closed) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
        <h1 className="font-bold text-text-primary mb-4 text-center text-balance break-keep wrap-break-word text-[clamp(1.5rem,8vmin,5rem)]">
          {displayName}
        </h1>
        {classDate && (
          <p className="text-text-muted mb-8 text-[clamp(0.875rem,2.6vmin,1.75rem)]">{classDate}</p>
        )}
        <div className="card p-8 text-center">
          <p className="mb-4 text-[clamp(2rem,10vmin,6rem)]">⏹</p>
          <p className="font-bold text-text-secondary text-[clamp(1.25rem,4vmin,2.5rem)]">
            本次簽到已結束
          </p>
        </div>
      </div>
    );
  }

  return (
    // Portrait keeps the title / QR / clock stack. Landscape — the wall-mounted
    // tablet — moves the text into a left column so the QR is sized by the
    // screen's height rather than by whatever the stack leaves over: the single
    // column used to leave ~50% of a 1280x800 screen blank beside the code.
    // --qr-size is the landscape QR track: the full content height, capped so a
    // very wide screen still leaves the text column room.
    <div
      className="fixed inset-0 bg-white overflow-hidden touch-none select-none
                 grid gap-[2vmin] p-[3vmin]
                 grid-rows-[auto_minmax(0,1fr)_auto]
                 landscape:grid-rows-[auto_minmax(0,1fr)]
                 landscape:grid-cols-[minmax(0,1fr)_var(--qr-size)]"
      style={{ '--qr-size': 'min(calc(100dvh - 6vmin), 60vw)' } as CSSProperties}
    >
      {/* Fullscreen toggle — 44px hit area, this is a touch device */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-2 right-2 btn btn-ghost text-text-muted z-10 print:hidden min-h-11 min-w-11"
        title={isFullscreen ? '退出全螢幕' : '全螢幕'}
      >
        {isFullscreen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        )}
      </button>

      {/* Title. Sized by min(vmin, cqw): vmin governs the stacked portrait case,
          where the text spans the screen, and cqw governs the landscape column,
          which gets narrow as the viewport approaches square — 800x753 left the
          column at 260px, and a vmin-only title wrapped to five lines there. */}
      {/* portrait:px-16 keeps the centred title clear of the fullscreen button,
          which floats over this row's right edge when the stack is full-width.
          In landscape the button sits over the QR column instead. */}
      <div className="@container min-w-0 text-center portrait:px-16 landscape:text-left landscape:col-start-1 landscape:row-start-1">
        <h1 className="font-bold text-brand-700 leading-tight text-balance break-keep wrap-break-word text-[clamp(1.5rem,min(8vmin,12cqw),5rem)]">
          {displayName}
        </h1>
        <p className="text-text-secondary mt-[0.6vmin] text-[clamp(0.875rem,min(2.6vmin,4cqw),1.75rem)]">
          {classDate ? `${classDate} · ` : ''}請用手機掃描 QR Code 簽到
        </p>
      </div>

      {/* QR — the grid track is already square-sized, so this just centres it */}
      <div className="flex items-center justify-center min-h-0 min-w-0 landscape:col-start-2 landscape:row-start-1 landscape:row-span-2">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" className="max-h-full max-w-full aspect-square object-contain" />
        ) : (
          <div className="h-full max-h-full max-w-full aspect-square bg-surface-muted rounded-2xl flex items-center justify-center">
            <p className="text-text-muted animate-pulse">載入中...</p>
          </div>
        )}
      </div>

      {/* Clock + refresh state */}
      <div className="@container min-w-0 text-center landscape:text-left landscape:col-start-1 landscape:row-start-2 landscape:self-end">
        <p className="font-mono font-bold text-text-primary tracking-wider leading-none text-[clamp(1.25rem,min(7vmin,13cqw),4.5rem)]">
          {currentTime}
        </p>
        {mode === 'dynamic' ? (
          <div className="mt-[1.5vmin] mx-auto w-40 sm:w-56 landscape:mx-0 landscape:w-full">
            <div className="h-[clamp(4px,1vmin,12px)] bg-surface-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                style={{ width: `${((30 - countdown) / 30) * 100}%` }}
              />
            </div>
            <p className="text-text-muted mt-[0.8vmin] text-[clamp(0.75rem,2.2vmin,1.5rem)]">
              {countdown}s 後更新
            </p>
          </div>
        ) : (
          <div className="mt-[1.5vmin] flex flex-col items-center gap-[1vmin] landscape:items-start">
            {/* .badge is unlayered in globals.css, so it outranks any Tailwind
                font-size utility — the clamp has to ride in on the element. */}
            <span className="badge badge-info" style={{ fontSize: 'clamp(0.75rem, 2.2vmin, 1.5rem)' }}>
              靜態模式 — 整堂課有效
            </span>
            <button onClick={handlePrint} className="btn btn-secondary print:hidden">列印</button>
          </div>
        )}
      </div>
    </div>
  );
}
