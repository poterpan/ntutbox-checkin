import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          hd: process.env.ALLOWED_EMAIL_DOMAIN ?? 'ntut.org.tw',
          prompt: 'select_account',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? 'ntut.org.tw';
      return !!user.email?.endsWith(`@${domain}`);
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
      }
      // Refresh token: reset expiry on every visit
      token.iat = Math.floor(Date.now() / 1000);
      token.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: {
    error: '/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
});
