"use client";
// MARK: WhyBoardCanvas — WhyWhy Board のキャンバス本体（@xyflow/react 利用）
// MARK: 依存（xyflow の主要API）
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  addEdge,
  Connection,
  ConnectionMode,
  MarkerType,
  OnConnectStart,
  OnConnectEnd,
  useReactFlow,
  ReactFlowProvider,
  // NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
// MARK: 依存（React / ローカルモジュール）
import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { Node as RFNode, Edge as RFEdge, NodeChange, Viewport } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { WhyNode } from "./WhyNode";
import type { WhyNodeData, NodeType } from "./boardTypes";
import type { BoardHandle } from "./boardActions";
import { serializeGraph, deserializeGraph, toToml, fromToml } from "@/lib/boardIO";
import { parentOf } from "@/lib/boardIO";
import { getChildrenSorted, computeLayoutForParent } from "@/lib/boardLayout";
import { setChildAdopted } from "@/lib/boardRules";
import { useContextMenu } from "@/hooks/useContextMenu";
import { EDGE_TYPE, STEP_EDGE_OFFSET, STEP_EDGE_RADIUS, X_COL_GAP, Y_ROW_GAP, CONNECT_RADIUS, FITVIEW_PADDING, DEFAULT_VIEWPORT, DEFAULT_ROOT_POS } from "@/lib/layoutConstants";

// MARK: Props / 型エイリアス
type Props = { boardId: string };

type WNode = RFNode<WhyNodeData>;

// MARK: ノードレンダラーのマップ
const nodeTypes: any = { why: WhyNode };

