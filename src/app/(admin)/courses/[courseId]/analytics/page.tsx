'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

type FpCross = { fingerprint_hash: string; account_count: number; accounts: string; total_signs: number };
type IpBurst = { session_id: string; ip: string; cnt: number; users: string };
type FastReaction = { id: string; user_email: string; session_id: string; scan_time: number; reaction_ms: number };
type FpDetail = { id: string; user_email: string; session_id: string; fingerprint_hash: string; fingerprint_raw: string | null; scan_time: number };

type AnalyticsData = {
  fp_cross_account?: FpCross[];
  ip_burst?: IpBurst[];
  fast_reaction?: FastReaction[];
  fp_details?: FpDetail[];
};

export default function AnalyticsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [fpCross, setFpCross] = useState<FpCross[]>([]);
  const [ipBurst, setIpBurst] = useState<IpBurst[]>([]);
  const [fastReaction, setFastReaction] = useState<FastReaction[]>([]);
  const [fpDetails, setFpDetails] = useState<FpDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');

  const fetchData = useCallback(() => {
    fetch(`/api/courses/${courseId}/analytics`)
      .then((r) => r.json() as Promise<AnalyticsData>)
      .then((data) => {
        setFpCross(data.fp_cross_account ?? []);
        setIpBurst(data.ip_burst ?? []);
        setFastReaction(data.fast_reaction ?? []);
        setFpDetails(data.fp_details ?? []);
        setLoading(false);
      });
  }, [courseId]);

  useEffect(() => {
    fetchData();
    fetch('/api/courses')
      .then((r) => r.json() as Promise<{ courses?: { id: string; name: string }[] }>)
      .then((data) => {
        const c = data.courses?.find((c) => c.id === courseId);
        if (c) setCourseName(c.name);
      });
  }, [fetchData, courseId]);

  const markReviewed = async (id: string) => {
    setActing(id);
    await fetch(`/api/courses/${courseId}/attendance/${id}`, { method: 'PATCH' });
    setActing(null);
    fetchData();
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('確定要刪除此紀錄？此操作不可復原。')) return;
    setActing(id);
    await fetch(`/api/courses/${courseId}/attendance/${id}`, { method: 'DELETE' });
    setActing(null);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-text-muted">載入中...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-text-muted mb-4">
        <a href="/dashboard" className="hover:text-brand-500">我的課程</a>
        <span className="mx-2">/</span>
        <a href={`/courses/${courseId}`} className="hover:text-brand-500">{courseName || courseId}</a>
        <span className="mx-2">/</span>
        <span className="text-text-primary">異常分析</span>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary mb-6">異常分析</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-danger-500">{fpCross.length}</p>
          <p className="text-sm text-text-muted mt-1">可疑裝置</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-warning-500">{fastReaction.length}</p>
          <p className="text-sm text-text-muted mt-1">秒簽紀錄</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-info-500">{ipBurst.length}</p>
          <p className="text-sm text-text-muted mt-1">同 IP 異常</p>
        </div>
      </div>

      {/* Cross-account fingerprints */}
      <details className="mb-6 card" open>
        <summary className="px-4 py-3 font-semibold cursor-pointer hover:bg-surface-muted text-text-primary">
          同裝置跨帳號 ({fpCross.length})
        </summary>
        {fpCross.length === 0 ? (
          <p className="px-4 py-3 text-text-muted text-sm">無異常</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-t border-border"><tr>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">指紋 Hash</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">帳號數</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">帳號</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">總簽到次數</th>
            </tr></thead>
            <tbody>
              {fpCross.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs text-text-muted">{r.fingerprint_hash?.slice(0, 12)}...</td>
                  <td className="px-4 py-2 text-text-primary">{r.account_count}</td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{r.accounts}</td>
                  <td className="px-4 py-2 text-text-primary">{r.total_signs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>

      {/* Cross-account details */}
      {fpDetails.length > 0 && (
        <details className="mb-6 card">
          <summary className="px-4 py-3 font-semibold cursor-pointer hover:bg-surface-muted text-text-primary">
            跨帳號詳細紀錄 ({fpDetails.length})
          </summary>
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-t border-border"><tr>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">Email</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">場次</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">指紋 Hash</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">操作</th>
            </tr></thead>
            <tbody>
              {fpDetails.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 text-text-primary">{r.user_email}</td>
                  <td className="px-4 py-2 font-mono text-xs text-text-muted">{r.session_id.slice(0, 8)}...</td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs text-text-muted">{r.fingerprint_hash?.slice(0, 12)}...</span>
                    {r.fingerprint_raw && (
                      <details className="mt-1">
                        <summary className="text-xs text-brand-500 cursor-pointer hover:underline">展開 raw</summary>
                        <pre className="text-xs bg-surface-muted p-2 mt-1 rounded overflow-x-auto max-h-40 overflow-y-auto">
                          {JSON.stringify(JSON.parse(r.fingerprint_raw), null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => markReviewed(r.id)}
                      disabled={acting === r.id}
                      className="btn btn-sm !min-h-0 !py-1 !px-2 text-xs bg-warning-100 text-warning-600 hover:bg-warning-50 disabled:opacity-50"
                    >標記已處理</button>
                    <button
                      onClick={() => deleteRecord(r.id)}
                      disabled={acting === r.id}
                      className="btn btn-sm !min-h-0 !py-1 !px-2 text-xs bg-danger-100 text-danger-600 hover:bg-danger-50 disabled:opacity-50"
                    >刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/* IP burst */}
      <details className="mb-6 card">
        <summary className="px-4 py-3 font-semibold cursor-pointer hover:bg-surface-muted text-text-primary">
          同 IP 突發 ({ipBurst.length})
        </summary>
        {ipBurst.length === 0 ? (
          <p className="px-4 py-3 text-text-muted text-sm">無異常</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-t border-border"><tr>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">場次</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">IP</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">人數</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">帳號</th>
            </tr></thead>
            <tbody>
              {ipBurst.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs text-text-muted">{r.session_id.slice(0, 8)}...</td>
                  <td className="px-4 py-2 text-text-primary">{r.ip}</td>
                  <td className="px-4 py-2 text-text-primary">{r.cnt}</td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{r.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>

      {/* Fast reaction */}
      <details className="mb-6 card">
        <summary className="px-4 py-3 font-semibold cursor-pointer hover:bg-surface-muted text-text-primary">
          秒簽紀錄 ({fastReaction.length})
        </summary>
        {fastReaction.length === 0 ? (
          <p className="px-4 py-3 text-text-muted text-sm">無異常</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-t border-border"><tr>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">Email</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">場次</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">反應時間</th>
              <th className="text-left px-4 py-2 font-medium text-text-secondary">操作</th>
            </tr></thead>
            <tbody>
              {fastReaction.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 text-text-primary">{r.user_email}</td>
                  <td className="px-4 py-2 font-mono text-xs text-text-muted">{r.session_id.slice(0, 8)}...</td>
                  <td className="px-4 py-2 text-text-primary">{(r.reaction_ms / 1000).toFixed(1)}s</td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => markReviewed(r.id)}
                      disabled={acting === r.id}
                      className="btn btn-sm !min-h-0 !py-1 !px-2 text-xs bg-warning-100 text-warning-600 hover:bg-warning-50 disabled:opacity-50"
                    >標記已處理</button>
                    <button
                      onClick={() => deleteRecord(r.id)}
                      disabled={acting === r.id}
                      className="btn btn-sm !min-h-0 !py-1 !px-2 text-xs bg-danger-100 text-danger-600 hover:bg-danger-50 disabled:opacity-50"
                    >刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </div>
  );
}
