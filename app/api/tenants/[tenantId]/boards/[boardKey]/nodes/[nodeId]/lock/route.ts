import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: {
    tenantId: string;
    boardKey: string;
    nodeId: string;
  };
};

async function authorize(tenantIdentifier: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { session: null, tenant: null, user: null, status: 401 as const, response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantIdentifier } });
  if (!tenant) {
    tenant = await prisma.tenant.findUnique({ where: { id: tenantIdentifier } });
  }
  if (!tenant) {
    return { session, tenant: null, user: null, status: 404 as const, response: NextResponse.json({ ok: false, error: 'Tenant not found' }, { status: 404 }) };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true, tenantId: true }
  });
  if (!user) {
    return { session, tenant, user: null, status: 404 as const, response: NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 }) };
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isTenantMember = user.tenantId === tenant.id;
  if (!isSuperAdmin && !isTenantMember) {
    return { session, tenant: null, user: null, status: 403 as const, response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { session, tenant, user, status: 200 as const };
}

// ノードロック状態を取得
export async function GET(_req: NextRequest, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey, nodeId } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200 || !auth.tenant || !auth.user) {
    return auth.response;
  }

  console.log('[API][GET /lock] request', { tenantSlug, boardKey, nodeId });

  const board = await prisma.board.findUnique({
    where: { tenantId_boardKey: { tenantId: auth.tenant.id, boardKey } },
    select: { id: true },
  });

  if (!board) {
    return NextResponse.json({ ok: false, error: 'Board not found' }, { status: 404 });
  }

  const node = await prisma.node.findFirst({
    where: {
      boardId: board.id,
      OR: [
        { id: nodeId },
        { nodeKey: nodeId }
      ]
    },
    select: { id: true, nodeKey: true },
  });

  if (!node) {
    return NextResponse.json({ ok: false, error: 'Node not found' }, { status: 404 });
  }

  const activeLock = await prisma.nodeLock.findFirst({
    where: {
      nodeId: node.id,
      isActive: true
    },
    include: {
      user: {
        select: { id: true, email: true }
      }
    },
    orderBy: { lockedAt: 'desc' }
  });

  return NextResponse.json({
    ok: true,
    locked: !!activeLock,
    lock: activeLock ? {
      id: activeLock.id,
      lockedAt: activeLock.lockedAt,
      user: activeLock.user
    } : null
  });
}

// ノードロックを開始
export async function POST(_req: NextRequest, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey, nodeId } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200 || !auth.tenant || !auth.user) {
    return auth.response;
  }

  console.log('[API][POST /lock] request', { tenantSlug, boardKey, nodeId, userId: auth.user.id });

  const board = await prisma.board.findUnique({
    where: { tenantId_boardKey: { tenantId: auth.tenant.id, boardKey } },
    select: { id: true },
  });

  if (!board) {
    return NextResponse.json({ ok: false, error: 'Board not found' }, { status: 404 });
  }

  const node = await prisma.node.findFirst({
    where: {
      boardId: board.id,
      OR: [
        { id: nodeId },
        { nodeKey: nodeId }
      ]
    },
    select: { id: true },
  });

  if (!node) {
    return NextResponse.json({ ok: false, error: 'Node not found' }, { status: 404 });
  }

  try {
    // 既存のアクティブロックをチェック
    const existingLock = await prisma.nodeLock.findFirst({
      where: {
        nodeId: node.id,
        isActive: true
      },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    if (existingLock) {
      // 同じユーザーの場合はロック延長
      if (existingLock.userId === auth.user.id) {
        const updatedLock = await prisma.nodeLock.update({
          where: { id: existingLock.id },
          data: { lockedAt: new Date() },
          include: {
            user: {
              select: { id: true, email: true }
            }
          }
        });

        return NextResponse.json({
          ok: true,
          lock: {
            id: updatedLock.id,
            lockedAt: updatedLock.lockedAt,
            user: updatedLock.user
          }
        });
      } else {
        // 他のユーザーがロック中
        return NextResponse.json({
          ok: false,
          error: 'Node is locked by another user',
          lockedBy: existingLock.user
        }, { status: 409 });
      }
    }

    // 新しいロックを作成
    const newLock = await prisma.nodeLock.create({
      data: {
        nodeId: node.id,
        userId: auth.user.id,
        isActive: true
      },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    console.log('[API][POST /lock] created', { lockId: newLock.id, userId: auth.user.id });

    return NextResponse.json({
      ok: true,
      lock: {
        id: newLock.id,
        lockedAt: newLock.lockedAt,
        user: newLock.user
      }
    });

  } catch (error) {
    console.error('[API][POST /lock] error', error);
    return NextResponse.json({ ok: false, error: 'Failed to acquire lock' }, { status: 500 });
  }
}

// ノードロック解除
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey, nodeId } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200 || !auth.tenant || !auth.user) {
    return auth.response;
  }

  console.log('[API][DELETE /lock] request', { tenantSlug, boardKey, nodeId, userId: auth.user.id });

  const board = await prisma.board.findUnique({
    where: { tenantId_boardKey: { tenantId: auth.tenant.id, boardKey } },
    select: { id: true },
  });

  if (!board) {
    return NextResponse.json({ ok: false, error: 'Board not found' }, { status: 404 });
  }

  const node = await prisma.node.findFirst({
    where: {
      boardId: board.id,
      OR: [
        { id: nodeId },
        { nodeKey: nodeId }
      ]
    },
    select: { id: true },
  });

  if (!node) {
    return NextResponse.json({ ok: false, error: 'Node not found' }, { status: 404 });
  }

  try {
    // ユーザーのアクティブロックを検索して解除
    const activeLock = await prisma.nodeLock.findFirst({
      where: {
        nodeId: node.id,
        userId: auth.user.id,
        isActive: true
      }
    });

    if (!activeLock) {
      return NextResponse.json({
        ok: false,
        error: 'No active lock found for this user'
      }, { status: 404 });
    }

    await prisma.nodeLock.update({
      where: { id: activeLock.id },
      data: {
        isActive: false,
        unlockedAt: new Date()
      }
    });

    console.log('[API][DELETE /lock] released', { lockId: activeLock.id, userId: auth.user.id });

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('[API][DELETE /lock] error', error);
    return NextResponse.json({ ok: false, error: 'Failed to release lock' }, { status: 500 });
  }
}