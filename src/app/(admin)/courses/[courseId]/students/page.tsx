'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface Student {
  email: string;
  student_id: string | null;
  name: string | null;
  added_at: number;
}

export default function StudentsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchStudents = useCallback(async () => {
    const res = await fetch(`/api/courses/${courseId}/students`);
    if (res.ok) {
      const data = (await res.json()) as { students: Student[] };
      setStudents(data.students);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const csv = form.get('csv') as string;
    if (!csv.trim()) return;

    const lines = csv.trim().split('\n').slice(1);
    const parsed = lines.map((line) => {
      const [student_id, name, email] = line.split(',').map((s) => s.trim());
      return { student_id, name, email };
    }).filter((s) => s.email);

    const res = await fetch(`/api/courses/${courseId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: parsed }),
    });

    if (res.ok) {
      setMessage(`成功匯入 ${parsed.length} 位學生`);
      setShowForm(false);
      fetchStudents();
    } else {
      setMessage('匯入失敗');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">修課名單管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-600"
        >
          {showForm ? '取消' : '匯入 CSV'}
        </button>
      </div>

      {message && (
        <div className="bg-success-50 border border-success-500 text-success-600 rounded-lg p-3 mb-4 text-sm">
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleUpload} className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <label className="block mb-2 font-medium text-sm">貼上 CSV（格式：學號,姓名,Email）</label>
          <textarea name="csv" rows={8} className="w-full border rounded-lg p-3 font-mono text-sm"
            placeholder={"學號,姓名,Email\n110590001,王小明,t110590001@ntut.org.tw"} />
          <button type="submit" className="mt-3 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-600">
            匯入
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-text-muted">載入中...</p>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <p className="text-text-muted">尚未匯入學生名單</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-brand-500 text-sm hover:underline"
            >
              匯入 CSV
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-surface-muted">
            <span className="text-sm text-text-secondary">共 {students.length} 位學生</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-dim">
                <th className="px-4 py-2 text-left font-medium text-text-secondary">#</th>
                <th className="px-4 py-2 text-left font-medium text-text-secondary">學號</th>
                <th className="px-4 py-2 text-left font-medium text-text-secondary">姓名</th>
                <th className="px-4 py-2 text-left font-medium text-text-secondary">Email</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.email} className="border-b last:border-0 hover:bg-surface-dim/50">
                  <td className="px-4 py-2 text-text-muted">{i + 1}</td>
                  <td className="px-4 py-2 font-mono">{s.student_id ?? '-'}</td>
                  <td className="px-4 py-2">{s.name ?? '-'}</td>
                  <td className="px-4 py-2 text-text-secondary">{s.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
