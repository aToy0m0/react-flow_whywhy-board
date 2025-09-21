import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
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

  const admins = await prisma.user.findMany({
    where: { tenantId, role: 'TENANT_ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, admins });
}

export async function POST(request: Request, context: RouteContext) {
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

  const record = body as Record<string, unknown>;
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const password = typeof record.password === 'string' ? record.password : '';

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'メールアドレスとパスワードを入力してください。' }, { status: 400 });
  }

  try {
    const passwordHash = await hash(password, 10);
    const admin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'TENANT_ADMIN',
        tenant: { connect: { id: tenantId } },
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, admin });
  } catch (error) {
    const message = (
      error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002'
        ? '同じメールアドレスのユーザーが既に存在します。'
        : 'テナント管理者の作成に失敗しました。'
    );
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
