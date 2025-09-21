import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BoardListClient from "./BoardListClient";

type Props = {
  params: { tenantId: string };
};

export default async function TenantBoardListPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { tenantId } = params;
  const { user } = session;

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { id: tenantId },
        { slug: tenantId },
      ],
    },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    redirect("/");
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isTenantMember = user.tenantId === tenant.id;
  if (!isSuperAdmin && !isTenantMember) {
    redirect("/");
  }

  const boards = await prisma.board.findMany({
    where: { tenantId: tenant.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      boardKey: true,
      name: true,
      updatedAt: true,
    },
  });

  const initialBoards = boards.map((board) => ({
    id: board.id,
    boardKey: board.boardKey,
    name: board.name,
    updatedAt: board.updatedAt.toLocaleString(),
  }));

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-subtle">Boards</p>
            <h1 className="text-3xl font-semibold text-headline">{tenant.name} のボード一覧</h1>
          </div>
          <Link
            href={`/tenants/${tenant.slug}/boards/new`}
            className="inline-flex rounded-lg bg-highlight px-4 py-2 text-sm font-semibold text-background transition hover:bg-highlight-hover"
          >
            新規ボード作成
          </Link>
        </header>

        <BoardListClient tenantId={tenant.slug} initialBoards={initialBoards} />
      </div>
    </main>
  );
}
