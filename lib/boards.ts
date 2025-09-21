import { prisma } from './prisma';

const BOARD_KEY_MAX_LENGTH = 64;

export function slugifyBoardKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BOARD_KEY_MAX_LENGTH);
}

async function ensureUniqueBoardKey(tenantId: string, baseKey: string) {
  let base = slugifyBoardKey(baseKey);
  if (!base) {
    base = `board-${Date.now().toString(36)}`;
  }

  let candidate = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.board.findFirst({
      where: { tenantId, boardKey: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    counter += 1;
    candidate = `${base}-${counter}`.slice(0, BOARD_KEY_MAX_LENGTH);
  }
}

export async function createTenantBoard(options: {
  tenantId: string;
  name: string;
  requestedKey?: string;
  ownerId?: string;
}) {
  const { tenantId, name, requestedKey, ownerId } = options;
  const boardKey = await ensureUniqueBoardKey(tenantId, requestedKey ?? name);

  return prisma.board.create({
    data: {
      tenant: { connect: { id: tenantId } },
      name,
      boardKey,
      ...(ownerId ? { owner: { connect: { id: ownerId } } } : {}),
    },
    select: {
      id: true,
      boardKey: true,
      name: true,
    },
  });
}
