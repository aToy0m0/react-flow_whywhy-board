import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createTenantBoard } from '@/lib/boards';

type Props = {
  params: { tenantId: string };
};

export default async function TenantBoardCreatePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
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
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!tenant) {
    redirect('/');
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isTenantMember = user.tenantId === tenant.id;

  console.log('[DEBUG] Board creation access check:', {
    userEmail: user.email,
    userRole: user.role,
    userTenantId: user.tenantId,
    targetTenantId: tenant.id,
    targetTenantSlug: tenant.slug,
    urlParam: tenantId,
    isSuperAdmin,
    isTenantMember,
  });

  if (!isSuperAdmin && !isTenantMember) {
    console.log('[DEBUG] Access denied - redirecting to /');
    redirect('/');
  }

  const board = await createTenantBoard({
    tenantId: tenant.id,
    name: 'untitled',
    ownerId: isTenantMember ? user.id : (isSuperAdmin ? user.id : undefined),
  });

  revalidatePath(`/tenants/${tenant.slug}/boards`);

  redirect(`/tenants/${tenant.slug}/boards/${board.boardKey}`);
}
