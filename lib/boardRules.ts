import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { WhyNodeData, NodeType } from "@/components/boardTypes";

export function setChildAdopted(
  nodes: RFNode<WhyNodeData>[],
  childId: string,
  adopted: boolean
): RFNode<WhyNodeData>[] {
  return nodes.map((n) => (n.id === childId ? { ...n, data: { ...n.data, adopted } } : n));
}

export function recomputeParentAfterAdoption(
  nodes: RFNode<WhyNodeData>[],
  edges: RFEdge[],
  parentId?: string
): RFNode<WhyNodeData>[] {
  if (!parentId || parentId === "root") return nodes;
  const childIds = edges.filter((e) => e.source === parentId).map((e) => e.target);
  const anyAdopted = nodes.some((n) => childIds.includes(n.id) && !!n.data.adopted);
  return nodes.map((n) =>
    n.id !== parentId
      ? n
      : {
          ...n,
          data: {
            ...n.data,
            type: (anyAdopted ? "cause" : "why") as NodeType,
            adopted: anyAdopted,
          },
        }
  );
}