// MARK: CanvasInner — ReactFlow の Provider 配下で動く本体
function CanvasInner({ boardId }: Props, ref: React.Ref<BoardHandle>) {
  const rf = useReactFlow();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode<WhyNodeData>>([
    {
      id: "root",
      type: "why",
      position: { x: DEFAULT_ROOT_POS.x, y: DEFAULT_ROOT_POS.y },
      data: {
        label: "",
        type: "root",
        adopted: false,
        boardId,
        hasChildren: () => false,
        onChangeLabel: (id, v) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: v } } : n))),
        onToggleAdopted: undefined,
        getParentInfo: () => ({}),
        canDelete: (id) => id !== "root",
        onDelete: () => {},
        onAddChild: () => {},
        openMenu: () => {},
        closeMenu: () => {},
        isMenuOpen: false,
      },
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const { menuOpenFor, openMenu, closeMenu } = useContextMenu(setNodes);

  // MARK: 接続ドラッグ中の接続元ノードIDを保持
  const connectingFrom = useRef<string | null>(null);
  // 直近に onConnect が成立したか（ハンドル同士の接続時は新規ノード追加を抑止）
  const didConnectRef = useRef<boolean>(false);

  // MARK: クエリ — 親 -> 子（作成順で安定ソート）
  const getChildren = useCallback((parentId: string) => getChildrenSorted(nodes, edges, parentId), [nodes, edges]);

  // MARK: クエリ — 子 -> 親
  const getParent = useCallback((id: string) => parentOf(id, edges), [edges]);

  const getParentInfo = useCallback(
    (id: string) => {
      const parentId = getParent(id);
      if (!parentId) return {};
      const parent = nodes.find((n) => n.id === parentId);
      const siblings = getChildren(parentId);
      const index = siblings.findIndex((s) => s.id === id) + 1; // なぜX の X
      return { parentLabel: parent?.data.label, index };
    },
    [getParent, nodes, getChildren]
  );

  // MARK: 変更ヘルパー — node.data をパッチ
  const updateNodeData = useCallback(
    (id: string, patch: Partial<WhyNodeData>) =>
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))),
    [setNodes]
  );



  // MARK: アクション — 採用トグル（なぜ<->原因 の切替）
  const onToggleAdopted = useCallback(
    (id: string, value: boolean) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, adopted: value, type: (value ? "cause" : "why") as NodeType } }
            : n
        )
      );
    },
    []
  );

  // MARK: ノード強化 — コールバック/状態を data に注入
  const enhanceNode = useCallback(
    (n: WNode): WNode => ({
      ...n,
      data: {
        ...n.data,
        boardId,
        getParentInfo,
        hasChildren: (id: string) => edges.some((e) => e.source === id),
        hasCauseDescendant: (id: string) => {
          const visited = new Set<string>();
          const stack = edges.filter((e) => e.source === id).map((e) => e.target);
          while (stack.length) {
            const cur = stack.pop()!;
            if (visited.has(cur)) continue;
            visited.add(cur);
            const node = nodes.find((nn) => nn.id === cur);
            if (node?.data.type === 'cause') return true;
            edges.filter((e) => e.source === cur).forEach((e) => stack.push(e.target));
          }
          return false;
        },
        canDelete: (id: string) => id !== "root",
        onDelete: (id: string) => deleteNode(id),
        onChangeLabel: (id: string, v: string) =>
          setNodes((nds) => nds.map((nn) => (nn.id === id ? { ...nn, data: { ...nn.data, label: v } } : nn))),
        onToggleAdopted,
        onAddChild: (parentId: string, type?: NodeType) => {
          try {
            console.log('[WhyBoard] onAddChild called', { callerNodeId: n.id, parentId, requestedType: type, nodesCount: nodes.length, edgesCount: edges.length });
          } catch {}
          addChildNodeRef.current(parentId, type);
        },
        openMenu: (id: string) => openMenu(id),
        closeMenu: () => closeMenu(),
        isMenuOpen: n.id === menuOpenFor,
      },
    }),
    [boardId, getParentInfo, onToggleAdopted, setNodes, menuOpenFor, openMenu, closeMenu, edges]
  );

  // MARK: アクション — ノード削除（関連エッジも削除）
  const deleteNode = useCallback(
    (id: string) => {
      if (id === "root") return;
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setNodes((nds) => nds.filter((n) => n.id !== id));
    },
    [setNodes, setEdges]
  );

  /**
   * MARK: 子ノード追加（空白ドロップ/メニュー）
   * - 配置: 親の右 (+360px)、Y は兄弟数 * 120px（作成順で安定）
   * - 種別: 親が cause のときに typeOverride==='action' を尊重。それ以外は常に 'why'
   * - エッジ: smoothstep + ArrowClosed
   * - 整列: 追加後に同一親の子を等間隔に再整列
   */
  const addChildNode = useCallback(
    (parentId: string, typeOverride?: NodeType) => {
      const parent = nodes.find((n) => n.id === parentId);
      try {
        console.log('[WhyBoard] addChildNode enter', { parentId, parentFound: !!parent, typeOverride, nodesCount: nodes.length, edgesCount: edges.length });
      } catch {}
      if (!parent) return;
      const siblings = getChildren(parentId);
      const idx = siblings.length; // 0-based for positioning
      const baseX = parent.position.x + X_COL_GAP;
      const baseY = parent.position.y + idx * Y_ROW_GAP;
      const childId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      let type: NodeType;
      // ルール: 原因ノードの子のみ対策(action)、それ以外は常に「なぜ」(why)
      if (typeOverride === "cause") {
        type = "cause";
      } else if (parent.data.type === "cause" && typeOverride === "action") {
        type = "action";
      } else {
        type = "why";
      }
      const adopted = type === "cause" ? true : false;
      try {
        console.log('[WhyBoard] addChildNode decide', { parentType: parent.data.type, resolvedType: type, idx, baseX, baseY, siblingsIds: siblings.map(s => s.id) });
      } catch {}

      const newNode: WNode = enhanceNode({
        id: childId,
        type: "why",
        position: { x: baseX, y: baseY },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: "",
          type,
          adopted,
          boardId,
          createdAt: Date.now(),
          onChangeLabel: () => {},
          onToggleAdopted: () => {},
          getParentInfo: () => ({}),
          canDelete: () => true,
          onDelete: () => {},
          hasChildren: () => false,
          onAddChild: () => {},
          openMenu: () => {},
          closeMenu: () => {},
          isMenuOpen: false,
        },
      });

      setNodes((nds) => nds.concat(newNode));
      setEdges((eds) =>
        addEdge(
          {
            id: `e_${parentId}_${childId}`,
            source: parentId,
            target: childId,
            type: EDGE_TYPE as any,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      );
      try { console.log('[WhyBoard] addChildNode added', { childId }); } catch {}

      // 整列: 追加後に同一親の子を等間隔に再配置
      setTimeout(() => layoutChildren(parentId), 0);
    },
    [nodes, getChildren, setNodes, setEdges, enhanceNode, boardId]
  );

  // 最新の addChildNode を参照するための ref（古いクロージャ回避）
  const addChildNodeRef = useRef<(parentId: string, type?: NodeType) => void>(() => {});
  useEffect(() => {
    addChildNodeRef.current = (pid: string, t?: NodeType) => addChildNode(pid, t);
  }, [addChildNode]);

  // MARK: XYFlow — 既存ハンドル同士の接続（エッジのみ追加）
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      try { console.log('[WhyBoard] onConnect', connection); } catch {}
      setEdges((eds) => addEdge({ ...connection, type: EDGE_TYPE as any, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
      didConnectRef.current = true;
    },
    [setEdges]
  );

  // MARK: XYFlow — 右ハンドルからのドラッグ開始。接続元の nodeId を保持
  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    connectingFrom.current = params.nodeId ?? null;
    didConnectRef.current = false;
    try { console.log('[WhyBoard] onConnectStart', params); } catch {}
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const targetEl = event.target as HTMLElement;
      const pane = targetEl?.closest(".react-flow__pane");
      const hitHandle = targetEl?.closest('.react-flow__handle');
      try { console.log('[WhyBoard] onConnectEnd', { paneHit: !!pane, handleHit: !!hitHandle, connectingFrom: connectingFrom.current, didConnect: didConnectRef.current }); } catch {}
      if (!hitHandle && pane && connectingFrom.current && !didConnectRef.current) {
        // 空白ペインへドロップ: 子ノードを作成（原因の場合は対策を生成）
        const parent = nodes.find((n) => n.id === connectingFrom.current);
        const override: NodeType | undefined = parent?.data.type === 'cause' ? 'action' : undefined;
        addChildNode(connectingFrom.current, override);
      }
      connectingFrom.current = null;
      didConnectRef.current = false;
    },
    [addChildNode, nodes]
  );

  // // MARK: ビューポート — 初回のみ fitView（ルートノードのみのとき）
  // useEffect(() => {
  //   if (nodes.length === 1) {
  //     const timer = setTimeout(() => rf.fitView({ padding: 0.2 }), 0);
  //     return () => clearTimeout(timer);
  //   }
  // }, [nodes.length, rf]);

  // MARK: ビューポート — 保存/復元（localStorage）
  useEffect(() => {
    const key = `viewport_${boardId}`;
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (raw) {
      try {
        const v = JSON.parse(raw) as { x: number; y: number; zoom: number };
        rf.setViewport({ x: v.x, y: v.y, zoom: v.zoom });
        return;
      } catch {}
    }
    // 既定ビューポートを適用
    try { rf.setViewport(DEFAULT_VIEWPORT); } catch {}
  }, [rf, boardId]);

  // MARK: ビューポート — onMoveEnd で保存
  const onMoveEnd = useCallback(
    (_: any, viewport: Viewport) => {
      const key = `viewport_${boardId}`;
      localStorage.setItem(key, JSON.stringify(viewport));
    },
    [boardId]
  );

  // MARK: エッジ既定（step + ArrowClosed）: 直交エッジに変更し、オフセットで縦線位置に余白
  const defaultEdgeOptions = useMemo(
    () => ({
      type: EDGE_TYPE,
      markerEnd: { type: MarkerType.ArrowClosed },
      pathOptions: { offset: STEP_EDGE_OFFSET, borderRadius: STEP_EDGE_RADIUS },
    }),
    []
  );

  // MARK: レイアウト — 親の右に子を等間隔 / 原因は最深子Yに揃える
  const layoutChildren = useCallback(
    (parentId: string) => setNodes((nds) => computeLayoutForParent(nds, edges, parentId)),
    [edges]
  );

  // MARK: ノード変更 — 影響親の再整列（自由移動を優先するため実行は抑止）
  const onNodesChangeWithLayout = useCallback(
    (changes: import("@xyflow/react").NodeChange<RFNode<WhyNodeData>>[]) => {
      onNodesChange(changes);
      const affectedParents = new Set<string>();
      changes.forEach((c) => {
        if (c.type === "position" && c.position) {
          const parentId = getParent(c.id);
          affectedParents.add(parentId ?? c.id);
        }
      });
      // NOTE: 子の自由移動を許可するため、移動直後の自動整列はオフ
      // 再度オンにしたい場合は以下を有効化
      // affectedParents.forEach((id) => layoutChildren(id));
    },
    [onNodesChange, layoutChildren, getParent]
  );

  // 初期ノードへコールバックを付与
  useEffect(() => {
    setNodes((nds) => nds.map((n) => enhanceNode(n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // メニュー表示状態をノードデータへ反映
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isMenuOpen: n.id === menuOpenFor } })));
  }, [menuOpenFor, setNodes]);

  // MARK: BoardHandle — ヘッダーから呼び出す公開API
  useImperativeHandle(ref, () => ({
    saveLocal: () => {
      // JSON ではなく TOML を保存
      const text = toToml(boardId, nodes, edges);
      localStorage.setItem("whywhy-board", text);
    },
    loadLocal: () => {
      // TOML テキストとして読み込み
      const raw = localStorage.getItem("whywhy-board");
      if (!raw) return;
      try {
        const s = { nodes: [], edges: [] } as any;
        // TOML を解析してグラフ化
        // 既存 fromToml を利用
        // 直接 importTomlText と同処理
        (async () => {
          const parsed = await fromToml(raw);
          const { nodes: n2, edges: e2 } = deserializeGraph(parsed, enhanceNode);
          setNodes(n2);
          setEdges(e2);
          setTimeout(() => rf.fitView({ padding: FITVIEW_PADDING }), 0);
        })();
      } catch {}
    },
    exportToml: () => {
      const text = toToml(boardId, nodes, edges);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `board-${boardId}.toml`;
      a.click();
      URL.revokeObjectURL(url);
    },
    importTomlText: async (text: string) => {
      try {
        const s = await fromToml(text);
        const { nodes: n2, edges: e2 } = deserializeGraph(s, enhanceNode);
        setNodes(n2);
        setEdges(e2);
        setTimeout(() => rf.fitView({ padding: FITVIEW_PADDING }), 0);
      } catch (e) {
        console.error(e);
      }
    },
    exportPng: async () => {
      // React Flow 公式のダウンロード例に沿って、
      // 1) 現在のビューポートを保存
      // 2) 全ノードが収まるように fitBounds でビューポートを合わせる
      // 3) .react-flow__viewport を html-to-image で PNG 化
      // 4) 元のビューポートへ復元
      const root = containerRef.current;
      if (!root) return;

      const prev = rf.getViewport();
      const nodesForBounds = rf.getNodes();
      const viewportEl = root.querySelector('.react-flow__viewport') as HTMLElement | null;

      try {
        // ノードが1つも無い場合はそのままコンテナを撮る
        if (nodesForBounds.length) {
          const bounds = rf.getNodesBounds(nodesForBounds);
          // 即時反映（アニメーション無し）
          await rf.fitBounds(bounds, { padding: 0.1, duration: 0 });
          // レイアウト反映を1フレーム待つ
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }

        const mod = await import('html-to-image');
        const target = viewportEl ?? root;
        const dataUrl = await mod.toPng(target, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
        });

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `board-${boardId}.png`;
        a.click();
      } catch (e) {
        console.error(e);
        alert('PNG エクスポートに失敗しました。依存関係のインストールを確認してください。');
      } finally {
        // ビューポートを元に戻す（アニメーション無し）
        try { await rf.setViewport(prev, { duration: 0 }); } catch {}
      }
    },
    clearBoard: () => {
      // rootノードを再生成（enhanceNodeでコールバックを注入）
      const root = enhanceNode({
        id: 'root',
        type: 'why',
        position: { x: DEFAULT_ROOT_POS.x, y: DEFAULT_ROOT_POS.y },
        data: {
          label: '',
          type: 'root',
          adopted: false,
          boardId,
          createdAt: Date.now(),
          // 以下ダミー。enhanceNodeで正しい関数に入れ替わります
          onChangeLabel: () => {},
          onToggleAdopted: () => {},
          getParentInfo: () => ({}),
          canDelete: () => true,
          onDelete: () => {},
          onAddChild: () => {},
          hasChildren: () => false,
          openMenu: () => {},
          closeMenu: () => {},
          isMenuOpen: false,
        },
      });
      setNodes([root]);
      setEdges([]);
      // 視点リセット（任意）
      try { rf.setViewport({ x: 0, y: 0, zoom: 1 }); } catch {}
      setTimeout(() => rf.fitView({ padding: FITVIEW_PADDING }), 0);
    },
    relayoutAll: () => {
      // すべての親ノード（エッジのsource）について順に整列
      const parentIds = Array.from(new Set(edges.map(e => e.source)));
      setNodes(prev =>
        parentIds.reduce((acc, pid) => computeLayoutForParent(acc, edges, pid), prev)
      );
    },
    fitView: () => {
      try { rf.fitView({ padding: FITVIEW_PADDING }); } catch {}
    },
  }));

  // MARK: Render
  return (
    <div ref={containerRef} className="w-full h-[calc(100vh-64px)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithLayout}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onMoveEnd={onMoveEnd}
        onPaneClick={() => closeMenu()}
        connectionMode={ConnectionMode.Strict}
        connectionRadius={28}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView={false}
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
}

// MARK: Provider 境界越しに ref を渡すラッパー
const InnerWithRef = forwardRef<BoardHandle, Props>(CanvasInner);

// MARK: エクスポート — ReactFlowProvider で内側を包む
const WhyBoardCanvas = forwardRef<BoardHandle, Props>(function WhyBoardCanvas({ boardId }, ref) {
  return (
    <ReactFlowProvider>
      <InnerWithRef ref={ref} boardId={boardId} />
    </ReactFlowProvider>
  );
});

export default WhyBoardCanvas;
