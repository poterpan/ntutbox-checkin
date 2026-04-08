'use client';

import { useEffect, useState } from 'react';

type Course = { id: string; name: string; semester: string };

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/courses')
      .then((r) => r.json() as Promise<{ courses?: Course[]; is_super?: boolean }>)
      .then((data) => {
        setCourses(data.courses ?? []);
        setIsSuper(data.is_super ?? false);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-gray-500">載入中...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的課程</h1>
        {isSuper && (
          <a href="/super/courses"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            + 新增課程
          </a>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">您目前沒有可管理的課程</p>
          <p className="text-gray-400 text-sm mt-2">請聯繫系統管理員將您加入課程</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <a key={c.id} href={`/courses/${c.id}`}
              className="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <h2 className="font-semibold text-lg">{c.name}</h2>
              <p className="text-gray-500 text-sm mt-1">{c.semester}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
