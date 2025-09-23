import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { NodeCategory } from '@prisma/client';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type SerializedNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'root' | 'why' | 'cause' | 'action';
  adopted?: boolean;
  createdAt?: number;
  uiHeight?: number;
};

type SerializedEdge = {
  id: string;
  source: string;
  target: string;
};

interface SerializedGraph {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

interface PutPayload {
  name?: string;
  graph: SerializedGraph;
}

const DEFAULT_BOARD_NAME = 'Unnamed Board';

function mapNodeTypeToCategory(type: SerializedNode['type']): NodeCategory {
  switch (type) {
    case 'root':
      return NodeCategory.Root;
    case 'cause':
      return NodeCategory.Cause;
    case 'action':
      return NodeCategory.Action;
    case 'why':
    default:
      return NodeCategory.Why;
  }
}

function mapCategoryToNodeType(category: NodeCategory): SerializedNode['type'] {
  switch (category) {
    case NodeCategory.Root:
      return 'root';
    case NodeCategory.Cause:
      return 'cause';
    case NodeCategory.Action:
      return 'action';
    case NodeCategory.Why:
    default:
      return 'why';
  }
}

function calcDepths(nodes: SerializedNode[], edges: SerializedEdge[], rootId?: string): Record<string, number> {
  const depth: Record<string, number> = {};
  const childrenMap = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  nodes.forEach((n) => indegree.set(n.id, 0));
  edges.forEach((e) => {
    const arr = childrenMap.get(e.source) ?? [];
    arr.push(e.target);
    childrenMap.set(e.source, arr);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  });

  const hasId = (id?: string): id is string => !!id && nodes.some((n) => n.id === id);

  let starts: string[] = [];
  if (hasId(rootId)) {
    starts = [rootId];
  } else {
    const rootTyped = nodes.filter((n) => n.type === 'root').map((n) => n.id);
    if (rootTyped.length) {
      starts = rootTyped;
    } else {
      const zeroIn = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
      if (zeroIn.length) {
        starts = zeroIn;
      } else if (nodes.length) {
        starts = [nodes[0].id];
      }
    }
  }

  const queue: string[] = [];
  const visited = new Set<string>();

  for (const s of starts) {
    depth[s] = Math.min(depth[s] ?? 0, 0);
    queue.push(s);
  }

  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const d = depth[cur] ?? 0;
    for (const child of childrenMap.get(cur) ?? []) {
      const next = d + 1;
      depth[child] = depth[child] === undefined ? next : Math.min(depth[child], next);
      queue.push(child);
    }
  }

  return depth;
}

function buildGraphFromNodes(nodes: Array<{
  id: string;
  nodeKey: string | null;
  content: string;
  category: NodeCategory;
  x: number;
  y: number;
  adopted: boolean;
  createdAt: Date;
  prevNodes: string[];
  nextNodes: string[];
  // uiHeight?: number | null; // TODO: マイグレーション後に有効化
}>): SerializedGraph {
  const serializedNodes: SerializedNode[] = nodes.map((node) => {
    // nodeKeyを優先、なければidを使用（React FlowのIDと一致させる）
    const key = node.nodeKey ?? node.id;
    return {
      id: key,
      label: node.content,
      type: mapCategoryToNodeType(node.category),
      x: node.x,
      y: node.y,
      adopted: node.adopted,
      createdAt: node.createdAt?.getTime?.() ?? undefined,
      // uiHeight: node.uiHeight ?? undefined, // TODO: マイグレーション後に有効化
    };
  });

  const edgeSet = new Set<string>();
  const serializedEdges: SerializedEdge[] = [];

  nodes.forEach((node) => {
    const sourceKey = node.nodeKey ?? node.id;
    node.nextNodes.forEach((targetKey) => {
      const edgeId = `e_${sourceKey}_${targetKey}`;
      if (edgeSet.has(edgeId)) return;
      edgeSet.add(edgeId);
      serializedEdges.push({ id: edgeId, source: sourceKey, target: targetKey });
    });
  });

  return { nodes: serializedNodes, edges: serializedEdges };
}

async function ensureTenant(tenantSlug: string) {
  return prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {},
    create: {
      slug: tenantSlug,
      name: tenantSlug,
    },
  });
}

