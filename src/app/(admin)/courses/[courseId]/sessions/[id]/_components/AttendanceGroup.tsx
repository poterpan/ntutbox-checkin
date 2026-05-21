'use client';

import { Fragment } from 'react';

export type AttendanceRecord = {
  id: number;
  user_email: string;
  user_name: string | null;
  scan_time: number;
  status: string;
  is_manual: number;
  is_official_leave: number;
  enrolled: boolean;
};

export type AttendanceDetail = {
  fingerprint_hash: string | null;
  fingerprint_raw: string | null;
  ip: string | null;
  user_agent: string | null;
  reaction_ms: number | null;
};

type Props = {
  rows: AttendanceRecord[];
  hasRoster: boolean;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
  editingStatus: Record<number, boolean>;
  details: Record<number, AttendanceDetail>;
  onLoadDetail: (id: number) => void;
  onStatusChange: (recordId: number, newStatus: string) => void;
  onDelete: (recordId: number, email: string) => void;
};

const statusLabel = (s: string) => {
  switch (s) {
    case 'on_time': return '準時';
    case 'late': return '遲到';
    case 'absent': return '缺席';
    case 'leave': return '請假';
    case 'manual': return '補簽';
    default: return s;
  }
};

const statusBadge = (s: string) => {
  switch (s) {
    case 'on_time': return 'badge badge-success';
    case 'late': return 'badge badge-warning';
    case 'absent': return 'badge badge-danger';
    case 'leave': return 'badge badge-info';
    case 'manual': return 'badge badge-info';
    default: return 'badge badge-muted';
  }
};

export default function AttendanceGroup({
  rows, hasRoster, expandedId, setExpandedId,
  editingStatus, details, onLoadDetail, onStatusChange, onDelete,
}: Props) {
  if (rows.length === 0) return null;

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!details[id]) onLoadDetail(id);
    }
  };

  return (
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
        {rows.map((r) => {
          const detail = details[r.id];
          return (
          <Fragment key={r.id}>
            <tr className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-text-primary">{r.user_name ?? '-'}</td>
              <td className="px-4 py-3 text-text-muted">
                {r.user_email}
                {hasRoster && !r.enrolled && (
                  <span className="ml-1.5 text-[10px] font-medium text-warning-600 bg-warning-50 px-1.5 py-0.5 rounded">非名冊</span>
                )}
              </td>
              <td className="px-4 py-3 text-text-muted">
                {new Date(r.scan_time).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}
                {r.is_manual ? <span className="ml-1.5 text-[10px] font-medium text-info-500 bg-info-50 px-1.5 py-0.5 rounded">手動</span> : null}
              </td>
              <td className="px-4 py-3">
                <span className={statusBadge(r.status)}>{statusLabel(r.status)}</span>
                {r.status === 'leave' && r.is_official_leave === 1 && (
                  <span className="ml-1.5 text-[10px] font-medium text-success-600 bg-success-50 px-1.5 py-0.5 rounded">公假</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
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
                  <button
                    onClick={() => toggleExpand(r.id)}
                    className="btn btn-ghost btn-sm !min-h-0 !p-1"
                    title="查看裝置資訊"
                  >
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(r.id, r.user_email)}
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
                  {detail ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-medium text-text-secondary">Fingerprint Hash:</span>{' '}
                        <span className="text-text-muted font-mono">{detail.fingerprint_hash ?? '-'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-text-secondary">IP:</span>{' '}
                        <span className="text-text-muted font-mono">{detail.ip ?? '-'}</span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="font-medium text-text-secondary">User Agent:</span>{' '}
                        <span className="text-text-muted break-all">{detail.user_agent ?? '-'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-text-secondary">Reaction Time:</span>{' '}
                        <span className="text-text-muted">{detail.reaction_ms != null ? `${detail.reaction_ms} ms` : '-'}</span>
                      </div>
                      {detail.fingerprint_raw && (
                        <div className="md:col-span-2">
                          <details>
                            <summary className="font-medium text-text-secondary cursor-pointer hover:text-text-primary">
                              Raw Fingerprint Components (JSON)
                            </summary>
                            <pre className="mt-2 p-3 bg-surface-dim rounded text-xs overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
                              {(() => {
                                try { return JSON.stringify(JSON.parse(detail.fingerprint_raw as string), null, 2); }
                                catch { return detail.fingerprint_raw; }
                              })()}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-text-muted text-xs">載入中...</div>
                  )}
                </td>
              </tr>
            )}
          </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
