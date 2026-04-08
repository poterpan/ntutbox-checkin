'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Session = { id: string; class_date: string; status: string; class_start_at: number };
type CourseInfo = {
  id: string; name: string; semester: string;
  default_class_start: string; default_early_open_min: number;
  default_late_cutoff_min: number; default_weekday: number | null;
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function CourseControlPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/sessions/create`)
      .then((r) => r.json() as Promise<{ sessions?: Session[] }>)
      .then((data) => { setSessions(data.sessions ?? []); setLoading(false); });
    fetch('/api/courses')
      .then((r) => r.json() as Promise<{ courses?: CourseInfo[] }>)
      .then((data) => {
        const c = data.courses?.find((c) => c.id === courseId);
        if (c) setCourse(c);
      });
  }, [courseId]);

  const createSession = async () => {
    setCreating(true);
    const res = await fetch(`/api/courses/${courseId}/sessions/create`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json() as { session_id: string; class_date?: string; class_start_at: number };
      setSessions((prev) => [
        { id: data.session_id, class_date: data.class_date ?? '', status: 'open', class_start_at: data.class_start_at },
        ...prev,
      ]);
    } else {
      const err = await res.json() as { error?: string };
      alert(err.error === 'session_already_exists' ? '今日已有簽到場次' : '建立失敗');
    }
    setCreating(false);
  };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  const todayOpenSession = sessions.find((s) => s.class_date === today && s.status === 'open');
  const pastSessions = sessions.filter((s) => s !== todayOpenSession);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-pulse text-text-muted">載入中...</div></div>;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-text-muted mb-4">
        <a href="/dashboard" className="hover:text-brand-500">我的課程</a>
        <span className="mx-2">/</span>
        <span className="text-text-primary">{course?.name ?? courseId}</span>
      </nav>

      {/* Today Hero Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{course?.name ?? '課程控制台'}</h1>
            {course && (
              <div className="flex items-center gap-3 mt-1 text-sm text-text-muted flex-wrap">
                <span>{course.semester}</span>
                <span className="text-border">|</span>
                <span>{course.default_class_start} 上課</span>
                <span className="text-border">|</span>
                <span>提前 {course.default_early_open_min} 分鐘開放</span>
                <span className="text-border">|</span>
                <span>遲到 {course.default_late_cutoff_min} 分鐘</span>
                {course.default_weekday != null && (
                  <>
                    <span className="text-border">|</span>
                    <span>週{WEEKDAYS[course.default_weekday]}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Today status */}
        {todayOpenSession ? (
          <div className="flex items-center justify-between bg-success-50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="badge badge-success">進行中</span>
              <span className="text-sm text-text-primary font-medium">今日簽到 ({todayOpenSession.class_date})</span>
            </div>
            <a href={`/courses/${courseId}/sessions/${todayOpenSession.id}`} className="btn btn-primary btn-sm">
              進入控制台
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-warning-50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="badge badge-warning">未開啟</span>
              <span className="text-sm text-text-primary font-medium">今天還沒開啟簽到</span>
            </div>
            <button onClick={createSession} disabled={creating} className="btn btn-primary btn-sm">
              {creating ? '建立中...' : '開啟今日簽到'}
            </button>
          </div>
        )}
      </div>

      {/* Management Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <a href={`/courses/${courseId}/analytics`} className="card p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-2xl mb-1">&#x1F50D;</p>
          <p className="text-sm font-medium text-text-primary">異常分析</p>
        </a>
        <a href={`/courses/${courseId}/students`} className="card p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-2xl mb-1">&#x1F4CB;</p>
          <p className="text-sm font-medium text-text-primary">修課名單</p>
        </a>
        <a href={`/courses/${courseId}/admins`} className="card p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-2xl mb-1">&#x1F465;</p>
          <p className="text-sm font-medium text-text-primary">助教管理</p>
        </a>
        <a href={`/courses/${courseId}/export`} className="card p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-2xl mb-1">&#x1F4CA;</p>
          <p className="text-sm font-medium text-text-primary">全學期匯出</p>
        </a>
      </div>

      {/* All sessions */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">所有場次</h2>
        {pastSessions.length === 0 ? (
          <div className="card p-8 text-center text-text-muted">尚無簽到紀錄</div>
        ) : (
          <div className="space-y-2">
            {pastSessions.map((s) => (
              <a key={s.id} href={`/courses/${courseId}/sessions/${s.id}`}
                className="card px-4 py-3 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-text-primary">{s.class_date}</span>
                  {s.class_date === today && <span className="text-xs text-text-muted">今天</span>}
                </div>
                <span className={s.status === 'open' ? 'badge badge-success' : 'badge badge-muted'}>
                  {s.status === 'open' ? '進行中' : '已結束'}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
