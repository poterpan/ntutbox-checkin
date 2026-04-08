'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type AttendanceRecord = {
  id: number; user_email: string; user_name: string | null;
  scan_time: number; status: string; is_manual: number;
};
type NotSigned = { email: string; student_id: string | null; name: string | null };

export default function SessionViewPage() {
  const { courseId, id } = useParams<{ courseId: string; id: string }>();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notSigned, setNotSigned] = useState<NotSigned[]>([]);

  const fetchList = async () => {
    const res = await fetch(`/api/courses/${courseId}/sessions/${id}/list`);
    if (res.ok) {
      const data = await res.json();
      setAttendance(data.attendance);
      setNotSigned(data.not_signed);
    }
  };

  useEffect(() => {
    fetchList();
    const timer = setInterval(fetchList, 5000);
    return () => clearInterval(timer);
  }, [courseId, id]);

  const statusLabel = (s: string) => {
    switch (s) { case 'on_time': return '準時'; case 'late': return '遲到'; case 'absent': return '缺席'; case 'manual': return '補簽'; default: return s; }
  };
  const statusColor = (s: string) => {
    switch (s) { case 'on_time': return 'text-green-600'; case 'late': return 'text-yellow-600'; case 'absent': return 'text-red-600'; case 'manual': return 'text-blue-600'; default: return 'text-gray-600'; }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">即時簽到名單</h1>
        <div className="flex gap-3">
          <a href={`/courses/${courseId}/sessions/${id}/projector`} target="_blank"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm">開啟投影頁</a>
          <a href={`/api/courses/${courseId}/sessions/${id}/export`}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm">匯出 CSV</a>
        </div>
      </div>

      <div className="mb-2 text-sm text-gray-500">
        已簽到 {attendance.length} 人 / 未簽到 {notSigned.length} 人
      </div>

      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3">姓名</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">掃碼時間</th>
              <th className="text-left px-4 py-3">狀態</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3">{r.user_name ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{r.user_email}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(r.scan_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}
                </td>
                <td className={`px-4 py-3 font-medium ${statusColor(r.status)}`}>{statusLabel(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notSigned.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-red-600">未簽到</h2>
          <div className="bg-white rounded-lg shadow-sm border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3">學號</th>
                  <th className="text-left px-4 py-3">姓名</th>
                  <th className="text-left px-4 py-3">Email</th>
                </tr>
              </thead>
              <tbody>
                {notSigned.map((s) => (
                  <tr key={s.email} className="border-b last:border-0">
                    <td className="px-4 py-3">{s.student_id ?? '-'}</td>
                    <td className="px-4 py-3">{s.name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
