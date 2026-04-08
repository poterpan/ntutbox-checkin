'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Session = { id: string; class_date: string; status: string; class_start_at: number };
type CourseInfo = {
  id: string; name: string; semester: string;
  default_class_start: string; default_early_open_min: number;
  default_late_cutoff_min: number; default_weekday: number | null;
  timezone: string;
};

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export default function CourseControlPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Fetch sessions
    fetch(`/api/courses/${courseId}/sessions/create`)
      .then((r) => r.json() as Promise<{ sessions?: Session[] }>)
      .then((data) => { setSessions(data.sessions ?? []); setLoading(false); });

    // Fetch course info
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
  const hasToday = sessions.some((s) => s.class_date === today);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{course?.name ?? '課程控制台'}</h1>
          {course && <p className="text-gray-500 text-sm mt-1">{course.semester}</p>}
        </div>
        <button onClick={createSession} disabled={creating}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {creating ? '建立中...' : '+ 新增本日簽到'}
        </button>
      </div>

      {course && (
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">簽到時間規則</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-400">上課時間</span>
              <p className="font-medium">{course.default_class_start}</p>
            </div>
            <div>
              <span className="text-gray-400">提前開放</span>
              <p className="font-medium">{course.default_early_open_min} 分鐘</p>
            </div>
            <div>
              <span className="text-gray-400">遲到截止</span>
              <p className="font-medium">上課後 {course.default_late_cutoff_min} 分鐘</p>
            </div>
            {course.default_weekday != null && (
              <div>
                <span className="text-gray-400">上課日</span>
                <p className="font-medium">星期{WEEKDAY_NAMES[course.default_weekday]}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-6 text-sm">
        <a href={`/courses/${courseId}/analytics`} className="text-blue-600 hover:underline">異常分析</a>
        <a href={`/courses/${courseId}/students`} className="text-blue-600 hover:underline">修課名單</a>
        <a href={`/courses/${courseId}/admins`} className="text-blue-600 hover:underline">助教管理</a>
        <a href={`/courses/${courseId}/export`} className="text-blue-600 hover:underline">全學期匯出</a>
      </div>

      {!loading && !hasToday && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 font-medium">今天還沒開啟簽到</p>
          <p className="text-red-500 text-sm mt-1">請點擊「+ 新增本日簽到」開始今日簽到</p>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">載入中...</p>
      ) : sessions.length === 0 ? (
        <p className="text-gray-500">尚無簽到場次，點擊上方按鈕建立</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <a key={s.id} href={`/courses/${courseId}/sessions/${s.id}`}
              className="block p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.class_date}</span>
                <span className={`text-sm px-2 py-1 rounded ${
                  s.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {s.status === 'open' ? '進行中' : '已結束'}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
