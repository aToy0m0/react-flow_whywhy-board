import { prisma } from './prisma';
import { compare } from 'bcryptjs';
import type { JWT } from 'next-auth/jwt';
import type { NextAuthOptions } from 'next-auth';
import type { UserRole } from '@prisma/client';
import CredentialsProvider from 'next-auth/providers/credentials';
type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
};

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthUser>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.role === 'string' &&
    typeof candidate.tenantId === 'string'
  );
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<AuthUser | null> {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) {
          return null;
        }

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        } satisfies AuthUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && isAuthUser(user)) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const typedToken = token as JWT;
        if (typeof typedToken.id === 'string') {
          session.user.id = typedToken.id;
        }
        if (typeof typedToken.role === 'string') {
          session.user.role = typedToken.role;
        }
        if (typeof typedToken.tenantId === 'string') {
          session.user.tenantId = typedToken.tenantId;
        }
      }
      return session;
    },
  },
};
