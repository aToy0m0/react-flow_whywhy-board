import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ManageTenantsClient, { type TenantAdminDTO, type TenantDTO } from './ManageTenantsClient';

export default async function ManagePage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== 'SUPER_ADMIN') {
    redirect('/');
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { slug: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      users: {
        where: { role: 'TENANT_ADMIN' },
        select: { id: true, email: true, createdAt: true },
      },
    },
  });

  const initialTenants: TenantDTO[] = tenants.map((tenant) => ({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    admins: tenant.users.map<TenantAdminDTO>((user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    })),
  }));

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <header className="mb-10 space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-subtle">Super Admin</p>
          <h1 className="text-3xl font-semibold text-headline">テナント管理</h1>
          <p className="text-sm text-muted">
            テナントの作成・名称変更、およびテナント管理者のアカウント管理を行います。
          </p>
        </header>

        <ManageTenantsClient initialTenants={initialTenants} />
      </div>
    </main>
  );
}
