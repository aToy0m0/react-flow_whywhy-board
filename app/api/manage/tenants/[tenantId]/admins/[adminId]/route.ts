import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { assertSuperAdmin } from '@/lib/superAdminAuth';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: {
    tenantId: string;
    adminId: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await assertSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { tenantId, adminId } = context.params;

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
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : undefined;
  const password = typeof record.password === 'string' ? record.password : undefined;

  if (!email && !password) {
    return NextResponse.json({ ok: false, error: '更新する項目を指定してください。' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (email) {
    data.email = email;
  }
  if (password) {
    data.passwordHash = await hash(password, 10);
  }

  try {
    const admin = await prisma.user.update({
      where: { id: adminId, tenantId, role: 'TENANT_ADMIN' },
      data,
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, admin });
  } catch (error) {
    const message =
      error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002'
        ? '同じメールアドレスのユーザーが既に存在します。'
        : 'テナント管理者の更新に失敗しました。';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await assertSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { tenantId, adminId } = context.params;

  try {
    await prisma.user.delete({
      where: {
        id: adminId,
        tenantId,
        role: 'TENANT_ADMIN',
      },
    });
  } catch (error) {
    const notFound = error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2025';
    if (notFound) {
      return NextResponse.json({ ok: false, error: '管理者が見つかりません。' }, { status: 404 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
