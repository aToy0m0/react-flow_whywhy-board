import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isTenantThemeKey } from '@/lib/tenantThemes';

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { tenantId } = params;
    const { user } = session;

    // アクセス権チェック
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isTenantMember = user.tenantId === tenantId;

    if (!isSuperAdmin && !isTenantMember) {
      return NextResponse.json(
        { error: 'このテナントにアクセスする権限がありません' },
        { status: 403 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, themeKey: true }
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'テナントが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      tenant
    });

  } catch (error) {
    console.error('テーマ取得エラー:', error);
    return NextResponse.json(
      { error: 'テーマの取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { tenantId } = params;
    const { user } = session;

    // 権限チェック: SUPER_ADMIN または該当テナントのTENANT_ADMIN
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isTenantAdmin = user.tenantId === tenantId && user.role === 'TENANT_ADMIN';

    if (!isSuperAdmin && !isTenantAdmin) {
      return NextResponse.json(
        { error: 'テーマ変更の権限がありません' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { themeKey } = body;

    if (!isTenantThemeKey(themeKey)) {
      return NextResponse.json(
        { error: '無効なテーマキーです' },
        { status: 400 }
      );
    }

    // テナントのテーマを更新
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { themeKey },
      select: { id: true, themeKey: true }
    });

    return NextResponse.json({
      ok: true,
      tenant: updatedTenant
    });

  } catch (error) {
    console.error('テーマ更新エラー:', error);
    return NextResponse.json(
      { error: 'テーマの更新に失敗しました' },
      { status: 500 }
    );
  }
}