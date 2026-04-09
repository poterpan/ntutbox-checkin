import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { cookies } from 'next/headers';

const IMPERSONATE_SECRET = process.env.IMPERSONATE_SECRET;

export async function GET(req: NextRequest) {
  if (!IMPERSONATE_SECRET) {
    return NextResponse.json({ error: 'not_configured' }, { status: 404 });
  }

  const { searchParams } = req.nextUrl;
  const secret = searchParams.get('secret');
  const email = searchParams.get('email');
  const name = searchParams.get('name') ?? email;

  if (secret !== IMPERSONATE_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  const token = await encode({
    token: {
      email,
      name,
      sub: email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: 'authjs.session-token',
  });

  const cookieStore = await cookies();
  cookieStore.set('authjs.session-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(new URL('/my-records', req.url));
}
