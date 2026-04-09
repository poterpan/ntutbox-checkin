import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LogoutButton from './LogoutButton';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/api/auth/signin?callbackUrl=/dashboard');
  }

  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? 'ntut.org.tw';
  if (!session.user.email.endsWith(`@${domain}`)) {
    redirect('/error?code=invalid_domain');
  }

  return (
    <div className="min-h-screen bg-surface-dim">
      <nav className="bg-brand-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/dashboard" className="font-bold text-lg tracking-tight">NTUT 簽到管理</a>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/70">{session.user.name ?? session.user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
