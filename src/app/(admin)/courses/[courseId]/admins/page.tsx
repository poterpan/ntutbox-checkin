'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

type Admin = {
  email: string;
  name: string | null;
  role: string;
  added_at: number;
  added_by: string | null;
};

export default function AdminsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('ta');
  const [submitting, setSubmitting] = useState(false);

  const fetchAdmins = useCallback(() => {
    fetch(`/api/courses/${courseId}/admins`)
      .then((r) => r.json() as Promise<{ admins?: Admin[] }>)
      .then((data) => {
        setAdmins(data.admins ?? []);
        setLoading(false);
      });
  }, [courseId]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/courses/${courseId}/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, role }),
    });
    if (res.ok) {
      setEmail('');
      setName('');
      setRole('ta');
      fetchAdmins();
    } else {
      const err = (await res.json()) as { error?: string };
      if (err.error === 'already_exists') {
        alert('此 Email 已是管理員');
      } else if (err.error === 'forbidden') {
        alert('權限不足，僅授課教師可新增管理員');
      } else {
        alert('新增失敗');
      }
    }
    setSubmitting(false);
  };

  const removeAdmin = async (adminEmail: string) => {
    if (!confirm(`確定要移除 ${adminEmail}？`)) return;
    const res = await fetch(`/api/courses/${courseId}/admins`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail }),
    });
    if (res.ok) {
      fetchAdmins();
    } else {
      const err = (await res.json()) as { error?: string };
      if (err.error === 'forbidden') {
        alert('權限不足，僅授課教師可移除管理員');
      } else {
        alert('移除失敗');
      }
    }
  };

  if (loading) return <p className="text-gray-500">載入中...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">助教管理</h1>

      <form onSubmit={addAdmin} className="mb-6 p-4 bg-white rounded-lg shadow-sm border space-y-3">
        <h2 className="font-semibold">新增管理員</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
          />
          <input
            type="text"
            placeholder="姓名（選填）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-40"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="ta">助教 (TA)</option>
            <option value="instructor">授課教師</option>
            <option value="owner">擁有者</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '新增中...' : '新增'}
          </button>
        </div>
      </form>

      {admins.length === 0 ? (
        <p className="text-gray-500">尚無管理員</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">姓名</th>
              <th className="text-left px-4 py-2">角色</th>
              <th className="text-left px-4 py-2">新增時間</th>
              <th className="text-left px-4 py-2">操作</th>
            </tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.email} className="border-t">
                  <td className="px-4 py-2">{a.email}</td>
                  <td className="px-4 py-2">{a.name ?? '-'}</td>
                  <td className="px-4 py-2">{a.role}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {a.added_at ? new Date(a.added_at).toLocaleString('zh-TW') : '-'}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeAdmin(a.email)}
                      className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                    >移除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
