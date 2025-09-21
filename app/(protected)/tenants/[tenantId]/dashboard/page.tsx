import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TenantDashboard } from "@/components/TenantDashboard";

type Props = {
  params: { tenantId: string };
};

export default async function TenantDashboardPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { tenantId } = params;
  const { user } = session;

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isTenantMember = user.tenantId === tenantId;
  if (!isSuperAdmin && !isTenantMember) {
    redirect("/");
  }

  const [boardCount, userCount, recentBoards] = await Promise.all([
    prisma.board.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId } }),
    prisma.board.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        boardKey: true,
        name: true,
        updatedAt: true,
      },
    }),
  ]);

  const tenantInfo = {
    tenantId,
    boardCount,
    userCount,
    recentBoards: recentBoards.map(board => ({
      ...board,
      updatedAt: board.updatedAt.toISOString()
    }))
  };

  const userInfo = {
    role: user.role,
    tenantId: user.tenantId
  };

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <TenantDashboard tenantInfo={tenantInfo} userInfo={userInfo} />
    </main>
  );
}
