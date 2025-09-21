import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: {
    tenantId: string;
    boardKey: string;
  };
};

async function authorize(tenantIdentifier: string) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, tenant: null, status: 401 as const, response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantIdentifier } });
  if (!tenant) {
    tenant = await prisma.tenant.findUnique({ where: { id: tenantIdentifier } });
  }
  if (!tenant) {
    return { session, tenant: null, status: 404 as const, response: NextResponse.json({ ok: false, error: 'Tenant not found' }, { status: 404 }) };
  }

  const isSuperAdmin = session.user?.role === 'SUPER_ADMIN';
  const isTenantMember = session.user?.tenantId === tenant.id;
  if (!isSuperAdmin && !isTenantMember) {
    return { session, tenant: null, status: 403 as const, response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { session, tenant, status: 200 as const };
}

export async function GET(_req: Request, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200 || !auth.tenant) {
    return auth.response;
  }

  const board = await prisma.board.findUnique({
    where: { tenantId_boardKey: { tenantId: auth.tenant.id, boardKey } },
    select: { id: true, boardKey: true, name: true },
  });

  if (!board) {
    return NextResponse.json({ ok: false, error: 'Board not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, board });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200 || !auth.tenant) {
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
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Board not found' }, { status: 404 });
  }

  const board = await prisma.board.update({
    where: { id: existing.id },
    data: { name },
    select: { id: true, boardKey: true, name: true },
  });

  return NextResponse.json({ ok: true, board });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200 || !auth.tenant) {
    return auth.response;
  }

  const board = await prisma.board.findUnique({
    where: { tenantId_boardKey: { tenantId: auth.tenant.id, boardKey } },
    select: { id: true },
  });

  if (!board) {
    return NextResponse.json({ ok: false, error: 'Board not found' }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.node.deleteMany({ where: { boardId: board.id } }),
    prisma.board.delete({ where: { id: board.id } }),
  ]);

  revalidatePath(`/tenants/${tenantSlug}/boards`);

  return NextResponse.json({ ok: true });
}
