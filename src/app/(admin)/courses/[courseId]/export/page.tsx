'use client';

import { useParams } from 'next/navigation';

export default function ExportPage() {
  const { courseId } = useParams<{ courseId: string }>();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">匯出紀錄</h1>
      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div>
          <h2 className="font-semibold mb-2">全學期匯出</h2>
          <p className="text-gray-500 text-sm mb-3">匯出本課程所有場次的完整簽到紀錄</p>
          <a href={`/api/courses/${courseId}/export`}
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            下載 CSV
          </a>
        </div>
      </div>
    </div>
  );
}
