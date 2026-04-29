'use client';

import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';

type Course = {
  id: string; name: string; semester: string;
  default_class_start: string; default_weekday: number | null;
};

type OpenSession = {
  session_id: string;
  course_id: string;
  course_name: string;
  class_date: string;
  qr_mode: string;
  created_at: number;
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openSessions, setOpenSessions] = useState<OpenSession[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<OpenSession | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/courses').then((r) => r.json() as Promise<{ courses?: Course[]; is_super?: boolean }>),
      fetch('/api/sessions/open').then((r) => r.json() as Promise<{ sessions?: OpenSession[] }>),
    ]).then(([coursesData, openData]) => {
      setCourses(coursesData.courses ?? []);
      setIsSuper(coursesData.is_super ?? false);
      setOpenSessions(openData.sessions ?? []);
      setLoading(false);
    });
  }, []);

  const handleClose = async (s: OpenSession) => {
    setConfirmTarget(null);
    setClosingId(s.session_id);
    const res = await fetch(`/api/courses/${s.course_id}/sessions/${s.session_id}/close`, { method: 'POST' });
    if (res.ok) {
      setOpenSessions((prev) => prev.filter((x) => x.session_id !== s.session_id));
    }
    setClosingId(null);
  };

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-text-muted">載入中...</div>
      </div>
    );
  }

  return (
    <div>
      {openSessions.length > 0 && (
        <section className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-4">進行中的簽到</h1>
          <div className="grid gap-3">
            {openSessions.map((s) => {
              const overdue = s.class_date < today;
              return (
                <div
                  key={s.session_id}
                  className={`card p-4 flex items-center justify-between gap-3 ${
                    overdue ? 'bg-warning-50 border-warning-500' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-text-primary truncate">{s.course_name}</h2>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        s.qr_mode === 'static'
                          ? 'text-info-500 bg-info-50'
                          : 'text-brand-500 bg-brand-50'
                      }`}>
                        {s.qr_mode === 'static' ? '靜態' : '動態'}
                      </span>
                      {overdue && (
                        <span className="text-[10px] font-medium text-warning-600 bg-warning-100 px-1.5 py-0.5 rounded">
                          過期未關
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-text-muted mt-1">{s.class_date}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/courses/${s.course_id}/sessions/${s.session_id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      進入
                    </a>
                    <button
                      onClick={() => setConfirmTarget(s)}
                      disabled={closingId === s.session_id}
                      className="btn btn-danger btn-sm"
                    >
                      {closingId === s.session_id ? '結束中...' : '結束'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">我的課程</h1>
        {isSuper && (
          <a href="/super/courses" className="btn btn-secondary btn-sm">課程管理</a>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary text-lg mb-2">您目前沒有可管理的課程</p>
          <p className="text-text-muted text-sm">請聯繫系統管理員將您加入課程</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <a key={c.id} href={`/courses/${c.id}`}
              className="card p-5 hover:shadow-md transition-shadow group">
              <h2 className="font-semibold text-lg text-text-primary group-hover:text-brand-500 transition-colors">{c.name}</h2>
              <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
                <span>{c.semester}</span>
                {c.default_class_start && (
                  <>
                    <span className="text-border">|</span>
                    <span>{c.default_class_start}</span>
                  </>
                )}
                {c.default_weekday != null && (
                  <>
                    <span className="text-border">|</span>
                    <span>週{WEEKDAYS[c.default_weekday]}</span>
                  </>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Demo test records link */}
      <div className="mt-6">
        <a href="/demo/records"
          className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow group inline-block w-full sm:w-auto">
          <div>
            <h2 className="font-semibold text-text-primary group-hover:text-brand-500 transition-colors">測試簽到紀錄</h2>
            <p className="text-sm text-text-muted mt-1">查看哪些學生已完成簽到流程測試</p>
          </div>
        </a>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        title="結束簽到"
        message={
          confirmTarget
            ? `確定要結束「${confirmTarget.course_name}」(${confirmTarget.class_date})的簽到？結束後學生將無法再簽到。`
            : ''
        }
        danger
        onConfirm={() => confirmTarget && handleClose(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
