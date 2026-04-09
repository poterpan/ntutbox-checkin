'use client';

import { signIn } from 'next-auth/react';

export default function LoginScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dim">
      <div className="text-center">
        <h1 className="text-lg font-bold text-text-primary mb-2">NTUT 簽到管理</h1>
        <p className="text-text-muted text-sm mb-6">請登入以進入管理後台</p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' }, { prompt: 'select_account' })}
          className="btn btn-primary"
        >
          使用學校 Google 帳號登入
        </button>
      </div>
    </div>
  );
}
