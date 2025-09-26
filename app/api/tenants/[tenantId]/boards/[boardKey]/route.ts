import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emitBoardDeleted } from '@/lib/socketEmitter';

type RouteContext = {
  params: {
    tenantId: string;
    boardKey: string;
  };
};

type AuthorizeFailure = {
  status: 401 | 403 | 404;
  response: NextResponse;
};

type AuthorizeSuccess = {
  status: 200;
  session: Session;
  tenant: { id: string };
};

type AuthorizeResult = AuthorizeSuccess | AuthorizeFailure;

async function authorize(tenantIdentifier: string): Promise<AuthorizeResult> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      status: 401,
      response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantIdentifier } });
  if (!tenant) {
    tenant = await prisma.tenant.findUnique({ where: { id: tenantIdentifier } });
  }
  if (!tenant) {
    return {
      status: 404,
      response: NextResponse.json({ ok: false, error: 'Tenant not found' }, { status: 404 }),
    };
  }

  const isSuperAdmin = session.user?.role === 'SUPER_ADMIN';
  const isTenantMember = session.user?.tenantId === tenant.id;
  if (!isSuperAdmin && !isTenantMember) {
    return {
      status: 403,
      response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { status: 200, session, tenant: { id: tenant.id } };
}

export async function GET(_req: Request, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200) {
    return auth.response;
  }

  const board = await prisma.board.findUnique({
    where: { tenantId_boardKey: { tenantId: auth.tenant.id, boardKey } },
    select: { id: true, boardKey: true, name: true, status: true, finalizedAt: true, deletedAt: true },
  });

  if (!board) {
    return NextResponse.json({ ok: false, error: 'Board not found' }, { status: 404 });
  }

  if (board.deletedAt) {
    return NextResponse.json({ ok: false, error: 'Board deleted' }, { status: 410 });
  }

  return NextResponse.json({ ok: true, board });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const nameValue = (body as Record<string, unknown>).name;
  if (typeof nameValue !== 'string' || !nameValue.trim()) {
    return NextResponse.json({ ok: false, error: 'Board name is required' }, { status: 400 });
  }

  const name = nameValue.trim().slice(0, 120);

  const existing = await prisma.board.findUnique({
    where: { tenantId_boardKey: { tenantId: auth.tenant.id, boardKey } },
    select: { id: true, status: true, deletedAt: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Board not found' }, { status: 404 });
  }

  if (existing.deletedAt) {
    return NextResponse.json({ ok: false, error: 'Board deleted' }, { status: 410 });
  }

  const board = await prisma.board.update({
    where: { id: existing.id },
    data: { name },
    select: { id: true, boardKey: true, name: true, status: true, finalizedAt: true, deletedAt: true },
  });

  return NextResponse.json({ ok: true, board });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200) {
    return auth.response;
  }

  const board = await prisma.board.findUnique({
    where: { tenantId_boardKey: { tenantId: auth.tenant.id, boardKey } },
    select: { id: true, deletedAt: true, boardKey: true },
  });

  if (!board) {
    return NextResponse.json({ ok: false, error: 'Board not found' }, { status: 404 });
  }

  const redirectTo = `/tenants/${tenantSlug}/boards`;

  if (board.deletedAt) {
    revalidatePath(redirectTo);
    revalidatePath(`${redirectTo}/${boardKey}`);
    return new NextResponse(null, { status: 204 });
  }

  const deletedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.nodeLock.updateMany({
      where: { node: { boardId: board.id }, isActive: true },
      data: { isActive: false, unlockedAt: deletedAt },
    });

    await tx.board.update({
      where: { id: board.id },
      data: { deletedAt, status: 'ARCHIVED' },
    });
  });

  const initiatedBy = auth.session.user?.id ?? 'unknown';
  const roomId = `${tenantSlug}:${boardKey}`;
  emitBoardDeleted(roomId, {
    boardId: board.id,
    boardKey: board.boardKey,
    initiatedBy,
    deletedAt: deletedAt.toISOString(),
    redirectTo,
  });

  revalidatePath(redirectTo);
  revalidatePath(`${redirectTo}/${boardKey}`);

  return new NextResponse(null, { status: 204 });
}