async function ensureBoard(tenantId: string, boardKey: string, name?: string) {
  return prisma.board.upsert({
    where: { tenantId_boardKey: { tenantId, boardKey } },
    update: {
      name: name ?? DEFAULT_BOARD_NAME,
    },
    create: {
      tenantId,
      boardKey,
      name: name ?? DEFAULT_BOARD_NAME,
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tenantId: string; boardKey: string } }
) {
  const tenantSlug = params.tenantId;
  const boardKey = params.boardKey;

  console.log('[API][GET /nodes] request', { tenantSlug, boardKey });

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.log('[API][GET /nodes] tenant not found', { tenantSlug });
    return NextResponse.json({ board: null, graph: { nodes: [], edges: [] } });
  }

  const board = await prisma.board.findUnique({
    where: { tenantId_boardKey: { tenantId: tenant.id, boardKey } },
  });

  if (!board) {
    return NextResponse.json({
      board: null,
      graph: { nodes: [], edges: [] },
    });
  }

  const nodes = await prisma.node.findMany({
    where: { boardId: board.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log('[API][GET /nodes] board loaded', {
    boardId: board.id,
    nodeCount: nodes.length,
  });

  const graph = buildGraphFromNodes(nodes.map((node) => ({
    id: node.id,
    nodeKey: node.nodeKey ?? null,
    content: node.content,
    category: node.category,
    x: node.x,
    y: node.y,
    adopted: node.adopted,
    createdAt: node.createdAt,
    prevNodes: node.prevNodes,
    nextNodes: node.nextNodes,
    // uiHeight: node.uiHeight, // TODO: マイグレーション後に有効化
  })));

  return NextResponse.json({
    board: {
      id: board.id,
      boardKey: board.boardKey,
      name: board.name,
      tenantId: tenant.slug,
    },
    graph,
  });
}

async function getCurrentUser(session: Session | null) {
  if (!session?.user?.email) return null;

  return await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true, tenantId: true }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { tenantId: string; boardKey: string } }
) {
  const tenantSlug = params.tenantId;
  const boardKey = params.boardKey;

  console.log('[API][PUT /nodes] request', {
    tenantSlug,
    boardKey,
  });

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: PutPayload;
  try {
    payload = (await request.json()) as PutPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!payload?.graph || !Array.isArray(payload.graph.nodes) || !Array.isArray(payload.graph.edges)) {
    return NextResponse.json({ error: 'Invalid graph payload' }, { status: 400 });
  }

  const tenant = await ensureTenant(tenantSlug);
  const board = await ensureBoard(tenant.id, boardKey, payload.name ?? boardKey);

  const currentUser = await getCurrentUser(session);
  if (!currentUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { nodes, edges } = payload.graph;
  console.log('[API][PUT /nodes] payload sizes', {
    nodeCount: nodes.length,
    edgeCount: edges.length,
  });
  const depthMap = calcDepths(nodes, edges);

  await prisma.$transaction(async (tx) => {
    // 既存ノードの編集履歴を保存
    const existingNodes = await tx.node.findMany({
      where: { boardId: board.id },
      select: {
        id: true,
        nodeKey: true,
        content: true,
        category: true,
        x: true,
        y: true,
        adopted: true,
        prevNodes: true,
        nextNodes: true
      }
    });

    // 削除されるノードの履歴を保存
    for (const existingNode of existingNodes) {
      await tx.nodeEdit.create({
        data: {
          nodeId: existingNode.id,
          userId: currentUser.id,
          action: 'delete',
          beforeData: {
            id: existingNode.nodeKey || existingNode.id,
            content: existingNode.content,
            category: existingNode.category,
            x: existingNode.x,
            y: existingNode.y,
            adopted: existingNode.adopted,
            prevNodes: existingNode.prevNodes,
            nextNodes: existingNode.nextNodes
          }
        }
      });
    }

    await tx.node.deleteMany({ where: { boardId: board.id } });

    if (!nodes.length) {
      return;
    }

    const nodeData = nodes.map((node) => {
      const prevNodes = edges.filter((e) => e.target === node.id).map((e) => e.source);
      const nextNodes = edges.filter((e) => e.source === node.id).map((e) => e.target);

      return {
        id: randomUUID(),
        tenantId: tenant.id,
        boardId: board.id,
        nodeKey: node.id,
        content: (node.label !== undefined && node.label !== '') ? node.label : '',
        depth: depthMap[node.id] ?? 0,
        category: mapNodeTypeToCategory(node.type),
        tags: [] as string[],
        prevNodes,
        nextNodes,
        x: Number.isFinite(node.x) ? node.x : 0,
        y: Number.isFinite(node.y) ? node.y : 0,
        adopted: Boolean(node.adopted),
      };
    });

    if (nodeData.length) {
      await tx.node.createMany({ data: nodeData });

      // 新しく作成されたノードの履歴を保存
      const newNodes = await tx.node.findMany({
        where: { boardId: board.id },
        select: {
          id: true,
          nodeKey: true,
          content: true,
          category: true,
          x: true,
          y: true,
          adopted: true,
          prevNodes: true,
          nextNodes: true
        }
      });

      for (const newNode of newNodes) {
        await tx.nodeEdit.create({
          data: {
            nodeId: newNode.id,
            userId: currentUser.id,
            action: 'create',
            afterData: {
              id: newNode.nodeKey || newNode.id,
              content: newNode.content,
              category: newNode.category,
              x: newNode.x,
              y: newNode.y,
              adopted: newNode.adopted,
              prevNodes: newNode.prevNodes,
              nextNodes: newNode.nextNodes
            }
          }
        });
      }
    }
  });

  console.log('[API][PUT /nodes] persisted', {
    boardId: board.id,
    nodeCount: nodes.length,
  });

  const refreshedNodes = await prisma.node.findMany({
    where: { boardId: board.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log('[API][PUT /nodes] returning graph', {
    nodeCount: refreshedNodes.length,
  });

  const graph = buildGraphFromNodes(refreshedNodes.map((node) => ({
    id: node.id,
    nodeKey: node.nodeKey ?? null,
    content: node.content,
    category: node.category,
    x: node.x,
    y: node.y,
    adopted: node.adopted,
    createdAt: node.createdAt,
    prevNodes: node.prevNodes,
    nextNodes: node.nextNodes,
  })));

  return NextResponse.json({
    board: {
      id: board.id,
      boardKey: board.boardKey,
      name: board.name,
      tenantId: tenant.slug,
    },
    graph,
  });
}
