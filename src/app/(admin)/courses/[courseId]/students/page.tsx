'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function StudentsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [message, setMessage] = useState('');

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const csv = form.get('csv') as string;
    if (!csv.trim()) return;

    const lines = csv.trim().split('\n').slice(1);
    const students = lines.map((line) => {
      const [student_id, name, email] = line.split(',').map((s) => s.trim());
      return { student_id, name, email };
    }).filter((s) => s.email);

    const res = await fetch(`/api/courses/${courseId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students }),
    });

    if (res.ok) {
      setMessage(`成功匯入 ${students.length} 位學生`);
    } else {
      setMessage('匯入失敗');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">修課名單管理</h1>
      <form onSubmit={handleUpload} className="bg-white rounded-lg shadow-sm border p-6">
        <label className="block mb-2 font-medium">貼上 CSV（格式：學號,姓名,Email）</label>
        <textarea name="csv" rows={10} className="w-full border rounded-lg p-3 font-mono text-sm"
          placeholder={"學號,姓名,Email\n110590001,王小明,t110590001@ntut.org.tw"} />
        <button type="submit" className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">匯入</button>
        {message && <p className="mt-3 text-green-600">{message}</p>}
      </form>
    </div>
  );
}
