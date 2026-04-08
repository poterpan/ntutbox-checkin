'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type FpCross = { fingerprint_hash: string; account_count: number; accounts: string; total_signs: number };
type IpBurst = { session_id: string; ip: string; cnt: number; users: string };
type FastReaction = { user_email: string; session_id: string; scan_time: number; reaction_ms: number };

export default function AnalyticsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [fpCross, setFpCross] = useState<FpCross[]>([]);
  const [ipBurst, setIpBurst] = useState<IpBurst[]>([]);
  const [fastReaction, setFastReaction] = useState<FastReaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/analytics`)
      .then((r) => r.json())
      .then((data) => {
        setFpCross(data.fp_cross_account ?? []);
        setIpBurst(data.ip_burst ?? []);
        setFastReaction(data.fast_reaction ?? []);
        setLoading(false);
      });
  }, [courseId]);

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
            </tr></thead>
            <tbody>
              {fastReaction.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">{r.user_email}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.session_id.slice(0, 8)}...</td>
                  <td className="px-4 py-2">{(r.reaction_ms / 1000).toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </div>
  );
}
