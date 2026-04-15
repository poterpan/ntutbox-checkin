'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notSigned, setNotSigned] = useState<NotSigned[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  const [qrMode, setQrMode] = useState<'dynamic' | 'static'>('dynamic');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualType, setManualType] = useState<'manual' | 'leave'>('manual');
  const [manualLoading, setManualLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<Record<number, boolean>>({});
  const [quickActionLoading, setQuickActionLoading] = useState<Record<string, boolean>>({});
  const [hasRoster, setHasRoster] = useState(false);
  const [enrolledEmails, setEnrolledEmails] = useState<Set<string>>(new Set());
  const [courseName, setCourseName] = useState<string>('');
  const [classDate, setClassDate] = useState<string>('');
  const [dialog, setDialog] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null);

  const fetchList = useCallback(async () => {
    const res = await fetch(`/api/courses/${courseId}/sessions/${id}/list`);
    if (res.ok) {
      const data = await res.json() as {
        attendance: AttendanceRecord[];
        not_signed: NotSigned[];
        has_roster: boolean;
        enrolled_emails: string[];
        session: SessionInfo;
      };
      setAttendance(data.attendance);
      setNotSigned(data.not_signed);
      setHasRoster(data.has_roster);
      setEnrolledEmails(new Set(data.enrolled_emails));
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

  const handleDeleteSession = () => {
    setDialog({
      title: '刪除整個點名紀錄',
      message: `確定要刪除 ${classDate || id} 的點名紀錄？所有簽到資料將被永久刪除，此操作無法復原。`,
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/courses/${courseId}/sessions/${id}`, { method: 'DELETE' });
        if (res.ok) {
          router.push(`/courses/${courseId}`);
        } else {
          alert('刪除失敗');
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
          status: manualType,
        }),
      });
      if (res.ok) {
        setShowManualModal(false);
        setManualEmail('');
        setManualName('');
        setManualReason('');
        setManualType('manual');
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
    const labels: Record<string, string> = { on_time: '準時', late: '遲到', absent: '缺席', leave: '請假', manual: '補簽' };
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

  const handleManualCheckIn = (s: NotSigned) => {
    const displayName = s.name ?? s.student_id ?? s.email;
    setDialog({
      title: '手動打卡確認',
      message: `確定要將 ${displayName} 標記為「準時」？`,
      onConfirm: async () => {
        setQuickActionLoading((prev) => ({ ...prev, [s.email]: true }));
        try {
          const res = await fetch(`/api/courses/${courseId}/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: id,
              user_email: s.email,
              user_name: s.name ?? undefined,
              status: 'on_time',
            }),
          });
          if (res.ok) {
            await fetchList();
          } else {
            const data = await res.json() as { error?: string };
            alert('手動打卡失敗：' + (data.error ?? '未知錯誤'));
          }
        } finally {
          setQuickActionLoading((prev) => ({ ...prev, [s.email]: false }));
        }
      },
    });
  };

  const handleOpenLeaveModal = (s: NotSigned) => {
    setManualEmail(s.email);
    setManualName(s.name ?? '');
    setManualReason('');
    setManualType('leave');
    setShowManualModal(true);
  };

  const statusLabel = (s: string) => {
    switch (s) { case 'on_time': return '準時'; case 'late': return '遲到'; case 'absent': return '缺席'; case 'leave': return '請假'; case 'manual': return '補簽'; default: return s; }
  };
  const statusBadge = (s: string) => {
    switch (s) { case 'on_time': return 'badge badge-success'; case 'late': return 'badge badge-warning'; case 'absent': return 'badge badge-danger'; case 'leave': return 'badge badge-info'; case 'manual': return 'badge badge-info'; default: return 'badge badge-muted'; }
  };

  const isClosed = sessionStatus === 'closed';

  // Split attendance: absent goes into the "未簽到" section
  const signedAttendance = attendance.filter((r) => r.status !== 'absent');
  const absentAttendance = attendance.filter((r) => r.status === 'absent');

  // Stats
  const onTimeCount = attendance.filter((r) => r.status === 'on_time').length;
  const lateCount = attendance.filter((r) => r.status === 'late').length;
  const manualCount = attendance.filter((r) => r.status === 'manual').length;
  const leaveCount = attendance.filter((r) => r.status === 'leave').length;
  const absentOrNotSigned = absentAttendance.length + notSigned.length;
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

      {/* Expired session warning */}
      {classDate && !isClosed && classDate < new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) && (
        <div className="bg-warning-50 border border-warning-300 rounded-lg px-4 py-3 mb-4 text-sm text-warning-700">
          此場次已過上課日期（{classDate}），學生掃碼將無法簽到。建議關閉此場次。
        </div>
      )}

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
        <div className={`grid grid-cols-3 ${hasRoster ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} gap-3 text-center`}>
          {hasRoster && (
            <div className="bg-surface-muted rounded-lg px-3 py-2">
              <p className="text-2xl font-bold text-text-primary">{total}</p>
              <p className="text-xs text-text-muted">總人數</p>
            </div>
          )}
          <div className="bg-success-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-success-500">{onTimeCount}</p>
            <p className="text-xs text-text-muted">準時</p>
          </div>
          <div className="bg-warning-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-warning-500">{lateCount}</p>
            <p className="text-xs text-text-muted">遲到</p>
          </div>
          <div className="bg-info-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-info-500">{leaveCount}</p>
            <p className="text-xs text-text-muted">請假</p>
          </div>
          <div className="bg-info-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-info-500">{manualCount}</p>
            <p className="text-xs text-text-muted">補簽</p>
          </div>
          <div className="bg-danger-50 rounded-lg px-3 py-2">
            <p className="text-2xl font-bold text-danger-500">{absentOrNotSigned}</p>
            <p className="text-xs text-text-muted">缺席</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Primary actions */}
        {isClosed ? (
          <span className="btn btn-primary btn-sm opacity-50 pointer-events-none">投影頁</span>
        ) : (
          <a href={`/courses/${courseId}/sessions/${id}/projector`} target="_blank"
            className="btn btn-primary btn-sm">
            投影頁
          </a>
        )}
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
        {!isClosed && qrMode === 'static' && (
          <a href={`/courses/${courseId}/sessions/${id}/projector`} target="_blank"
            className="btn btn-secondary btn-sm">
            列印 QR Code
          </a>
        )}

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
          <button onClick={handleDeleteSession} className="btn btn-ghost btn-sm text-danger-500 hover:bg-danger-50">
            刪除
          </button>
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
            {signedAttendance.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text-primary">{r.user_name ?? '-'}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {r.user_email}
                    {hasRoster && !enrolledEmails.has(r.user_email) && (
                      <span className="ml-1.5 text-[10px] font-medium text-warning-600 bg-warning-50 px-1.5 py-0.5 rounded">非名冊</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(r.scan_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}
                    {r.is_manual ? <span className="ml-1.5 text-[10px] font-medium text-info-500 bg-info-50 px-1.5 py-0.5 rounded">手動</span> : null}
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
                        <option value="leave">請假</option>
                        <option value="manual">補簽</option>
                      </select>
                      <button
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className="btn btn-ghost btn-sm !min-h-0 !p-1"
                        title="查看裝置資訊"
                      >
                        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(r.id, r.user_email)}
                        className="btn btn-ghost btn-sm !min-h-0 !p-1 text-danger-500 hover:bg-danger-50"
                        title="刪除此紀錄"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
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
            {signedAttendance.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">尚無簽到紀錄</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Absent + not signed section */}
      {absentOrNotSigned > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-danger-500">缺席 / 未簽到</h2>
            <span className="badge badge-danger">{absentOrNotSigned}</span>
          </div>
          <div className="card border-danger-100">
            <table className="w-full text-sm">
              <thead className="bg-danger-50 border-b border-danger-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">姓名</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">狀態</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {absentAttendance.map((r) => (
                  <tr key={r.user_email} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text-primary">{r.user_name ?? '-'}</td>
                    <td className="px-4 py-3 text-text-muted">{r.user_email}</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-danger">缺席</span>
                      <span className="ml-1.5 text-xs text-text-muted">
                        掃碼 {new Date(r.scan_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status}
                        disabled={editingStatus[r.id]}
                        onChange={(e) => handleStatusChange(r.id, e.target.value)}
                        className="border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                      >
                        <option value="on_time">準時</option>
                        <option value="late">遲到</option>
                        <option value="absent">缺席</option>
                        <option value="leave">請假</option>
                        <option value="manual">補簽</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {notSigned.map((s) => {
                  const loading = !!quickActionLoading[s.email];
                  return (
                    <tr key={s.email} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-text-primary">{s.name ?? s.student_id ?? '-'}</td>
                      <td className="px-4 py-3 text-text-muted">{s.email}</td>
                      <td className="px-4 py-3"><span className="badge badge-muted">未簽到</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleManualCheckIn(s)}
                            disabled={loading}
                            className="btn btn-primary btn-sm disabled:opacity-50"
                          >
                            手動打卡
                          </button>
                          <button
                            onClick={() => handleOpenLeaveModal(s)}
                            disabled={loading}
                            className="btn btn-secondary btn-sm disabled:opacity-50"
                          >
                            請假
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
            <h2 className="text-lg font-bold text-text-primary mb-4">
              {manualType === 'leave' ? '登記請假' : '手動補簽'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">類型</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setManualType('manual')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${manualType === 'manual' ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-text-secondary border-border hover:bg-surface-dim'}`}
                  >
                    補簽
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualType('leave')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${manualType === 'leave' ? 'bg-info-500 text-white border-info-500' : 'bg-white text-text-secondary border-border hover:bg-surface-dim'}`}
                  >
                    請假
                  </button>
                </div>
              </div>
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
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {manualType === 'leave' ? '請假事由' : '補簽原因'}
                </label>
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
                {manualLoading ? '送出中...' : manualType === 'leave' ? '確認請假' : '確認補簽'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
