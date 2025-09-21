import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

// ユーザー詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { tenantId, userId } = params;
    const { user } = session;

    // 権限チェック（SUPER_ADMINまたは同テナントのTENANT_ADMIN）
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const isTenantAdmin = user.role === "TENANT_ADMIN" && user.tenantId === tenantId;

    if (!isSuperAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
        tenantId,
        role: { not: "SUPER_ADMIN" } // SUPER_ADMINを除外
      },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    return NextResponse.json({ user: targetUser });
  } catch (error) {
    console.error("ユーザー詳細取得エラー:", error);
    return NextResponse.json({ error: "内部エラー" }, { status: 500 });
  }
}

// ユーザー更新（パスワード変更、ロール変更など）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { tenantId, userId } = params;
    const { user } = session;

    // 権限チェック（SUPER_ADMINまたは同テナントのTENANT_ADMIN）
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const isTenantAdmin = user.role === "TENANT_ADMIN" && user.tenantId === tenantId;

    if (!isSuperAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { password, role } = await request.json();

    // 対象ユーザーの存在確認
    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
        tenantId,
        role: { not: "SUPER_ADMIN" } // SUPER_ADMINを除外
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    // 更新データの準備
    const updateData: { passwordHash?: string; role?: UserRole } = {};

    // パスワード変更
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "パスワードは6文字以上である必要があります" }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    // ロール変更
    if (role) {
      if (!["MEMBER", "TENANT_ADMIN"].includes(role)) {
        return NextResponse.json({ error: "無効なロールです" }, { status: 400 });
      }
      updateData.role = role as UserRole;
    }

    // 更新実行
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      user: updatedUser,
      message: "ユーザー情報が正常に更新されました"
    });

  } catch (error) {
    console.error("ユーザー更新エラー:", error);
    return NextResponse.json({ error: "内部エラー" }, { status: 500 });
  }
}

// ユーザー削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tenantId: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { tenantId, userId } = params;
    const { user } = session;

    // 権限チェック（SUPER_ADMINまたは同テナントのTENANT_ADMIN）
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const isTenantAdmin = user.role === "TENANT_ADMIN" && user.tenantId === tenantId;

    if (!isSuperAdmin && !isTenantAdmin) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    // 自分自身の削除を防ぐ
    if (userId === user.id) {
      return NextResponse.json({ error: "自分自身を削除することはできません" }, { status: 400 });
    }

    // 対象ユーザーの存在確認
    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
        tenantId,
        role: { not: "SUPER_ADMIN" } // SUPER_ADMINを除外
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    // ユーザーが作成したボードの所有者を変更または削除
    // 簡単な実装：ボードの削除（実際の運用では所有者変更が望ましい）
    await prisma.board.deleteMany({
      where: {
        tenantId,
        ownerId: userId
      }
    });

    // ユーザー削除
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({
      message: "ユーザーが正常に削除されました"
    });

  } catch (error) {
    console.error("ユーザー削除エラー:", error);
    return NextResponse.json({ error: "内部エラー" }, { status: 500 });
  }
}