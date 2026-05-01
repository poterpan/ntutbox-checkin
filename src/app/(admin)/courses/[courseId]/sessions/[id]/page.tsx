'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/confirm-dialog';
import AttendanceGroup, { type AttendanceRecord } from './_components/AttendanceGroup';
import AbsentGroup, { type NotSigned } from './_components/AbsentGroup';

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
  const [manualOfficial, setManualOfficial] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<Record<number, boolean>>({});
  const [quickActionLoading, setQuickActionLoading] = useState<Record<string, boolean>>({});
  const [hasRoster, setHasRoster] = useState(false);
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
        session: SessionInfo;
      };
      setAttendance(data.attendance);
      setNotSigned(data.not_signed);
      setHasRoster(data.has_roster);
      if (data.session) {
        setSessionStatus(data.session.status ?? 'active');
        setQrMode((data.session.qr_mode as 'dynamic' | 'static') ?? 'dynamic');
      }
    }
  }, [courseId, id]);

  useEffect(() => {
    fetchList();
    const timer = setInterval(fetchList, 10000);

    fetch('/api/courses')
      .then((r) => r.json() as Promise<{ courses?: { id: string; name: string }[] }>)
      .then((data) => {
        const c = data.courses?.find((c) => c.id === courseId);
        if (c) setCourseName(c.name);
      });

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
        if (res.ok) setSessionStatus('closed');
      },
    });
  };

  const handleReopenSession = () => {
    setDialog({
      title: '重新開啟簽到',
      message: '確定要重新開啟此簽到？開啟後學生將可以再次掃碼簽到。',
      onConfirm: async () => {
        const res = await fetch(`/api/courses/${courseId}/sessions/${id}/reopen`, { method: 'POST' });
        if (res.ok) setSessionStatus('open');
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
    if (res.ok) setQrMode(newMode);
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
          is_official_leave: manualType === 'leave' ? manualOfficial : undefined,
        }),
      });
      if (res.ok) {
        setShowManualModal(false);
        resetManualForm();
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
    setManualOfficial(false);
    setShowManualModal(true);
  };

  const resetManualForm = () => {
    setManualEmail('');
    setManualName('');
    setManualReason('');
    setManualType('manual');
    setManualOfficial(false);
  };

  const isClosed = sessionStatus === 'closed';

  // Group rows by status
  const lateRows = attendance.filter((r) => r.status === 'late');
  const leaveRows = attendance.filter((r) => r.status === 'leave');
  const manualRows = attendance.filter((r) => r.status === 'manual');
  const absentRows = attendance.filter((r) => r.status === 'absent');
  const onTimeRows = attendance.filter((r) => r.status === 'on_time');
  const attentionTotal =
    lateRows.length + leaveRows.length + manualRows.length
    + absentRows.length + notSigned.length;

  // Stats
  const onTimeCount = onTimeRows.length;
  const lateCount = lateRows.length;
  const manualCount = manualRows.length;
  const leaveCount = leaveRows.length;
  const absentOrNotSigned = absentRows.length + notSigned.length;
  const total = attendance.length + notSigned.length;

  const groupProps = {
    hasRoster,
    expandedId,
    setExpandedId,
    editingStatus,
    onStatusChange: handleStatusChange,
    onDelete: handleDeleteRecord,
  };

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
        {isClosed ? (
          <span className="btn btn-primary btn-sm opacity-50 pointer-events-none">投影頁</span>
        ) : (
          <a href={`/courses/${courseId}/sessions/${id}/projector`} target="_blank" className="btn btn-primary btn-sm">
            投影頁
          </a>
        )}
        <button onClick={() => { resetManualForm(); setShowManualModal(true); }} className="btn btn-primary btn-sm">
          手動修改
        </button>

        <a href={`/api/courses/${courseId}/sessions/${id}/export`} className="btn btn-secondary btn-sm">
          匯出 CSV
        </a>
        <button onClick={handleToggleQrMode} disabled={isClosed} className="btn btn-secondary btn-sm">
          {qrMode === 'dynamic' ? '切換靜態 QR' : '切換動態 QR'}
        </button>
        {!isClosed && qrMode === 'static' && (
          <a href={`/courses/${courseId}/sessions/${id}/projector`} target="_blank" className="btn btn-secondary btn-sm">
            列印 QR Code
          </a>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isClosed ? (
            <button onClick={handleReopenSession} className="btn btn-primary btn-sm">重新開啟</button>
          ) : (
            <button onClick={handleCloseSession} className="btn btn-danger btn-sm">結束簽到</button>
          )}
          <button onClick={handleDeleteSession} className="btn btn-ghost btn-sm text-danger-500 hover:bg-danger-50">
            刪除
          </button>
        </div>
      </div>

      {/* Needs attention */}
      {attentionTotal > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-danger-500">需要關注</h2>
            <span className="badge badge-danger">{attentionTotal}</span>
          </div>

          {lateRows.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-warning-600">遲到</h3>
                <span className="badge badge-warning">{lateRows.length}</span>
              </div>
              <div className="card">
                <AttendanceGroup rows={lateRows} {...groupProps} />
              </div>
            </div>
          )}

          {leaveRows.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-info-600">請假</h3>
                <span className="badge badge-info">{leaveRows.length}</span>
              </div>
              <div className="card">
                <AttendanceGroup rows={leaveRows} {...groupProps} />
              </div>
            </div>
          )}

          {manualRows.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-info-600">補簽</h3>
                <span className="badge badge-info">{manualRows.length}</span>
              </div>
              <div className="card">
                <AttendanceGroup rows={manualRows} {...groupProps} />
              </div>
            </div>
          )}

          {(absentRows.length + notSigned.length) > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-danger-600">缺席 / 未簽到</h3>
                <span className="badge badge-danger">{absentRows.length + notSigned.length}</span>
              </div>
              <div className="card border-danger-100">
                <AbsentGroup
                  absent={absentRows}
                  notSigned={notSigned}
                  editingStatus={editingStatus}
                  quickActionLoading={quickActionLoading}
                  onStatusChange={handleStatusChange}
                  onManualCheckIn={handleManualCheckIn}
                  onOpenLeaveModal={handleOpenLeaveModal}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* On-time (collapsed by default; auto-open when there's nothing in attention) */}
      <details open={attentionTotal === 0} className="card mb-6">
        <summary className="cursor-pointer px-4 py-3 font-semibold text-success-600 hover:bg-surface-muted">
          準時 ({onTimeRows.length})
        </summary>
        {onTimeRows.length > 0 ? (
          <AttendanceGroup rows={onTimeRows} {...groupProps} />
        ) : (
          <div className="px-4 py-6 text-center text-text-muted text-sm">尚無準時簽到紀錄</div>
        )}
      </details>

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
              {manualType === 'leave' ? '登記請假' : '手動修改'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">類型</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setManualType('manual'); setManualOfficial(false); }}
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
              {manualType === 'leave' && (
                <div>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={manualOfficial}
                      onChange={(e) => setManualOfficial(e.target.checked)}
                    />
                    公假（不影響出席率）
                  </label>
                </div>
              )}
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
