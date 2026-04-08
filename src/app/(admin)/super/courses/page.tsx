'use client';

import { useState } from 'react';

export default function SuperCoursesPage() {
  const [form, setForm] = useState({
    id: '', name: '', semester: '', default_class_start: '13:10',
    default_early_open_min: 30, default_late_cutoff_min: 10, default_weekday: 3,
  });
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/super/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setMessage(`課程 ${form.id} 建立成功`);
    } else {
      const err = await res.json() as { error?: string };
      setMessage(`失敗: ${err.error}`);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">建立新課程</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">課程代碼</label>
          <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })}
            className="w-full border rounded px-3 py-2" placeholder="iai-seminar-2026s" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">課程名稱</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded px-3 py-2" placeholder="創新AI碩士班 專題討論" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">學期</label>
          <input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}
            className="w-full border rounded px-3 py-2" placeholder="2026-spring" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">預設上課時間</label>
            <input value={form.default_class_start} onChange={(e) => setForm({ ...form, default_class_start: e.target.value })}
              className="w-full border rounded px-3 py-2" placeholder="13:10" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">星期幾 (0=日)</label>
            <input type="number" value={form.default_weekday} onChange={(e) => setForm({ ...form, default_weekday: Number(e.target.value) })}
              className="w-full border rounded px-3 py-2" min={0} max={6} />
          </div>
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">建立課程</button>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </form>
    </div>
  );
}
