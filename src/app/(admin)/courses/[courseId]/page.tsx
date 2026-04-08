'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Session = { id: string; class_date: string; status: string; class_start_at: number };

export default function CourseControlPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/sessions/create`)
      .then((r) => r.json() as Promise<{ sessions?: Session[] }>)
      .then((data) => { setSessions(data.sessions ?? []); setLoading(false); });
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">課程控制台</h1>
        <button onClick={createSession} disabled={creating}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {creating ? '建立中...' : '+ 新增本日簽到'}
        </button>
      </div>

      <div className="flex gap-4 mb-6 text-sm">
        <a href={`/courses/${courseId}/analytics`} className="text-blue-600 hover:underline">異常分析</a>
        <a href={`/courses/${courseId}/students`} className="text-blue-600 hover:underline">修課名單</a>
        <a href={`/courses/${courseId}/admins`} className="text-blue-600 hover:underline">助教管理</a>
      </div>

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
