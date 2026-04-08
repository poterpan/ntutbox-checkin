import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/api/auth/signin');
  }

  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? 'ntut.org.tw';
  if (!session.user.email.endsWith(`@${domain}`)) {
    redirect('/error?code=invalid_domain');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/dashboard" className="font-bold text-lg">簽到管理系統</a>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session.user.email}</span>
            <a href="/api/auth/signout" className="text-sm text-red-600 hover:underline">登出</a>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
