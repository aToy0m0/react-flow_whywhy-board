import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: { tenantId: string; boardKey: string };
};

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId, boardKey } = context.params;
  const { user } = session;

  // テナント取得
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ id: tenantId }, { slug: tenantId }],
    },
    select: { id: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // 権限チェック: TENANT_ADMIN または SUPER_ADMIN のみ
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isTenantAdmin = user.role === 'TENANT_ADMIN' && user.tenantId === tenant.id;

  if (!isSuperAdmin && !isTenantAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ボード取得
  const board = await prisma.board.findFirst({
    where: {
      tenantId: tenant.id,
      boardKey,
      deletedAt: null,
    },
    select: { id: true, status: true },
  });

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  if (board.status === 'ACTIVE') {
    return NextResponse.json({ error: 'Board is already active' }, { status: 400 });
  }

  // ボードを有効化
  await prisma.board.update({
    where: { id: board.id },
    data: { status: 'ACTIVE' },
  });

  return NextResponse.json({ ok: true, status: 'ACTIVE' });
}
