'use client';

import { useEffect, useState } from 'react';

type Course = { id: string; name: string; semester: string };

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/courses')
      .then((r) => r.json() as Promise<{ courses?: Course[] }>)
      .then((data) => { setCourses(data.courses ?? []); setLoading(false); });
  }, []);

  if (loading) return <p className="text-gray-500">載入中...</p>;

  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">您目前沒有可管理的課程</p>
        <p className="text-gray-400 text-sm mt-2">請聯繫系統管理員將您加入課程</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">我的課程</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {courses.map((c) => (
          <a key={c.id} href={`/courses/${c.id}`}
            className="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <h2 className="font-semibold text-lg">{c.name}</h2>
            <p className="text-gray-500 text-sm mt-1">{c.semester}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
