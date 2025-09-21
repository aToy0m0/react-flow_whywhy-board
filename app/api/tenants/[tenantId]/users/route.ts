import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// ユーザー一覧取得
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { tenantId } = params;
    const { user } = session;

    // 権限チェック（SUPER_ADMINまたは同テナントのTENANT_ADMIN）
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const isTenantAdmin = user.role === "TENANT_ADMIN" && user.tenantId === tenantId;

    if (!isSuperAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: { not: "SUPER_ADMIN" } // SUPER_ADMINを除外
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("ユーザー一覧取得エラー:", error);
    return NextResponse.json({ error: "内部エラー" }, { status: 500 });
  }
}

// 新規ユーザー作成
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { tenantId } = params;
    const { user } = session;

    // 権限チェック（SUPER_ADMINまたは同テナントのTENANT_ADMIN）
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const isTenantAdmin = user.role === "TENANT_ADMIN" && user.tenantId === tenantId;

    if (!isSuperAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { email, password, role = "MEMBER" } = await request.json();

    // バリデーション
    if (!email || !password) {
      return NextResponse.json({ error: "メールアドレスとパスワードは必須です" }, { status: 400 });
    }

    if (!["MEMBER", "TENANT_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "無効なロールです" }, { status: 400 });
    }

    // テナントの存在確認
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json({ error: "テナントが見つかりません" }, { status: 404 });
    }

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: "このメールアドレスは既に使用されています" }, { status: 409 });
    }

    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash(password, 12);

    // ユーザー作成
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        role,
        tenantId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      user: newUser,
      message: "ユーザーが正常に作成されました"
    }, { status: 201 });

  } catch (error) {
    console.error("ユーザー作成エラー:", error);
    return NextResponse.json({ error: "内部エラー" }, { status: 500 });
  }
}