'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

type FpCross = { fingerprint_hash: string; account_count: number; accounts: string; total_signs: number };
type IpBurst = { session_id: string; ip: string; cnt: number; users: string };
type FastReaction = { id: string; user_email: string; session_id: string; scan_time: number; reaction_ms: number };
type FpDetail = { id: string; user_email: string; session_id: string; fingerprint_hash: string; scan_time: number };

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

  useEffect(() => { fetchData(); }, [fetchData]);

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

  if (loading) return <p className="text-gray-500">載入中...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">異常分析</h1>

      <details className="mb-6 bg-white rounded-lg shadow-sm border" open>
        <summary className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-50">
          同裝置跨帳號 ({fpCross.length})
        </summary>
        {fpCross.length === 0 ? (
          <p className="px-4 py-3 text-gray-500 text-sm">無異常</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-t"><tr>
              <th className="text-left px-4 py-2">指紋 Hash</th>
              <th className="text-left px-4 py-2">帳號數</th>
              <th className="text-left px-4 py-2">帳號</th>
              <th className="text-left px-4 py-2">總簽到次數</th>
            </tr></thead>
            <tbody>
              {fpCross.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{r.fingerprint_hash?.slice(0, 12)}...</td>
                  <td className="px-4 py-2">{r.account_count}</td>
                  <td className="px-4 py-2 text-xs">{r.accounts}</td>
                  <td className="px-4 py-2">{r.total_signs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>

      {fpDetails.length > 0 && (
        <details className="mb-6 bg-white rounded-lg shadow-sm border">
          <summary className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-50">
            跨帳號詳細紀錄 ({fpDetails.length})
          </summary>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-t"><tr>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">場次</th>
              <th className="text-left px-4 py-2">指紋 Hash</th>
              <th className="text-left px-4 py-2">操作</th>
            </tr></thead>
            <tbody>
              {fpDetails.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">{r.user_email}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.session_id.slice(0, 8)}...</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.fingerprint_hash?.slice(0, 12)}...</td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => markReviewed(r.id)}
                      disabled={acting === r.id}
                      className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200 disabled:opacity-50"
                    >標記已處理</button>
                    <button
                      onClick={() => deleteRecord(r.id)}
                      disabled={acting === r.id}
                      className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 disabled:opacity-50"
                    >刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <details className="mb-6 bg-white rounded-lg shadow-sm border">
        <summary className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-50">
          同 IP 突發 ({ipBurst.length})
        </summary>
        {ipBurst.length === 0 ? (
          <p className="px-4 py-3 text-gray-500 text-sm">無異常</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-t"><tr>
              <th className="text-left px-4 py-2">場次</th>
              <th className="text-left px-4 py-2">IP</th>
              <th className="text-left px-4 py-2">人數</th>
              <th className="text-left px-4 py-2">帳號</th>
            </tr></thead>
            <tbody>
              {ipBurst.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{r.session_id.slice(0, 8)}...</td>
                  <td className="px-4 py-2">{r.ip}</td>
                  <td className="px-4 py-2">{r.cnt}</td>
                  <td className="px-4 py-2 text-xs">{r.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>

      <details className="mb-6 bg-white rounded-lg shadow-sm border">
        <summary className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-50">
          秒簽紀錄 ({fastReaction.length})
        </summary>
        {fastReaction.length === 0 ? (
          <p className="px-4 py-3 text-gray-500 text-sm">無異常</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-t"><tr>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">場次</th>
              <th className="text-left px-4 py-2">反應時間</th>
              <th className="text-left px-4 py-2">操作</th>
            </tr></thead>
            <tbody>
              {fastReaction.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">{r.user_email}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.session_id.slice(0, 8)}...</td>
                  <td className="px-4 py-2">{(r.reaction_ms / 1000).toFixed(1)}s</td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => markReviewed(r.id)}
                      disabled={acting === r.id}
                      className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200 disabled:opacity-50"
                    >標記已處理</button>
                    <button
                      onClick={() => deleteRecord(r.id)}
                      disabled={acting === r.id}
                      className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 disabled:opacity-50"
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
