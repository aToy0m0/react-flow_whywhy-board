import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { WhyNodeData, NodeType } from "@/components/boardTypes";
import type { SerializedGraph, SerializedNode, SerializedEdge } from "@/components/boardActions";

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
    const rootTyped = nodes.filter((n) => n.data?.type === ("root" as any)).map((n) => n.id);
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

  const obj: any = {
    board: { tenantid: tenantId, boardid: boardId },
    nodes: nodes.map((n) => ({
      tenantid: tenantId,
      boardid: boardId,
      nodeid: n.id,
      content: String(n.data.label ?? ""),
      depth: depthMap[n.id] ?? 0,
      category: toCategory(n.data.type),
      adopted: typeof n.data.adopted === "boolean" ? n.data.adopted : undefined,
      uiHeight: (n as any).measured?.height ?? (n as any).height ?? undefined,
      tags: [],
      prevNodes: edges.filter((e) => e.target === n.id).map((e) => e.source),
      nextNodes: edges.filter((e) => e.source === n.id).map((e) => e.target),
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      parent: parentOf(n.id, edges) ?? undefined,
    })),
    edges: edges.map((e) => ({ tenantid: tenantId, boardid: boardId, source: e.source, target: e.target })),
  };

  // 公式TOMLライブラリで安全にシリアライズ（複数行・エスケープ対応）
  const { stringify } = require("@iarna/toml");
  return stringify(obj);
}

export async function fromToml(text: string): Promise<SerializedGraph> {
  // Prefer @iarna/toml if available
  let parsed: any;
  try {
    const toml = await import("@iarna/toml");
    parsed = toml.parse(text);
  } catch {
    // Fallback very naive parser for this specific structure
    parsed = naiveParseToml(text);
  }
  const boardId: string | undefined = parsed?.board?.boardid ?? parsed?.board?.id;
  const ns: any[] = parsed?.nodes ?? [];
  const es: any[] = parsed?.edges ?? [];
  const toNodeType = (cat?: string, id?: string): NodeType => {
    const c = String(cat ?? "").toUpperCase();
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
  const nodes: SerializedNode[] = ns.map((n, i) => {
    const type = toNodeType(String(n.category), n.nodeid ?? n.id);
    const hasAdopted = n.adopted !== undefined;
    const adopted = hasAdopted ? Boolean(n.adopted) : type === "cause";
    return {
      id: String(n.nodeid ?? n.id),
      x: Number(n.x ?? 0),
      y: Number(n.y ?? 0),
      label: String(n.content ?? n.label ?? ""),
      type,
      adopted,
      // 読み込み出現順を createdAt に反映（安定ソート用）
      createdAt: Date.now() + i,
      uiHeight: typeof n.uiHeight === 'number' ? Number(n.uiHeight) : undefined,
    } as SerializedNode;
  });
  let edges: SerializedEdge[] = es.map((e) => ({ id: `e_${e.source}_${e.target}`, source: String(e.source), target: String(e.target) }));
  if (!edges.length) {
    // Generate edges from parent
    nodes.forEach((n) => {
      const raw = ns.find((r) => String(r.nodeid ?? r.id) === n.id);
      const p = (raw as any)?.parent;
      if (p) edges.push({ id: `e_${String(p)}_${n.id}`, source: String(p), target: n.id });
    });
  }
  return { nodes, edges };
}

function naiveParseToml(text: string): any {
  const lines = text.split(/\r?\n/);
  const out: any = { nodes: [], edges: [] };
  let cur: any | null = null;
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
    const m = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (!m) continue;
    const key = m[1];
    let value: any = m[2];
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    } else if (/^[-\d.]+$/.test(value)) {
      value = Number(value);
    }
    if (section === "nodes" || section === "edges" || section === "board") {
      cur![key] = value;
    }
  }
  return out;
}
