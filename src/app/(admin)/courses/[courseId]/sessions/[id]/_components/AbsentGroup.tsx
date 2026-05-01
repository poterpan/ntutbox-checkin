'use client';

import type { AttendanceRecord } from './AttendanceGroup';

export type NotSigned = { email: string; student_id: string | null; name: string | null };

type Props = {
  absent: AttendanceRecord[];
  notSigned: NotSigned[];
  editingStatus: Record<number, boolean>;
  quickActionLoading: Record<string, boolean>;
  onStatusChange: (recordId: number, newStatus: string) => void;
  onManualCheckIn: (s: NotSigned) => void;
  onOpenLeaveModal: (s: NotSigned) => void;
};

export default function AbsentGroup({
  absent, notSigned, editingStatus, quickActionLoading,
  onStatusChange, onManualCheckIn, onOpenLeaveModal,
}: Props) {
  if (absent.length + notSigned.length === 0) return null;

  return (
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
        {absent.map((r) => (
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
                onChange={(e) => onStatusChange(r.id, e.target.value)}
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
                    onClick={() => onManualCheckIn(s)}
                    disabled={loading}
                    className="btn btn-primary btn-sm disabled:opacity-50"
                  >
                    手動打卡
                  </button>
                  <button
                    onClick={() => onOpenLeaveModal(s)}
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
  );
}
