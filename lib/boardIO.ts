import { stringify } from "@iarna/toml";
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { WhyNodeData, NodeType } from "@/components/boardTypes";
import type { SerializedGraph, SerializedNode, SerializedEdge } from "@/components/boardActions";

type NodeWithMeasurements = RFNode<WhyNodeData> & {
  measured?: { height?: number };
  height?: number;
};

type TomlExportNode = {
  tenantid: string;
  boardid: string;
  nodeid: string;
  content: string;
  depth: number;
  category: "Root" | "Why" | "Cause" | "Action";
  adopted?: boolean;
  uiHeight?: number;
  tags: string[];
  prevNodes: string[];
  nextNodes: string[];
  x: number;
  y: number;
  parent?: string;
};

type TomlExport = {
  board: { tenantid: string; boardid: string };
  nodes: TomlExportNode[];
  edges: Array<{ tenantid: string; boardid: string; source: string; target: string }>;
};

type ParsedToml = {
  board?: Record<string, unknown>;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
};

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const toNumberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const toBooleanOrUndefined = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return undefined;
};

export function serializeGraph(nodes: RFNode<WhyNodeData>[], edges: RFEdge[]): SerializedGraph {
  const sNodes: SerializedNode[] = nodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    label: n.data.label,
    type: n.data.type,
    adopted: n.data.adopted,
    createdAt: n.data.createdAt,
  }));
  const sEdges: SerializedEdge[] = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
  return { nodes: sNodes, edges: sEdges };
}

export function deserializeGraph(
  data: SerializedGraph,
  enhance: (n: RFNode<WhyNodeData>) => RFNode<WhyNodeData>
): { nodes: RFNode<WhyNodeData>[]; edges: RFEdge[] } {
  const nodes: RFNode<WhyNodeData>[] = data.nodes.map((sn) =>
    enhance({
      id: sn.id,
      type: "why",
      position: { x: sn.x, y: sn.y },
      data: {
        label: sn.label,
        type: sn.type as NodeType,
        adopted: sn.adopted,
        boardId: "",
        createdAt: sn.createdAt,
        heightHint: sn.uiHeight,
        hasChildren: () => false,
        // dummy, overwritten by enhance
        onChangeLabel: () => {},
        onToggleAdopted: () => {},
        getParentInfo: () => ({}),
        canDelete: () => true,
        onDelete: () => {},
        onAddChild: () => {},
        openMenu: () => {},
        closeMenu: () => {},
        isMenuOpen: false,
      },
    })
  );
  const edges: RFEdge[] = data.edges.map((se) => ({ id: se.id, source: se.source, target: se.target }));
  return { nodes, edges };
}

