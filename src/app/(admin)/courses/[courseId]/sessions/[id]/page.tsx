'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

type AttendanceRecord = {
  id: number; user_email: string; user_name: string | null;
  scan_time: number; status: string; is_manual: number;
  fingerprint_hash: string | null; fingerprint_raw: string | null;
  ip: string | null; user_agent: string | null; reaction_ms: number | null;
};
type NotSigned = { email: string; student_id: string | null; name: string | null };
type SessionInfo = { status: string; qr_mode: string } | null;

export default function SessionViewPage() {
  const { courseId, id } = useParams<{ courseId: string; id: string }>();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notSigned, setNotSigned] = useState<NotSigned[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  const [qrMode, setQrMode] = useState<'dynamic' | 'static'>('dynamic');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<Record<number, boolean>>({});

  const fetchList = useCallback(async () => {
    const res = await fetch(`/api/courses/${courseId}/sessions/${id}/list`);
    if (res.ok) {
      const data = await res.json() as {
        attendance: AttendanceRecord[];
        not_signed: NotSigned[];
        session: SessionInfo;
      };
      setAttendance(data.attendance);
      setNotSigned(data.not_signed);
      if (data.session) {
        setSessionStatus(data.session.status ?? 'active');
        setQrMode((data.session.qr_mode as 'dynamic' | 'static') ?? 'dynamic');
      }
    }
  }, [courseId, id]);

  useEffect(() => {
    fetchList();
    const timer = setInterval(fetchList, 5000);
    return () => clearInterval(timer);
  }, [fetchList]);

  const handleCloseSession = async () => {
    if (!confirm('確定要結束此簽到？結束後學生將無法再掃碼簽到。')) return;
    const res = await fetch(`/api/courses/${courseId}/sessions/${id}/close`, { method: 'POST' });
    if (res.ok) {
      setSessionStatus('closed');
    }
  };

  const handleToggleQrMode = async () => {
    const newMode = qrMode === 'dynamic' ? 'static' : 'dynamic';
    const res = await fetch(`/api/courses/${courseId}/sessions/${id}/qr-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode }),
    });
    if (res.ok) {
      setQrMode(newMode);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualEmail.trim()) return;
    setManualLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: id,
          user_email: manualEmail.trim(),
          user_name: manualName.trim() || undefined,
          reason: manualReason.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowManualModal(false);
        setManualEmail('');
        setManualName('');
        setManualReason('');
        fetchList();
      } else {
        const data = await res.json() as { error?: string };
        if (data.error === 'already_signed') {
          alert('該學生已經簽到過了');
        } else {
          alert('補簽失敗：' + (data.error ?? '未知錯誤'));
        }
      }
    } finally {
      setManualLoading(false);
    }
  };

  const handleStatusChange = async (recordId: number, newStatus: string) => {
    setEditingStatus((prev) => ({ ...prev, [recordId]: true }));
    try {
      const res = await fetch(`/api/courses/${courseId}/attendance/${recordId}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchList();
      } else {
        const data = await res.json() as { error?: string };
        alert('修改失敗：' + (data.error ?? '未知錯誤'));
      }
    } finally {
      setEditingStatus((prev) => ({ ...prev, [recordId]: false }));
    }
  };

  const statusLabel = (s: string) => {
    switch (s) { case 'on_time': return '準時'; case 'late': return '遲到'; case 'absent': return '缺席'; case 'manual': return '補簽'; default: return s; }
  };
  const statusColor = (s: string) => {
    switch (s) { case 'on_time': return 'text-green-600'; case 'late': return 'text-yellow-600'; case 'absent': return 'text-red-600'; case 'manual': return 'text-blue-600'; default: return 'text-gray-600'; }
  };

  const isClosed = sessionStatus === 'closed';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">即時簽到名單</h1>
        <div className="flex gap-3 flex-wrap">
          <a href={`/courses/${courseId}/sessions/${id}/projector`} target="_blank"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm">
            開啟投影頁
          </a>
          <a href={`/api/courses/${courseId}/sessions/${id}/export`}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm">
            匯出 CSV
          </a>
          <button
            onClick={() => setShowManualModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
          >
            手動補簽
          </button>
          <button
            onClick={handleToggleQrMode}
            disabled={isClosed}
            className={`px-4 py-2 rounded-lg text-sm text-white ${
              isClosed
                ? 'bg-gray-400 cursor-not-allowed'
                : qrMode === 'dynamic'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {qrMode === 'dynamic' ? '切換靜態 QR' : '切換動態 QR'}
          </button>
          <button
            onClick={handleCloseSession}
            disabled={isClosed}
            className={`px-4 py-2 rounded-lg text-sm text-white ${
              isClosed
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isClosed ? '已結束' : '結束簽到'}
          </button>
        </div>
      </div>

      <div className="mb-2 text-sm text-gray-500">
        已簽到 {attendance.length} 人 / 未簽到 {notSigned.length} 人
        {isClosed && <span className="ml-2 text-red-500 font-medium">（簽到已結束）</span>}
        {qrMode === 'static' && !isClosed && <span className="ml-2 text-teal-600 font-medium">（靜態 QR 模式）</span>}
      </div>

      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3">姓名</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">掃碼時間</th>
              <th className="text-left px-4 py-3">狀態</th>
              <th className="text-left px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((r) => (
              <>
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{r.user_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.user_email}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(r.scan_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}
                  </td>
                  <td className={`px-4 py-3 font-medium ${statusColor(r.status)}`}>{statusLabel(r.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={r.status}
                        disabled={editingStatus[r.id]}
                        onChange={(e) => handleStatusChange(r.id, e.target.value)}
                        className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="on_time">準時</option>
                        <option value="late">遲到</option>
                        <option value="absent">缺席</option>
                        <option value="manual">補簽</option>
                      </select>
                      <button
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100"
                        title="查看裝置資訊"
                      >
                        {expandedId === r.id ? '收起' : '裝置'}
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr key={`${r.id}-detail`} className="bg-gray-50">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="font-medium text-gray-700">Fingerprint Hash:</span>{' '}
                          <span className="text-gray-500 font-mono">{r.fingerprint_hash ?? '-'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">IP:</span>{' '}
                          <span className="text-gray-500 font-mono">{r.ip ?? '-'}</span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-medium text-gray-700">User Agent:</span>{' '}
                          <span className="text-gray-500 break-all">{r.user_agent ?? '-'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Reaction Time:</span>{' '}
                          <span className="text-gray-500">{r.reaction_ms != null ? `${r.reaction_ms} ms` : '-'}</span>
                        </div>
                        {r.fingerprint_raw && (
                          <div className="md:col-span-2">
                            <details>
                              <summary className="font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                                Raw Fingerprint Components (JSON)
                              </summary>
                              <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
                                {(() => {
                                  try { return JSON.stringify(JSON.parse(r.fingerprint_raw as string), null, 2); }
                                  catch { return r.fingerprint_raw; }
                                })()}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
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

      {/* Manual Check-in Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">手動補簽</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="student@ntut.edu.tw"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="選填"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">補簽原因</label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="選填"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={manualLoading || !manualEmail.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {manualLoading ? '送出中...' : '確認補簽'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
