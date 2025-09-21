import { NextResponse } from 'next/server';
import { assertSuperAdmin } from '@/lib/superAdminAuth';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: {
    tenantId: string;
  };
};

export async function GET(_req: Request, context: RouteContext) {
  const auth = await assertSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { tenantId } = context.params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      users: {
        where: { role: 'TENANT_ADMIN' },
        select: { id: true, email: true, createdAt: true },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'Tenant not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      admins: tenant.users.map((user) => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      })),
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await assertSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { tenantId } = context.params;

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
    return NextResponse.json({ ok: false, error: 'Tenant name is required' }, { status: 400 });
  }

  const name = nameValue.trim().slice(0, 120);

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { name },
    select: { id: true, slug: true, name: true },
  });

  return NextResponse.json({ ok: true, tenant });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await assertSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { tenantId } = context.params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'Tenant not found' }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.node.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.board.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.user.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.tenant.delete({ where: { id: tenant.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
