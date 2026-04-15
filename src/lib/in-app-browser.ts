export type InAppBrowserType = 'line' | 'ig' | 'fb' | 'messenger' | null;

export function detectInAppBrowser(ua: string | undefined | null): InAppBrowserType {
  if (!ua) return null;
  if (/\bLine\//i.test(ua)) return 'line';
  if (/Instagram/i.test(ua)) return 'ig';
  if (/FBAN|FBAV/i.test(ua)) return 'fb';
  if (/Messenger/i.test(ua)) return 'messenger';
  return null;
}
