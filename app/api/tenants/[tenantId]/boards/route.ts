import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createTenantBoard } from '@/lib/boards';

type RouteContext = {
  params: {
    tenantId: string;
  };
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = context.params;
    const { user } = session;

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantId },
          { id: tenantId },
        ],
      },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ ok: false, error: 'Tenant not found' }, { status: 404 });
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isTenantMember = user.tenantId === tenant.id;
    if (!isSuperAdmin && !isTenantMember) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
    }

    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'untitled';
    const ownerId = isTenantMember ? user.id : undefined;

    const board = await createTenantBoard({
      tenantId: tenant.id,
      name,
      ownerId,
    });

    revalidatePath(`/tenants/${tenantId}/boards`);

    return NextResponse.json({ ok: true, board });
  } catch (error) {
    console.error('[boards:create] failed', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
