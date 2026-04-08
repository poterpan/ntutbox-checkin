'use client';

import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<ReturnType<typeof FingerprintJS.load>> | null = null;

export async function getFingerprint(): Promise<{
  visitorId: string;
  components: Record<string, unknown>;
}> {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  const fp = await fpPromise;
  const result = await fp.get();
  return {
    visitorId: result.visitorId,
    components: result.components as Record<string, unknown>,
  };
}
