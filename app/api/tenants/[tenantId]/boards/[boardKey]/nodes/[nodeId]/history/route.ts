import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
// import type { Session } from 'next-auth';
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
  if (!session) {
    return { session: null, tenant: null, user: null, status: 401 as const, response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantIdentifier } });
  if (!tenant) {
    tenant = await prisma.tenant.findUnique({ where: { id: tenantIdentifier } });
  }
  if (!tenant) {
    return { session, tenant: null, user: null, status: 404 as const, response: NextResponse.json({ ok: false, error: 'Tenant not found' }, { status: 404 }) };
  }

  if (!session.user?.email) {
    return { session, tenant, user: null, status: 401 as const, response: NextResponse.json({ ok: false, error: 'User email not found' }, { status: 401 }) };
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

export async function GET(_req: NextRequest, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey, nodeId } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200 || !auth.tenant || !auth.user) {
    return auth.response;
  }

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

  const edits = await prisma.nodeEdit.findMany({
    where: { nodeId: node.id },
    include: {
      user: {
        select: { id: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    edits: edits.map(edit => ({
      id: edit.id,
      action: edit.action,
      beforeData: edit.beforeData,
      afterData: edit.afterData,
      createdAt: edit.createdAt,
      user: edit.user
    }))
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { tenantId: tenantSlug, boardKey, nodeId } = context.params;
  const auth = await authorize(tenantSlug);
  if (auth.status !== 200 || !auth.tenant || !auth.user) {
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

  const requestBody = body as Record<string, unknown>;
  const action = requestBody.action;
  const beforeData = requestBody.beforeData;
  const afterData = requestBody.afterData;

  if (!action || typeof action !== 'string') {
    return NextResponse.json({ ok: false, error: 'Action is required' }, { status: 400 });
  }

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

  const edit = await prisma.nodeEdit.create({
    data: {
      nodeId: node.id,
      userId: auth.user.id,
      action,
      beforeData: beforeData || undefined,
      afterData: afterData || undefined,
    },
    include: {
      user: {
        select: { id: true, email: true }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    edit: {
      id: edit.id,
      action: edit.action,
      beforeData: edit.beforeData,
      afterData: edit.afterData,
      createdAt: edit.createdAt,
      user: edit.user
    }
  });
}