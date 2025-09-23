"use client";
// MARK: WhyBoardCanvas — WhyWhy Board のキャンバス本体（@xyflow/react 利用）
// MARK: 依存（xyflow の主要API）
import {
  ReactFlow,
  Background,
  BackgroundVariant,
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
  getNodesBounds,
  getViewportForBounds,
  // NodeChange,
} from "@xyflow/react";
// MARK: 依存（React / ローカルモジュール）
import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { Node as RFNode, Edge as RFEdge, NodeChange, Viewport } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { WhyNode } from "./WhyNode";
import type { WhyNodeData, NodeType } from "./boardTypes";
import type { BoardHandle, SerializedGraph } from "./boardActions";
import { serializeGraph, deserializeGraph, toToml, fromToml } from "@/lib/boardIO";
import { parentOf } from "@/lib/boardIO";
import { getChildrenSorted, computeLayoutForParent } from "@/lib/boardLayout";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useSocket } from "../hooks/useSocket";
import { useNodeLock } from "../contexts/NodeLockContext";
import { useSession } from "next-auth/react";
import { EDGE_TYPE, STEP_EDGE_OFFSET, STEP_EDGE_RADIUS, X_COL_GAP, Y_ROW_GAP, FITVIEW_PADDING, DEFAULT_VIEWPORT, DEFAULT_ROOT_POS } from "@/lib/layoutConstants";

// MARK: Props / 型エイリアス
type Props = { 
  tenantId: string;
  boardId: string;
  style?: React.CSSProperties;
};

type WNode = RFNode<WhyNodeData>;

// MARK: ノードレンダラーのマップ
const nodeTypes: Record<string, typeof WhyNode> = { why: WhyNode };

const TOAST_DURATION_MS = 4000;

type ToastMessage = {
  id: string;
  text: string;
};

