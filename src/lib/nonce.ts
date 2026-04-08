import { getKV } from '@/lib/cloudflare';

export type NonceData = {
  course_id: string;
  session_id: string;
  created_at: number;
  expires_at: number;
};

export async function validateNonce(nonce: string): Promise<NonceData | null> {
  const kv = getKV();
  const data = await kv.get<NonceData>(`nonce:${nonce}`, 'json')
    ?? await kv.get<NonceData>(`nonce:static:${nonce}`, 'json');
  if (!data) return null;
  if (Date.now() > data.expires_at) return null;
  return data;
}
