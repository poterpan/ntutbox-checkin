'use client';

import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import { REGULAR_PRESET, ALL_DAY_PRESET, type CourseTimingDefaults } from '@/lib/course-presets';

type CourseForm = CourseTimingDefaults & {
  id: string;
  name: string;
  semester: string;
  // '' means "no fixed weekday" -> stored as NULL, so /projector never
  // auto-prompts this course. Ad-hoc event courses want this.
  default_weekday: number | '';
};

const blankForm = (): CourseForm => ({
  id: '', name: '', semester: '', default_weekday: 3, ...REGULAR_PRESET,
});

type Course = { id: string; name: string; semester: string; status: string };

export default function SuperCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<CourseForm>(blankForm);
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null);

  const fetchCourses = () => {
    fetch('/api/courses')
      .then((r) => r.json() as Promise<{ courses?: Course[] }>)
      .then((data) => setCourses(data.courses ?? []));
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/super/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        default_weekday: form.default_weekday === '' ? null : form.default_weekday,
      }),
    });
    if (res.ok) {
      setMessage(`課程 ${form.id} 建立成功`);
      setForm(blankForm());
      fetchCourses();
    } else {
      const err = await res.json() as { error?: string };
      setMessage(`失敗: ${err.error}`);
    }
  };

  const handleDelete = (courseId: string, courseName: string) => {
    setDialog({
      title: '刪除課程',
      message: `確定要刪除課程「${courseName}」？\n\n此操作將永久刪除該課程的所有簽到紀錄、場次、助教與學生名單，且無法復原。`,
      danger: true,
      onConfirm: async () => {
        setDeleting(courseId);
        const res = await fetch('/api/super/courses', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: courseId }),
        });
        setDeleting(null);
        if (res.ok) {
          fetchCourses();
        } else {
          alert('刪除失敗');
        }
      },
    });
  };

  return (
    <div>
      <nav className="text-sm text-text-muted mb-4">
        <a href="/dashboard" className="hover:text-brand-500">我的課程</a>
        <span className="mx-2">/</span>
        <span className="text-text-primary">課程管理</span>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary mb-6">課程管理</h1>

      {/* Existing courses */}
      {courses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-3">現有課程</h2>
          <div className="space-y-2">
            {courses.map((c) => (
              <div key={c.id} className="card px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-text-primary">{c.name}</span>
                  <span className="text-text-muted text-sm ml-3">{c.semester}</span>
                  <span className="text-text-muted text-xs ml-2">({c.id})</span>
                </div>
                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  disabled={deleting === c.id}
                  className="btn btn-danger btn-sm"
                >
                  {deleting === c.id ? '刪除中...' : '刪除'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      <h2 className="text-lg font-semibold text-text-primary mb-3">建立新課程</h2>
      <form onSubmit={handleSubmit} className="card p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">課程代碼</label>
          <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })}
            placeholder="iai-seminar-2026s" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">課程名稱</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="創新AI碩士班 專題討論" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">學期</label>
          <input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}
            placeholder="2026-spring" required />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-secondary">簽到時間預設：</span>
          <button type="button" onClick={() => setForm({ ...form, ...REGULAR_PRESET })}
            className="btn btn-ghost btn-sm">一般課程</button>
          <button type="button" onClick={() => setForm({ ...form, ...ALL_DAY_PRESET, default_weekday: '' })}
            className="btn btn-ghost btn-sm">全天簽到</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">預設上課時間</label>
            <input value={form.default_class_start} onChange={(e) => setForm({ ...form, default_class_start: e.target.value })}
              placeholder="13:10" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">星期幾 (0=日，留空=不固定)</label>
            <input type="number" value={form.default_weekday}
              onChange={(e) => setForm({ ...form, default_weekday: e.target.value === '' ? '' : Number(e.target.value) })}
              min={0} max={6} placeholder="不固定" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">提前開放 (分鐘)</label>
            <input type="number" value={form.default_early_open_min}
              onChange={(e) => setForm({ ...form, default_early_open_min: Number(e.target.value) })}
              min={0} max={1440} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">遲到容許 (分鐘)</label>
            <input type="number" value={form.default_late_cutoff_min}
              onChange={(e) => setForm({ ...form, default_late_cutoff_min: Number(e.target.value) })}
              min={0} max={1440} required />
          </div>
        </div>
        <p className="text-xs text-text-muted">
          掃碼可用區間 = 上課時間 −{form.default_early_open_min || 0} 分 ～ +{form.default_late_cutoff_min || 0} 分；
          上課時間之前掃算準時、之後算遲到、超過容許算缺席。
        </p>
        <button type="submit" className="btn btn-primary">建立課程</button>
        {message && <p className="mt-3 text-sm text-text-secondary">{message}</p>}
      </form>

      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        danger={dialog?.danger}
        onConfirm={() => { dialog?.onConfirm(); setDialog(null); }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