// MARK: CanvasInner — ReactFlow の Provider 配下で動く本体
function CanvasInner({ tenantId, boardId, style }: Props, ref: React.Ref<BoardHandle>) {
  const rf = useReactFlow();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tenantSlug = tenantId ?? process.env.NEXT_PUBLIC_TENANT_ID ?? 'default';

  // セッションとロック機能
  const session = useSession()?.data;
  const { lockNode, unlockNode } = useNodeLock();

  // 自動保存用のデバウンスタイマー
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Socket.IO統合（同時編集用、現在は無効化）
  const { lockNode: socketLockNode, unlockNode: socketUnlockNode } = useSocket({
    tenantId: tenantSlug,
    boardKey: boardId,
    userId: session?.user?.id || 'anonymous',
    onNodeLocked: (data) => {
      lockNode(data.nodeId, data.userId, data.userName, data.lockedAt);
    },
    onNodeUnlocked: (data) => {
      unlockNode(data.nodeId);
    },
    onNodeUpdated: (data) => {
      // 他のユーザーからのノード更新を反映
      setNodes(nds => nds.map(n =>
        n.id === data.nodeId
          ? { ...n, data: { ...n.data, label: data.content } }
          : n
      ));
    }
  });
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
        onUpdateHeight: () => {},
        openMenu: () => {},
        closeMenu: () => {},
        isMenuOpen: false,
      },
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const { menuOpenFor, openMenu, closeMenu } = useContextMenu(setNodes);
  const [, setIsRemoteSyncing] = useState(false);
  const mountedRef = useRef(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const apiEndpoint = useMemo(() => `/api/tenants/${tenantSlug}/boards/${boardId}/nodes`, [tenantSlug, boardId]);

  // 自動保存関数（既存のsaveRemote APIを使用）
  const autoSaveToRemote = useCallback(async () => {
    // 既存のタイマーをクリア
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    // 即時保存実行（同時編集対応のため）
    autoSaveTimer.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      try {
        console.log('[AutoSave] Saving to remote...');
        const graph = serializeGraph(nodes, edges);
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        const res = await fetch(apiEndpoint, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({ name: boardId, graph }),
        });

        if (res.ok) {
          console.log('[AutoSave] Saved successfully');
        } else {
          console.error('[AutoSave] Failed to save:', res.statusText);
        }
      } catch (error) {
        console.error('[AutoSave] Error:', error);
      }
    }, 100); // 100msの短い遅延で即時保存
  }, [nodes, edges, boardId, apiEndpoint]);

  // MARK: 接続ドラッグ中の接続元ノードIDを保持
  const connectingFrom = useRef<string | null>(null);
  // 直近に onConnect が成立したか（ハンドル同士の接続時は新規ノード追加を抑止）
  const didConnectRef = useRef<boolean>(false);
  // 最新の addChildNode を保持し、ノードデータ経由のコールバックでズレないようにする
  const latestAddChildNode = useRef<(parentId: string, type?: NodeType) => void>(() => {});
  // enhanceNode の最新実体を保持し、非同期処理から参照する
  const enhanceNodeRef = useRef<(node: WNode) => WNode>((node) => node);

  const showToast = useCallback((text: string) => {
    if (!mountedRef.current) return;
    const id = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const message: ToastMessage = { id, text };
    setToasts((prev) => [...prev, message]);
    setTimeout(() => {
      if (!mountedRef.current) return;
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  // MARK: クエリ — 親 -> 子（作成順で安定ソート）
  const getChildren = useCallback((parentId: string) => getChildrenSorted(nodes, edges, parentId), [nodes, edges]);

  // MARK: クエリ — 子 -> 親
  const getParent = useCallback((id: string) => parentOf(id, edges), [edges]);

  // なぜレベル（問題=0, 問題直下のなぜ=1, その子のなぜ=2, ...）を全ノード分まとめて算出
  const whyLevelMap = useMemo(() => {
    // ルート候補（data.type==='root'）を探索
    const roots = nodes.filter((n) => n.data?.type === 'root').map((n) => n.id);
    // 子リスト作成
    const childrenMap = new Map<string, string[]>();
    edges.forEach((e) => {
      const arr = childrenMap.get(e.source) ?? [];
      arr.push(e.target);
      childrenMap.set(e.source, arr);
    });

    const level = new Map<string, number>();
    const queue: string[] = [];

    // ルートの why レベルは 0 とする
    roots.forEach((rid) => {
      level.set(rid, 0);
      queue.push(rid);
    });

    // ルートが見つからない場合はそのまま（全て 0）
    const visited = new Set<string>();
    while (queue.length) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const curNode = nodes.find((n) => n.id === cur);
      const curL = level.get(cur) ?? 0;
      const kids = childrenMap.get(cur) ?? [];
      for (const k of kids) {
        const kn = nodes.find((n) => n.id === k);
        // 「なぜ」以外（原因/対策）はレベル計算の対象外
        if (!kn || kn.data?.type !== 'why') continue;
        const nextL = curNode?.data?.type === 'root' || curNode?.data?.type === 'why' ? curL + 1 : curL;
        if (!level.has(k) || (level.get(k)! > nextL)) level.set(k, nextL);
        queue.push(k);
      }
    }

    // デバッグ: 原因特定のため最小限の出力
    if (process.env.NODE_ENV !== 'production') {
      try {
        const whyNodes = nodes.filter((n) => n.data?.type === 'why').map((n) => ({ id: n.id, lvl: level.get(n.id) ?? 0 }));
        console.debug('[WhyBoard][debug] why-level summary', {
          roots,
          edges: edges.length,
          whyCount: whyNodes.length,
          sample: whyNodes.slice(0, 8),
        });
      } catch {}
    }

    return level;
  }, [nodes, edges]);

  // getParentInfo を最新状態で評価するための ref ベース実装（data に埋め込んだ関数の陳腐化を防ぐ）
  const getParentInfoRef = useRef<(id: string) => { parentLabel?: string; index?: number }>(() => ({}));
  const computeParentInfo = useCallback(
    (id: string) => {
      const parentId = getParent(id);
      const parent = parentId ? nodes.find((n) => n.id === parentId) : undefined;
      const index = whyLevelMap.get(id) ?? 0; // 深さ
      return parent ? { parentLabel: parent?.data.label, index } : { index };
    },
    [getParent, nodes, whyLevelMap]
  );
  useEffect(() => {
    getParentInfoRef.current = computeParentInfo;
  }, [computeParentInfo]);
  const getParentInfo = useCallback(
    (id: string) => (getParentInfoRef.current ? getParentInfoRef.current(id) : {}),
    []
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
    [setNodes]
  );

  // 既存ノードに最新の getParentInfo プロキシを一括設定（初回のみ）
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, getParentInfo: (id: string) => getParentInfoRef.current?.(id) ?? {} } })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MARK: アクション — ノード削除（関連エッジも削除）
  const deleteNode = useCallback(
    (id: string) => {
      if (id === "root") return;
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setNodes((nds) => nds.filter((n) => n.id !== id));
    },
    [setNodes, setEdges]
  );

  // MARK: ノード強化 — コールバック/状態を data に注入
  const enhanceNode = useCallback(
    (node: WNode): WNode => {
      const hasCauseDescendant = (id: string) => {
        const visited = new Set<string>();
        const stack = edges.filter((e) => e.source === id).map((e) => e.target);
        while (stack.length) {
          const current = stack.pop()!;
          if (visited.has(current)) continue;
          visited.add(current);
          const found = nodes.find((candidate) => candidate.id === current);
          if (found?.data.type === "cause") return true;
          edges
            .filter((edge) => edge.source === current)
            .forEach((edge) => stack.push(edge.target));
        }
        return false;
      };

      return {
        ...node,
        data: {
          ...node.data,
          boardId,
          getParentInfo: (id: string) => getParentInfo(id),
          hasChildren: (id: string) => edges.some((edge) => edge.source === id),
          hasCauseDescendant,
          canDelete: (id: string) => id !== "root",
          onDelete: (id: string) => {
            deleteNode(id);
            // ノード削除後も自動保存
            autoSaveToRemote();
          },
          onChangeLabel: (id: string, value: string) => {
            setNodes((previous) =>
              previous.map((item) =>
                item.id === id ? { ...item, data: { ...item.data, label: value } } : item
              )
            );
            // 自動保存（デバウンス）
            autoSaveToRemote();
          },
          onUpdateHeight: (id: string, height: number) =>
            setNodes((previous) =>
              previous.map((item) =>
                item.id === id ? { ...item, data: { ...item.data, heightHint: height } } : item
              )
            ),
          onToggleAdopted,
          onAddChild: (parentId: string, type?: NodeType) => {
            latestAddChildNode.current(parentId, type);
            // ノード追加後も自動保存
            autoSaveToRemote();
          },
          openMenu: (id: string) => openMenu(id),
          closeMenu: () => closeMenu(),
          isMenuOpen: node.id === menuOpenFor,
          // ロック機能
          currentUserId: session?.user?.id,
          lockNode: socketLockNode,
          unlockNode: socketUnlockNode,
        },
      };
    },
    [boardId, closeMenu, deleteNode, edges, getParentInfo, menuOpenFor, nodes, onToggleAdopted, openMenu, setNodes, session?.user?.id, socketLockNode, socketUnlockNode, autoSaveToRemote]
  );
  useEffect(() => {
    enhanceNodeRef.current = enhanceNode;
  }, [enhanceNode]);

  // クリーンアップ処理
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);
  // MARK: レイアウト — 親の右に子を等間隔 / 原因は最深子Yに揃える
  const layoutChildren = useCallback(
    (parentId: string) => setNodes((nds) => computeLayoutForParent(nds, edges, parentId)),
    [edges, setNodes]
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
            type: EDGE_TYPE,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      );
      

      // 整列: 追加後に同一親の子を等間隔に再配置
      setTimeout(() => layoutChildren(parentId), 0);
    },
    [boardId, enhanceNode, getChildren, layoutChildren, nodes, setEdges, setNodes]
  );

  useEffect(() => {
    latestAddChildNode.current = addChildNode;
  }, [addChildNode]);

  // MARK: XYFlow — 既存ハンドル同士の接続（エッジのみ追加）
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      
      setEdges((eds) => addEdge({ ...connection, type: EDGE_TYPE, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
      didConnectRef.current = true;
    },
    [setEdges]
  );

  // MARK: XYFlow — 右ハンドルからのドラッグ開始。接続元の nodeId を保持
  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    connectingFrom.current = params.nodeId ?? null;
    didConnectRef.current = false;
    
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const targetEl = event.target as HTMLElement;
      const pane = targetEl?.closest(".react-flow__pane");
      const hitHandle = targetEl?.closest('.react-flow__handle');
      
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
    (_event: unknown, viewport: Viewport) => {
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

  // MARK: ノード変更 — 影響親の再整列（自由移動を優先するため実行は抑止）
  const onNodesChangeWithLayout = useCallback(
    (changes: NodeChange<RFNode<WhyNodeData>>[]) => {
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
    [getParent, onNodesChange]
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

  const loadRemoteFromServer = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsRemoteSyncing(true);
    try {
      console.debug('[WhyBoard] loadRemoteFromServer:start', { endpoint: apiEndpoint });
      const headers: HeadersInit = {};
      const res = await fetch(apiEndpoint, { cache: 'no-store', credentials: 'include', headers });
      if (!res.ok) {
        console.error('[WhyBoard] Failed to load board from server', res.statusText);
        return;
      }
      const data = (await res.json()) as { graph?: SerializedGraph };
      const graph = data?.graph;
      console.debug('[WhyBoard] loadRemoteFromServer:received', {
        hasGraph: !!graph,
        nodeCount: graph?.nodes?.length || 0,
        edgeCount: graph?.edges?.length || 0,
        firstNode: graph?.nodes?.[0]
      });
      if (graph && Array.isArray(graph.nodes) && graph.nodes.length) {
        const enhancer = enhanceNodeRef.current;
        const { nodes: n2, edges: e2 } = deserializeGraph(graph, enhancer);
        if (!mountedRef.current) return;
        setNodes(n2);
        setEdges(e2);
        requestAnimationFrame(() => {
          try {
            rf.fitView({ padding: FITVIEW_PADDING });
          } catch (error) {
            console.warn('[WhyBoard] loadRemoteFromServer: fitView failed', error);
          }
        });
        console.debug('[WhyBoard] loadRemoteFromServer:applied', {
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
        });
        showToast(`ボード読込: ${boardId} (${new Date().toLocaleTimeString()})`);
      } else {
        console.debug('[WhyBoard] loadRemoteFromServer:empty graph');
        setEdges([]);
        showToast(`ボード読込: ${boardId} (データなし)`);
      }
    } catch (error) {
      console.error('[WhyBoard] loadRemote error', error);
    } finally {
      if (mountedRef.current) {
        setIsRemoteSyncing(false);
      }
    }
  }, [apiEndpoint, boardId, rf, setEdges, setIsRemoteSyncing, setNodes, showToast]);

  useEffect(() => {
    void loadRemoteFromServer();
  }, [loadRemoteFromServer]);

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
      void (async () => {
        try {
          const parsed = await fromToml(raw);
          const { nodes: n2, edges: e2 } = deserializeGraph(parsed, enhanceNode);
          setNodes(n2);
          setEdges(e2);
          setTimeout(() => rf.fitView({ padding: FITVIEW_PADDING }), 0);
        } catch (error) {
          console.error('[WhyBoard] loadLocal error', error);
        }
      })();
    },
    saveRemote: async () => {
      if (!mountedRef.current) return;
      setIsRemoteSyncing(true);
      try {
        console.debug('[WhyBoard] saveRemote:start', {
          endpoint: apiEndpoint,
          nodeCount: nodes.length,
          edgeCount: edges.length,
        });
        const graph = serializeGraph(nodes, edges);
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        const res = await fetch(apiEndpoint, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({ name: boardId, graph }),
        });
        if (!res.ok) {
          console.error('[WhyBoard] Failed to save board to server', res.statusText);
          return;
        }
        const data = (await res.json()) as { graph?: SerializedGraph };
        if (data?.graph && Array.isArray(data.graph.nodes)) {
          const enhancer = enhanceNodeRef.current;
          const { nodes: n2, edges: e2 } = deserializeGraph(data.graph, enhancer);
          if (!mountedRef.current) return;
          setNodes(n2);
          setEdges(e2);
          console.debug('[WhyBoard] saveRemote:applied response', {
            nodeCount: data.graph.nodes.length,
            edgeCount: data.graph.edges.length,
          });
        } else {
          console.debug('[WhyBoard] saveRemote:server returned no graph payload');
        }
        showToast(`ボード保存: ${boardId} (${new Date().toLocaleTimeString()})`);
      } catch (error) {
        console.error('[WhyBoard] saveRemote error', error);
      } finally {
        if (mountedRef.current) {
          setIsRemoteSyncing(false);
        }
      }
    },
    loadRemote: async () => {
      await loadRemoteFromServer();
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
      const root = containerRef.current;
      if (!root) return;

      try {
        const mod = await import('html-to-image');

        // 公式実装通り：ノードの境界とビューポートを計算
        const nodesBounds = getNodesBounds(rf.getNodes());
        const imageWidth = 1024;
        const imageHeight = 768;
        const viewport = getViewportForBounds(nodesBounds, imageWidth, imageHeight, 0.5, 2, 0);

        // エラーチェック追加
        const viewportElement = document.querySelector('.react-flow__viewport');
        if (!viewportElement) {
          throw new Error('React Flow viewport element not found');
        }

        // デバッグ: エッジ要素の存在確認
        const edgeElements = viewportElement.querySelectorAll('.react-flow__edge, .react-flow__edge-path, .react-flow__edges');
        console.log(`[PNG Export Debug] Found ${edgeElements.length} edge elements:`, edgeElements);

        const svgElements = viewportElement.querySelectorAll('svg');
        console.log(`[PNG Export Debug] Found ${svgElements.length} SVG elements:`, svgElements);
        // 以下はエラーチェック無し版で、型チェックエラー
        // const dataUrl = await mod.toPng(document.querySelector('.react-flow__viewport'), {
        const styleOverrides: Partial<CSSStyleDeclaration> = {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          color: '#111111',
        };
        // React Flow v12 エッジ用CSS変数（デフォルト値と実際の値両方を設定）
        (styleOverrides as Record<string, string>)['--xy-edge-stroke-default'] = '#111111';
        (styleOverrides as Record<string, string>)['--xy-edge-stroke'] = '#111111';
        (styleOverrides as Record<string, string>)['--xy-edge-stroke-selected-default'] = '#1d4ed8';
        (styleOverrides as Record<string, string>)['--xy-edge-stroke-selected'] = '#1d4ed8';
        (styleOverrides as Record<string, string>)['--xy-edge-stroke-width-default'] = '2';
        (styleOverrides as Record<string, string>)['--xy-edge-stroke-width'] = '2';
        (styleOverrides as Record<string, string>)['--xy-edge-stroke-width-selected-default'] = '3';
        (styleOverrides as Record<string, string>)['--xy-edge-stroke-width-selected'] = '3';

        // コネクションライン用の変数も設定
        (styleOverrides as Record<string, string>)['--xy-connectionline-stroke-default'] = '#111111';
        (styleOverrides as Record<string, string>)['--xy-connectionline-stroke'] = '#111111';
        (styleOverrides as Record<string, string>)['--xy-connectionline-stroke-width-default'] = '2';
        (styleOverrides as Record<string, string>)['--xy-connectionline-stroke-width'] = '2';

        const dataUrl = await mod.toPng(viewportElement as HTMLElement, {
          backgroundColor: '#ffffff',
          width: imageWidth,
          height: imageHeight,
          cacheBust: true,
          style: styleOverrides,
          filter: (node) => {
            // ノード関連要素を含める
            if (node.classList?.contains('react-flow__node')) return true;

            // エッジ関連要素を全て含める
            if (node.classList?.contains('react-flow__edge')) return true;
            if (node.classList?.contains('react-flow__edge-path')) return true;
            if (node.classList?.contains('react-flow__edges')) return true;
            if (node.classList?.contains('react-flow__edge-text')) return true;
            if (node.classList?.contains('react-flow__edge-textbg')) return true;
            if (node.classList?.contains('react-flow__edge-textwrapper')) return true;
            if (node.classList?.contains('react-flow__edgelabel-renderer')) return true;

            // SVG要素も含める（エッジは通常SVGで描画される）
            if (node.tagName === 'svg' || node.tagName === 'path' || node.tagName === 'marker') return true;

            // 除外する要素
            if (node.classList?.contains('react-flow__minimap')) return false;
            if (node.classList?.contains('react-flow__controls')) return false;
            if (node.classList?.contains('react-flow__panel')) return false;

            // その他は含める
            return true;
          },
        });

        // ダウンロード実行
        const a = document.createElement('a');
        a.setAttribute('download', `board-${boardId}.png`);
        a.setAttribute('href', dataUrl);
        a.click();
      } catch (e) {
        console.error('PNG export error:', e);
        alert('PNG エクスポートに失敗しました。');
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
          onUpdateHeight: () => {},
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
    <div 
      ref={containerRef} 
      className="w-full h-[calc(100vh-64px)] pb-4 md:pb-6 lg:pb-8"
      style={style}
    >
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
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(148, 163, 184, 0.3)" />
        <MiniMap />
      <Controls />
    </ReactFlow>
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto rounded-lg bg-black/80 px-4 py-2 text-sm text-white shadow-lg backdrop-blur"
            >
              {toast.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// MARK: Provider 境界越しに ref を渡すラッパー
const InnerWithRef = forwardRef<BoardHandle, Props>(CanvasInner);

// MARK: エクスポート — ReactFlowProvider で内側を包む
const WhyBoardCanvas = forwardRef<BoardHandle, Props>(function WhyBoardCanvas({ tenantId, boardId, style }, ref) {
  return (
    <ReactFlowProvider>
      <InnerWithRef ref={ref} tenantId={tenantId} boardId={boardId} style={style} />
    </ReactFlowProvider>
  );
});

export default WhyBoardCanvas;
