import { getCloudflareContext } from '@opennextjs/cloudflare';

export function getDB(): D1Database {
  const { env } = getCloudflareContext();
  return (env as unknown as CloudflareEnv).DB;
}

export function getKV(): KVNamespace {
  const { env } = getCloudflareContext();
  return (env as unknown as CloudflareEnv).KV;
}
