import { describe, it, expect } from 'vitest';
import { detectInAppBrowser } from '../in-app-browser';

describe('detectInAppBrowser', () => {
  it('detects LINE iOS', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.20.0';
    expect(detectInAppBrowser(ua)).toBe('line');
  });

  it('detects LINE Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13; SM-S908N Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 Line/13.20.0';
    expect(detectInAppBrowser(ua)).toBe('line');
  });

  it('detects Instagram', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram 300.0.0.0 (iPhone15,2; iOS 17_0)';
    expect(detectInAppBrowser(ua)).toBe('ig');
  });

  it('detects Facebook (FBAN/FBAV)', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/440.0.0.0.0;FBBV/1234567]';
    expect(detectInAppBrowser(ua)).toBe('fb');
  });

  it('detects Messenger', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Messenger/440.0.0.0.0';
    expect(detectInAppBrowser(ua)).toBe('messenger');
  });

  it('returns null for Chrome Desktop', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(detectInAppBrowser(ua)).toBeNull();
  });

  it('returns null for Safari iOS', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(detectInAppBrowser(ua)).toBeNull();
  });

  it('returns null for Firefox Android', () => {
    const ua = 'Mozilla/5.0 (Android 13; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0';
    expect(detectInAppBrowser(ua)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectInAppBrowser('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(detectInAppBrowser(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(detectInAppBrowser(undefined)).toBeNull();
  });
});
