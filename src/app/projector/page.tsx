'use client';

import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';

type OpenSession = {
  session_id: string;
  course_id: string;
  course_name: string;
  class_date: string;
  qr_mode: string;
  created_at: number;
};

type Course = {
  id: string;
  name: string;
  default_weekday: number | null;
};

type ProjectorState =
  | { kind: 'loading'; status: string }
  | { kind: 'confirm-single'; course: Course }
  | { kind: 'choose-multiple'; courses: Course[] }
  | { kind: 'idle' }
  | { kind: 'error'; message: string };

export default function ProjectorLauncher() {
  const [state, setState] = useState<ProjectorState>({ kind: 'loading', status: '正在尋找進行中的簽到...' });
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [sessionsRes, coursesRes] = await Promise.all([
        fetch('/api/sessions/open'),
        fetch('/api/courses'),
      ]);

      if (sessionsRes.status === 401 || coursesRes.status === 401) {
        window.location.href = '/api/auth/signin?callbackUrl=/projector';
        return;
      }
      if (!sessionsRes.ok || !coursesRes.ok) {
        setState({ kind: 'error', message: '載入失敗，請確認網路連線' });
        return;
      }

      const { sessions } = await sessionsRes.json() as { sessions?: OpenSession[] };
      const { courses } = await coursesRes.json() as { courses?: Course[] };

      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      const todaysSessions = (sessions ?? []).filter((s) => s.class_date === today);

      // Branch A: today already has an open session — jump straight to its QR page.
      // Stale sessions from earlier days are intentionally ignored.
      if (todaysSessions.length > 0) {
        const target = todaysSessions.reduce((a, b) => (b.created_at > a.created_at ? b : a));
        window.location.href = `/courses/${target.course_id}/sessions/${target.session_id}/projector`;
        return;
      }

      // No session today — see if today is a default_weekday for any manageable course.
      // Use noon to avoid any DST edge case when deriving the weekday from the calendar date.
      const todayWeekday = new Date(today + 'T12:00:00').getDay();
      const candidates = (courses ?? []).filter((c) => c.default_weekday === todayWeekday);

      if (candidates.length === 0) {
        setState({ kind: 'idle' });
      } else if (candidates.length === 1) {
        setState({ kind: 'confirm-single', course: candidates[0] });
      } else {
        setState({ kind: 'choose-multiple', courses: candidates });
      }
    })().catch(() => {
      setState({ kind: 'error', message: '載入失敗，請確認網路連線' });
    });
  }, []);

  const openSession = async (courseId: string) => {
    setOpening(courseId);
    try {
      const res = await fetch(`/api/courses/${courseId}/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.ok) {
        const data = await res.json() as { session_id: string };
        window.location.href = `/courses/${courseId}/sessions/${data.session_id}/projector`;
        return;
      }
      const err = await res.json().catch(() => ({})) as { error?: string };
      setOpening(null);
      if (err.error === 'session_already_exists') {
        setState({ kind: 'error', message: '該日已有簽到場次，請重新整理頁面' });
      } else {
        setState({ kind: 'error', message: '建立簽到失敗，請稍後再試' });
      }
    } catch {
      setOpening(null);
      setState({ kind: 'error', message: '建立簽到失敗，請確認網路連線' });
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <img src="/icons/icon-192x192.png" alt="icon" className="w-20 h-20 mb-6" />
      <h1 className="text-2xl font-bold text-text-primary mb-2">投影模式</h1>

      {state.kind === 'loading' && (
        <p className="text-text-muted animate-pulse">{state.status}</p>
      )}

      {state.kind === 'error' && (
        <p className="text-danger-600">{state.message}</p>
      )}

      {state.kind === 'idle' && (
        <p className="text-text-muted">今日無簽到</p>
      )}

      {state.kind === 'choose-multiple' && (
        <div className="w-full max-w-md mt-4">
          <p className="text-text-muted text-center mb-4">今日尚未開啟簽到，請選擇要開啟的課程</p>
          <div className="grid gap-3">
            {state.courses.map((c) => (
              <div key={c.id} className="card p-4 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-text-primary truncate">{c.name}</h2>
                <button
                  onClick={() => openSession(c.id)}
                  disabled={opening !== null}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {opening === c.id ? '開啟中...' : '開啟'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={state.kind === 'confirm-single'}
        title="開啟今日簽到"
        message={state.kind === 'confirm-single' ? `要開啟「${state.course.name}」的今日簽到嗎？` : ''}
        confirmLabel={opening ? '開啟中...' : '開啟'}
        cancelLabel="不開"
        onConfirm={() => {
          if (state.kind === 'confirm-single' && !opening) openSession(state.course.id);
        }}
        onCancel={() => {
          if (opening) return;
          setState({ kind: 'idle' });
        }}
      />
    </div>
  );
}
