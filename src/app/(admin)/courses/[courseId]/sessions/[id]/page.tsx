'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ConfirmDialog from '@/components/confirm-dialog';

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
  const [courseName, setCourseName] = useState<string>('');
  const [classDate, setClassDate] = useState<string>('');
  const [dialog, setDialog] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null);

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

    // Fetch course name for breadcrumb
    fetch('/api/courses')
      .then((r) => r.json() as Promise<{ courses?: { id: string; name: string }[] }>)
      .then((data) => {
        const c = data.courses?.find((c) => c.id === courseId);
        if (c) setCourseName(c.name);
      });

    // Fetch session date
    fetch(`/api/courses/${courseId}/sessions/create`)
      .then((r) => r.json() as Promise<{ sessions?: { id: string; class_date: string }[] }>)
      .then((data) => {
        const s = data.sessions?.find((s) => s.id === id);
        if (s) setClassDate(s.class_date);
      });

    return () => clearInterval(timer);
  }, [fetchList, courseId, id]);

  const handleCloseSession = () => {
    setDialog({
      title: '結束簽到',
      message: '確定要結束此簽到？結束後學生將無法再掃碼簽到。',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/courses/${courseId}/sessions/${id}/close`, { method: 'POST' });
        if (res.ok) {
          setSessionStatus('closed');
        }
      },
    });
  };

  const handleReopenSession = () => {
    setDialog({
      title: '重新開啟簽到',
      message: '確定要重新開啟此簽到？開啟後學生將可以再次掃碼簽到。',
      onConfirm: async () => {
        const res = await fetch(`/api/courses/${courseId}/sessions/${id}/reopen`, { method: 'POST' });
        if (res.ok) {
          setSessionStatus('open');
        }
      },
    });
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

  const handleStatusChange = (recordId: number, newStatus: string) => {
    const labels: Record<string, string> = { on_time: '準時', late: '遲到', absent: '缺席', manual: '補簽' };
    setDialog({
      title: '修改簽到狀態',
      message: `確定要將此紀錄改為「${labels[newStatus] ?? newStatus}」？`,
      onConfirm: async () => {
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
      },
    });
  };

  const handleDeleteRecord = (recordId: number, email: string) => {
    setDialog({
      title: '刪除簽到紀錄',
      message: `確定要刪除 ${email} 的簽到紀錄？此操作無法復原。`,
      danger: true,
      onConfirm: async () => {
        await fetch(`/api/courses/${courseId}/attendance/${recordId}`, { method: 'DELETE' });
        await fetchList();
      },
    });
  };

  const statusLabel = (s: string) => {
    switch (s) { case 'on_time': return '準時'; case 'late': return '遲到'; case 'absent': return '缺席'; case 'manual': return '補簽'; default: return s; }
  };
  const statusBadge = (s: string) => {
    switch (s) { case 'on_time': return 'badge badge-success'; case 'late': return 'badge badge-warning'; case 'absent': return 'badge badge-danger'; case 'manual': return 'badge badge-info'; default: return 'badge badge-muted'; }
  };

  const isClosed = sessionStatus === 'closed';

  // Stats
  const onTimeCount = attendance.filter((r) => r.status === 'on_time').length;
  const lateCount = attendance.filter((r) => r.status === 'late').length;
  const absentCount = attendance.filter((r) => r.status === 'absent').length;
  const manualCount = attendance.filter((r) => r.status === 'manual').length;
  const total = attendance.length + notSigned.length;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-text-muted mb-4">
        <a href="/dashboard" className="hover:text-brand-500">我的課程</a>
        <span className="mx-2">/</span>
        <a href={`/courses/${courseId}`} className="hover:text-brand-500">{courseName || courseId}</a>
        <span className="mx-2">/</span>
        <span className="text-text-primary">{classDate || id}</span>
      </nav>

      {/* Stats summary bar */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-text-primary">即時簽到名單</h1>
          <div className="flex items-center gap-2">
            {isClosed && <span className="badge badge-danger">已結束</span>}
            {!isClosed && qrMode === 'static' && <span className="badge badge-info">靜態 QR</span>}
            {!isClosed && qrMode === 'dynamic' && <span className="badge badge-success">動態 QR</span>}
          </div>
        </div>

        {/* Colored stat segments */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="bg-surface-muted rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-text-primary">{total}</p>
            <p className="text-xs text-text-muted">總人數</p>
          </div>
          <div className="bg-success-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-success-500">{onTimeCount}</p>
            <p className="text-xs text-text-muted">準時</p>
          </div>
          <div className="bg-warning-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-warning-500">{lateCount}</p>
            <p className="text-xs text-text-muted">遲到</p>
          </div>
          <div className="bg-info-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-info-500">{manualCount}</p>
            <p className="text-xs text-text-muted">補簽</p>
          </div>
          <div className="bg-danger-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-danger-500">{notSigned.length}</p>
            <p className="text-xs text-text-muted">未簽到</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Primary actions */}
        <a href={`/courses/${courseId}/sessions/${id}/projector`} target="_blank"
          className="btn btn-primary btn-sm">
          投影頁
        </a>
        <button onClick={() => setShowManualModal(true)} className="btn btn-primary btn-sm">
          手動補簽
        </button>

        {/* Secondary actions */}
        <a href={`/api/courses/${courseId}/sessions/${id}/export`}
          className="btn btn-secondary btn-sm">
          匯出 CSV
        </a>
        <button onClick={handleToggleQrMode} disabled={isClosed} className="btn btn-secondary btn-sm">
          {qrMode === 'dynamic' ? '切換靜態 QR' : '切換動態 QR'}
        </button>

        {/* Danger / reopen action — right aligned */}
        <div className="ml-auto flex items-center gap-2">
          {isClosed ? (
            <button onClick={handleReopenSession} className="btn btn-primary btn-sm">
              重新開啟
            </button>
          ) : (
            <button onClick={handleCloseSession} className="btn btn-danger btn-sm">
              結束簽到
            </button>
          )}
        </div>
      </div>

      {/* Attendance table */}
      <div className="card mb-6">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">姓名</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Email</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">掃碼時間</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">狀態</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text-primary">{r.user_name ?? '-'}</td>
                  <td className="px-4 py-3 text-text-muted">{r.user_email}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(r.scan_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(r.status)}>{statusLabel(r.status)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={r.status}
                        disabled={editingStatus[r.id]}
                        onChange={(e) => handleStatusChange(r.id, e.target.value)}
                        className="border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                      >
                        <option value="on_time">準時</option>
                        <option value="late">遲到</option>
                        <option value="absent">缺席</option>
                        <option value="manual">補簽</option>
                      </select>
                      <button
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className="btn btn-ghost btn-sm !min-h-0 !py-1 !px-2 text-xs"
                        title="查看裝置資訊"
                      >
                        {expandedId === r.id ? '收起' : '裝置'}
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(r.id, r.user_email)}
                        className="btn btn-ghost btn-sm !min-h-0 !py-1 !px-2 text-xs text-danger-500 hover:bg-danger-50"
                        title="刪除此紀錄"
                      >
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr className="bg-surface-muted">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="font-medium text-text-secondary">Fingerprint Hash:</span>{' '}
                          <span className="text-text-muted font-mono">{r.fingerprint_hash ?? '-'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-text-secondary">IP:</span>{' '}
                          <span className="text-text-muted font-mono">{r.ip ?? '-'}</span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-medium text-text-secondary">User Agent:</span>{' '}
                          <span className="text-text-muted break-all">{r.user_agent ?? '-'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-text-secondary">Reaction Time:</span>{' '}
                          <span className="text-text-muted">{r.reaction_ms != null ? `${r.reaction_ms} ms` : '-'}</span>
                        </div>
                        {r.fingerprint_raw && (
                          <div className="md:col-span-2">
                            <details>
                              <summary className="font-medium text-text-secondary cursor-pointer hover:text-text-primary">
                                Raw Fingerprint Components (JSON)
                              </summary>
                              <pre className="mt-2 p-3 bg-surface-dim rounded text-xs overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
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
              </Fragment>
            ))}
            {attendance.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">尚無簽到紀錄</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Not signed section */}
      {notSigned.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-danger-500">未簽到</h2>
            <span className="badge badge-danger">{notSigned.length}</span>
          </div>
          <div className="card border-danger-100">
            <table className="w-full text-sm">
              <thead className="bg-danger-50 border-b border-danger-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">學號</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">姓名</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Email</th>
                </tr>
              </thead>
              <tbody>
                {notSigned.map((s) => (
                  <tr key={s.email} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text-primary">{s.student_id ?? '-'}</td>
                    <td className="px-4 py-3 text-text-primary">{s.name ?? '-'}</td>
                    <td className="px-4 py-3 text-text-muted">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        danger={dialog?.danger}
        onConfirm={() => { dialog?.onConfirm(); setDialog(null); }}
        onCancel={() => setDialog(null)}
      />

      {/* Manual Check-in Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card p-6 w-full max-w-md mx-4 shadow-lg">
            <h2 className="text-lg font-bold text-text-primary mb-4">手動補簽</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Email <span className="text-danger-500">*</span>
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="student@ntut.edu.tw"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">姓名</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="選填"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">補簽原因</label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="選填"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowManualModal(false)} className="btn btn-ghost btn-sm">
                取消
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={manualLoading || !manualEmail.trim()}
                className="btn btn-primary btn-sm"
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
