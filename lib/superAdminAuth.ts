import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function assertSuperAdmin() {
  const session = await getServerSession(authOptions);
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN';
  if (!session || !isSuperAdmin) {
    return {
      authorized: false as const,
      response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: session ? 403 : 401 }),
    };
  }

  return {
    authorized: true as const,
    session,
  };
}
