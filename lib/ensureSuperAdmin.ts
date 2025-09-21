import { prisma } from "./prisma";

/**
 * Returns true if at least one SUPER_ADMIN user exists.
 */
export async function ensureSuperAdminExists(): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
  });

  return Boolean(existing);
}
