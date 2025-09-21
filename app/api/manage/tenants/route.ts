import { NextResponse } from 'next/server';
import { assertSuperAdmin } from '@/lib/superAdminAuth';
import { prisma } from '@/lib/prisma';
import { slugifyBoardKey } from '@/lib/boards';

type TenantResponse = {
  id: string;
  slug: string;
  name: string;
  adminCount: number;
};

function sanitizeTenantSlug(input: string) {
  const slug = slugifyBoardKey(input).replace(/[^a-z0-9-]/g, '');
  return slug || `tenant-${Date.now().toString(36)}`;
}

export async function GET() {
  const auth = await assertSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { slug: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      users: {
        where: { role: 'TENANT_ADMIN' },
        select: { id: true },
      },
    },
  });

  const payload: TenantResponse[] = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    adminCount: t.users.length,
  }));

  return NextResponse.json({ ok: true, tenants: payload });
}

export async function POST(request: Request) {
  const auth = await assertSuperAdmin();
  if (!auth.authorized) {
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

  const record = body as Record<string, unknown>;
  const slugInput = typeof record.slug === 'string' ? record.slug : '';
  const nameInput = typeof record.name === 'string' ? record.name : '';

  const slug = sanitizeTenantSlug(slugInput);
  const name = nameInput.trim() || slug;

  try {
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name,
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    return NextResponse.json({ ok: true, tenant });
  } catch (error) {
    const message =
      error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002'
        ? '同じスラッグのテナントが既に存在します。'
        : 'テナントの作成に失敗しました。';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
