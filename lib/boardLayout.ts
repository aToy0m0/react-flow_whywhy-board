// MARK: boardLayout – ノード座標の算出（整列ロジック集約）
// 目的:
//  - 親ノードの右側に子ノードを等間隔で配置
//  - 原因ノード（cause）は、その最も深い子孫のY座標に揃える（視覚的な「原因列」を形成）
//  - 複数の原因ノードが同じYに重ならないよう、わずかに上下に分散
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { WhyNodeData } from "@/components/boardTypes";
import { X_COL_GAP, BASE_NODE_HEIGHT, LINE_HEIGHT, SIBLING_BLOCK_PAD } from "@/lib/layoutConstants";

/**
 * MARK: getChildrenSorted — 親 → 子を取得し、作成順（createdAt）で安定ソート
 * - ノード追加順が視覚上の並び順に反映されるよう、createdAt の昇順で整列
 */
export function getChildrenSorted(
  nodes: RFNode<WhyNodeData>[],
  edges: RFEdge[],
  parentId: string
): RFNode<WhyNodeData>[] {
  return edges
    .filter((e) => e.source === parentId)
    .map((e) => nodes.find((n) => n.id === e.target)!)
    .filter(Boolean)
    .sort((a, b) => (a.data.createdAt ?? 0) - (b.data.createdAt ?? 0));
}

/**
 * MARK: computeLayoutForParent — 親ノード配下の座標を一括再計算
 * ルール:
 *  - X 座標: 親の右 +360px
 *  - Y 座標: 兄弟インデックス * 120px（getChildrenSorted の順）
 *  - 原因（cause）: 最も深い子孫のYを求め、そのY(targetY)を基準に縦位置を揃える。
 *                   さらに SPREAD により上下方向にわずかに分散し、重なりを回避。
 */
export function computeLayoutForParent(
  nodes: RFNode<WhyNodeData>[],
  edges: RFEdge[],
  parentId: string
): RFNode<WhyNodeData>[] {
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return nodes;
  const children = getChildrenSorted(nodes, edges, parentId);
  if (!children.length) return nodes;

  // 子のX座標は親の右側へシフト
  const baseX = parent.position.x + X_COL_GAP;

  // 子孫探索用マップの構築
  const nodesById = new Map(nodes.map((n) => [n.id, n] as const));
  const childrenMap = new Map<string, string[]>();
  edges.forEach((e) => {
    const arr = childrenMap.get(e.source) ?? [];
    arr.push(e.target);
    childrenMap.set(e.source, arr);
  });

  // MARK: 分岐サイズ（branchSize）を計算
  // - 葉は 1
  // - それ以外は 子の branchSize の総和
  const memo = new Map<string, number>();
  const branchSize = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const kids = childrenMap.get(id) ?? [];
    if (!kids.length) {
      memo.set(id, 1);
      return 1;
    }
    const sum = kids.reduce((acc, k) => acc + branchSize(k), 0);
    memo.set(id, Math.max(1, sum));
    return memo.get(id)!;
  };

  // ノードの実高さを概算（複数行テキストに対応）
  // 高さ推定の定数（layoutConstants から参照）
  const BASE_H = BASE_NODE_HEIGHT; // ヘッダ+1行相当
  const LINE_H = LINE_HEIGHT;      // 追行分の高さ
  const SIB_PAD = SIBLING_BLOCK_PAD; // 兄弟ブロック間のパディング

  // 実測サイズ（ReactFlow が計測した height）を優先し、無ければTOMLからのheightHint→ラベル行数で概算
  const estimateHeight = (id: string): number => {
    const node: any = nodesById.get(id);
    if (!node) return BASE_H + SIB_PAD;
    const measured = (node.measured && node.measured.height) || node.height || node.data?.heightHint;
    if (typeof measured === "number" && measured > 0) {
      return Math.ceil(measured) + SIB_PAD;
    }
    const lines = Math.max(1, String(node.data.label ?? "").split(/\r?\n/).length);
    return BASE_H + (lines - 1) * LINE_H + SIB_PAD;
  };

  // ブロック高さ: 葉は自身の高さ+パディング、親は子ブロック合計と自身の高さの最大
  const nodeBlockHeight = (id: string): number => {
    const kids = childrenMap.get(id) ?? [];
    const own = estimateHeight(id);
    if (!kids.length) return own;
    const sumKids = kids.reduce((acc, k) => acc + nodeBlockHeight(k), 0);
    return Math.max(own, sumKids);
  };

  const childHeights = children.map((c) => nodeBlockHeight(c.id));
  const totalHeight = childHeights.reduce((a, b) => a + b, 0);

  // 親Yを上端（トップ）として、子ブロックを下方向に積む
  // Web座標系はYが下方向に増えるため、"上に寄せる" には親Yを起点に正方向へ配置します。
  let cursor = parent.position.y;

  // まず子のYを「ブロックの最上部（top）」に合わせて配置
  const updated = nodes.map((n) => {
    const idx = children.findIndex((c) => c.id === n.id);
    if (idx === -1) return n;
    const h = childHeights[idx];
    const topY = cursor;
    cursor += h; // 次ブロックの開始位置に進める
    return { ...n, position: { x: baseX, y: topY } };
  });

  // 次に「原因ノードの縦列を『最も右にあるWhy列の一つ右』のXに合わせる」
  const maxWhyX = Math.max(
    -Infinity,
    ...updated.filter((n) => n.data.type === "why").map((n) => n.position.x)
  );
  if (isFinite(maxWhyX)) {
    const causeX = maxWhyX + X_COL_GAP; // 列幅と同じだけ右へ
    return updated.map((n) =>
      n.data.type === "cause" ? { ...n, position: { ...n.position, x: causeX } } : n
    );
  }
  return updated;
}