// Depth calculation for TOML
export function calcDepths(
  nodes: RFNode<WhyNodeData>[],
  edges: RFEdge[],
  rootId?: string
): Record<string, number> {
  const depth: Record<string, number> = {};

  // Build children map and indegree map
  const childrenMap = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  nodes.forEach((n) => indegree.set(n.id, 0));
  edges.forEach((e) => {
    const arr = childrenMap.get(e.source) ?? [];
    arr.push(e.target);
    childrenMap.set(e.source, arr);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  });

  // Determine start nodes
  const hasId = (id?: string): id is string => !!id && nodes.some((n) => n.id === id);
  let starts: string[] = [];

  if (hasId(rootId)) {
    starts = [rootId!];
  } else {
    // Prefer nodes explicitly marked as type 'root'
    const rootTyped = nodes.filter((n) => n.data?.type === "root").map((n) => n.id);
    if (rootTyped.length) {
      starts = rootTyped;
    } else {
      // Fallback: nodes with no incoming edges
      const zeroIn = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
      if (zeroIn.length) {
        starts = zeroIn;
      } else if (nodes.length) {
        // Last resort: start from the first node
        starts = [nodes[0].id];
      }
    }
  }

  // Initialize depths for all start nodes (forest support)
  const queue: string[] = [];
  const visited = new Set<string>();
  for (const s of starts) {
    depth[s] = Math.min(depth[s] ?? 0, 0);
    queue.push(s);
  }

  // BFS from all starts
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

export function parentOf(id: string, edges: RFEdge[]): string | undefined {
  return edges.find((e) => e.target === id)?.source;
}

export function toToml(boardId: string, nodes: RFNode<WhyNodeData>[], edges: RFEdge[]): string {
  const tenantId = "local";
  const depthMap = calcDepths(nodes, edges);

  const toCategory = (t: NodeType): "Root" | "Why" | "Cause" | "Action" => {
    switch (t) {
      case "root":
        return "Root";
      case "action":
        return "Action";
      case "cause":
        return "Cause";
      case "why":
      default:
        return "Why";
    }
  };

  const exportNodes: TomlExportNode[] = nodes.map((node) => {
    const measuredNode = node as NodeWithMeasurements;
    const measuredHeight = typeof measuredNode.measured?.height === "number" ? measuredNode.measured.height : undefined;
    const fallbackHeight = typeof measuredNode.height === "number" ? measuredNode.height : undefined;
    const uiHeight = node.data.heightHint ?? measuredHeight ?? fallbackHeight;

    return {
      tenantid: tenantId,
      boardid: boardId,
      nodeid: node.id,
      content: String(node.data.label ?? ""),
      depth: depthMap[node.id] ?? 0,
      category: toCategory(node.data.type),
      adopted: typeof node.data.adopted === "boolean" ? node.data.adopted : undefined,
      uiHeight: uiHeight ?? node.data.heightHint ?? undefined,
      tags: [],
      prevNodes: edges.filter((edge) => edge.target === node.id).map((edge) => edge.source),
      nextNodes: edges.filter((edge) => edge.source === node.id).map((edge) => edge.target),
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
      parent: parentOf(node.id, edges) ?? undefined,
    };
  });

  const exportPayload: TomlExport = {
    board: { tenantid: tenantId, boardid: boardId },
    nodes: exportNodes,
    edges: edges.map((edge) => ({ tenantid: tenantId, boardid: boardId, source: edge.source, target: edge.target })),
  };

  // 公式TOMLライブラリで安全にシリアライズ（複数行・エスケープ対応）
  return stringify(exportPayload);
}

export async function fromToml(text: string): Promise<SerializedGraph> {
  let parsed: ParsedToml = { nodes: [], edges: [] };
  try {
    const toml = await import("@iarna/toml");
    const result = toml.parse(text) as ParsedToml;
    parsed = {
      board: result.board,
      nodes: Array.isArray(result.nodes) ? result.nodes : [],
      edges: Array.isArray(result.edges) ? result.edges : [],
    };
  } catch {
    parsed = naiveParseToml(text);
  }

  const nodeRecords = parsed.nodes ?? [];
  const edgeRecords = parsed.edges ?? [];

  const toNodeType = (categoryValue: unknown, id?: string): NodeType => {
    const c = toStringOrUndefined(categoryValue)?.toUpperCase() ?? "";
    switch (c) {
      case "ROOT":
      case "ROOT_CAUSE":
        return "root";
      case "WHY":
        return "why";
      case "CAUSE":
        return "cause";
      case "ACTION":
      case "ROOT_ACTION":
        return "action";
      default:
        return id === "root" ? "root" : "why";
    }
  };

  const nodes: SerializedNode[] = nodeRecords.map((record, index) => {
    const nodeId =
      toStringOrUndefined(record["nodeid"]) ??
      toStringOrUndefined(record["id"]) ??
      `node-${index}`;

    const type = toNodeType(record["category"], nodeId);
    const adopted = toBooleanOrUndefined(record["adopted"]) ?? (type === "cause");

    return {
      id: nodeId,
      x: toNumberOrUndefined(record["x"]) ?? 0,
      y: toNumberOrUndefined(record["y"]) ?? 0,
      label:
        toStringOrUndefined(record["content"]) ??
        toStringOrUndefined(record["label"]) ??
        "",
      type,
      adopted,
      createdAt: Date.now() + index,
      uiHeight: toNumberOrUndefined(record["uiHeight"]),
    } satisfies SerializedNode;
  });

  const edges: SerializedEdge[] = edgeRecords
    .map((record) => {
      const source = toStringOrUndefined(record["source"]);
      const target = toStringOrUndefined(record["target"]);
      if (!source || !target) return null;
      return { id: `e_${source}_${target}`, source, target };
    })
    .filter((edge): edge is SerializedEdge => edge !== null);

  if (!edges.length) {
    nodeRecords.forEach((record) => {
      const childId = toStringOrUndefined(record["nodeid"]) ?? toStringOrUndefined(record["id"]);
      const parentId = toStringOrUndefined(record["parent"]);
      if (childId && parentId) {
        edges.push({ id: `e_${parentId}_${childId}`, source: parentId, target: childId });
      }
    });
  }

  return { nodes, edges };
}

function naiveParseToml(text: string): ParsedToml {
  const lines = text.split(/\r?\n/);
  const out: ParsedToml = { nodes: [], edges: [] };
  let cur: Record<string, unknown> | null = null;
  let section: "nodes" | "edges" | "board" | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[nodes]]") {
      cur = {};
      out.nodes.push(cur);
      section = "nodes";
      continue;
    }
    if (line === "[[edges]]") {
      cur = {};
      out.edges.push(cur);
      section = "edges";
      continue;
    }
    if (line === "[board]") {
      cur = {};
      out.board = cur;
      section = "board";
      continue;
    }
    const match = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (!match) continue;
    const key = match[1];
    const rawValue = match[2];
    let value: string | number;
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      value = rawValue.slice(1, -1).replace(/\\"/g, '"');
    } else if (/^[-\d.]+$/.test(rawValue)) {
      value = Number(rawValue);
    } else {
      value = rawValue;
    }
    if ((section === "nodes" || section === "edges" || section === "board") && cur) {
      cur[key] = value;
    }
  }
  return out;
}
