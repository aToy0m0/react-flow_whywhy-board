import { hash } from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from './prisma';

const DEFAULT_SUPERADMIN_EMAIL = 'admin@example.com';
const DEFAULT_SUPERADMIN_TENANT = process.env.NEXT_PUBLIC_TENANT_ID ?? 'default';

type SuperAdminOptions = {
  email?: string;
  password?: string;
  tenantSlug?: string;
  tenantName?: string;
};

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'default';
}

export async function ensureTenant(slug = DEFAULT_SUPERADMIN_TENANT, name?: string) {
  const sanitizedSlug = sanitizeSlug(slug);
  const tenant = await prisma.tenant.upsert({
    where: { slug: sanitizedSlug },
    update: {},
    create: {
      slug: sanitizedSlug,
      name: name ?? slug, // 表示名は元の値を保持
    },
  });

  return tenant;
}

export async function createSuperAdmin(options: SuperAdminOptions = {}) {
  const email = options.email?.trim() || process.env.SUPERADMIN_EMAIL || DEFAULT_SUPERADMIN_EMAIL;
  const presetPassword = options.password ?? process.env.SUPERADMIN_PASSWORD;
  const tenantSlug = options.tenantSlug?.trim() || DEFAULT_SUPERADMIN_TENANT;

  if (!presetPassword) {
    throw new Error('SUPERADMIN_PASSWORD must be set before initialization');
  }

  const tenant = await ensureTenant(tenantSlug, options.tenantName);
  const passwordHash = await hash(presetPassword, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const needsUpdate = existing.passwordHash !== passwordHash || existing.role !== UserRole.SUPER_ADMIN;
    if (needsUpdate) {
      await prisma.user.update({ where: { email }, data: { passwordHash, role: UserRole.SUPER_ADMIN } });
      console.info('[bootstrap] Super admin user password updated', { email });
    }
    return { created: false, updated: needsUpdate, email };
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      tenantId: tenant.id,
    },
  });

  console.info('[bootstrap] Super admin user created', { email });
  return { created: true, updated: false, email };
}
