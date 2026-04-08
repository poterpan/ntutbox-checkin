'use client';

import { useEffect, useState } from 'react';

type Course = {
  id: string; name: string; semester: string;
  default_class_start: string; default_weekday: number | null;
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-text-muted">載入中...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">我的課程</h1>
        {isSuper && (
          <a href="/super/courses" className="btn btn-primary btn-sm">+ 新增課程</a>
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
    </div>
  );
}
