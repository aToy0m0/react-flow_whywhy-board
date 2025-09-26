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
  onBoardStateChange?: (state: { isFinalized: boolean }) => void;
  onBoardDeleted?: (payload: BoardDeletedPayload) => void;
};

type WNode = RFNode<WhyNodeData>;

type BoardStatus = 'DRAFT' | 'ACTIVE' | 'FINALIZED' | 'ARCHIVED';

type BoardDeletedPayload = {
  boardId: string;
  boardKey?: string;
  initiatedBy: string;
  deletedAt: string;
  redirectTo: string;
};

type BoardMeta = {
  id: string;
  boardKey: string;
  name: string;
  tenantId: string;
  status?: BoardStatus;
  finalizedAt?: string | null;
  deletedAt?: string | null;
};

// MARK: ノードレンダラーのマップ
const nodeTypes: Record<string, typeof WhyNode> = { why: WhyNode };

const TOAST_DURATION_MS = 4000;

type ToastMessage = {
  id: string;
  text: string;
};

// MARK: CanvasInner — ReactFlow の Provider 配下で動く本体
function CanvasInner({ tenantId, boardId, style, onBoardStateChange, onBoardDeleted }: Props, ref: React.Ref<BoardHandle>) {
  const rf = useReactFlow();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tenantSlug = tenantId ?? process.env.NEXT_PUBLIC_TENANT_ID ?? 'default';

  // セッションとロック機能
  const session = useSession()?.data;
  const { lockNode: registerLock, unlockNode: releaseLock } = useNodeLock();
  const [isBoardFinalized, setIsBoardFinalized] = useState(false);



  // Socket.IO統合（同時編集用）- 認証済みユーザーのみ
  const { lockNode: socketLockNode, unlockNode: socketUnlockNode, socket, notifyNodeUpdate: socketNotifyNodeUpdate, sendBoardAction } = useSocket({
    tenantId: tenantSlug,
    boardKey: boardId,
    userId: session?.user?.id || '', // 空文字でSocket接続を無効化
    onNodeLocked: (data) => {
      registerLock(data.nodeId, data.userId, data.userName, data.lockedAt);
    },
    onNodeUnlocked: (data) => {
      releaseLock(data.nodeId);
    },
    onNodeUpdated: (data) => {
      // 他のユーザーからのノード更新を反映（content + position + adopted + type）
      setNodes(nds => nds.map(n =>
        n.id === data.nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label: data.content,
                ...(data.adopted !== undefined && { adopted: data.adopted }),
                ...(data.type !== undefined &&
                   ['root', 'why', 'cause', 'action'].includes(data.type) &&
                   { type: data.type as NodeType }),
              },
              position: { x: data.position.x, y: data.position.y }
            }
          : n
      ));
    },
    onUserJoined: (data) => {
      console.log('[WhyBoard] User joined:', data);
    },
    onUserLeft: (data) => {
      console.log('[WhyBoard] User left:', data);
    },
    onBoardAction: (data) => {
      console.log('[WhyBoard] Board action received:', data);
      // 自分が実行したアクションは除外（重複実行を防ぐ）
      if (data.action !== 'finalize' && data.initiatedBy === session?.user?.id) {
        console.log('[WhyBoard] Skipping own board action');
        return;
      }
      // 他のユーザーからのボードアクションを実行
      if (data.action === 'relayout') {
        // 整列実行
        const parentIds = Array.from(new Set(edges.map(e => e.source)));
        setNodes(prev =>
          parentIds.reduce((acc, pid) => computeLayoutForParent(acc, edges, pid), prev)
        );
      } else if (data.action === 'clear') {
        // クリア実行
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
        try { rf.setViewport({ x: 0, y: 0, zoom: 1 }); } catch {}
        setTimeout(() => rf.fitView({ padding: FITVIEW_PADDING }), 0);
      } else if (data.action === 'finalize') {
        setIsBoardFinalized(true);
      }
    },
    onBoardReloadRequired: (data) => {
      console.log('[WhyBoard] Board reload required:', data);

      // 自分が実行したアクションは除外（重複実行を防ぐ）
      if (data.action !== 'finalize' && data.initiatedBy === session?.user?.id) {
        console.log('[WhyBoard] Skipping own board reload required');
        return;
      }

      // ノード作成以外のみDBから再読み込み（ノード作成時はリアルタイム更新で既に反映済み）
      if (data.action !== 'node-created') {
        loadRemoteFromServer();
      }

      if (data.action === 'finalize') {
        setIsBoardFinalized(true);
      }

      // ユーザーに通知
      const actionText = data.action === 'relayout' ? '整列' :
                        data.action === 'clear' ? 'クリア' :
                        data.action === 'finalize' ? '成立' :
                        data.action === 'node-created' ? 'ノード作成' : data.action;
      showToast(`${actionText}が実行されました`);
    },
    onBoardFinalized: (data) => {
      console.log('[WhyBoard] Board finalized event received:', data);
      setIsBoardFinalized(true);
    },
    onBoardDeleted: (data) => {
      console.log('[WhyBoard] Board deleted event received:', data);

      nodes.forEach((node) => {
        releaseLock(node.id);
      });

      setBoardMeta((prev) => prev ? { ...prev, deletedAt: data.deletedAt } : prev);
      setIsBoardFinalized(true);
      setNodes([]);
      setEdges([]);
      showToast('このボードは削除されました');
      onBoardStateChange?.({ isFinalized: true });
      onBoardDeleted?.(data);
    }
  });

  // joinedイベントでリアルタイムモード確実化
  useEffect(() => {
    if (!socket) return;

    const handleJoined = ({ roomId, userId }: { roomId: string; userId: string }) => {
      console.log('[WhyBoard] Socket joined confirmed:', { roomId, userId });
    };

    socket.on('joined', handleJoined);

    return () => {
      socket.off('joined', handleJoined);
    };
  }, [socket]);

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
  const [, setBoardMeta] = useState<BoardMeta | null>(null);
  const positionUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // ポジション更新タイマーのクリーンアップ
      if (positionUpdateTimerRef.current) {
        clearTimeout(positionUpdateTimerRef.current);
      }
    };
  }, []);

  const apiEndpoint = useMemo(() => `/api/tenants/${tenantSlug}/boards/${boardId}/nodes`, [tenantSlug, boardId]);



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

  const warnBoardFinalized = useCallback(() => {
    showToast('このボードは成立済みのため編集できません');
  }, [showToast]);

  const prevFinalizedRef = useRef<boolean>(false);
  useEffect(() => {
    if (prevFinalizedRef.current !== isBoardFinalized) {
      onBoardStateChange?.({ isFinalized: isBoardFinalized });
      prevFinalizedRef.current = isBoardFinalized;
    }
  }, [isBoardFinalized, onBoardStateChange]);

  const lockNodeSafely = useCallback((nodeId: string, ensure?: {
    content?: string;
    position?: { x: number; y: number };
    category?: string;
    depth?: number;
    tags?: string[];
    prevNodes?: string[];
    nextNodes?: string[];
    adopted?: boolean;
  }) => {
    if (isBoardFinalized) {
      warnBoardFinalized();
      return;
    }
    socketLockNode?.(nodeId, ensure);
  }, [isBoardFinalized, socketLockNode, warnBoardFinalized]);

  const notifyNodeUpdateSafely = useCallback((nodeId: string, content: string, position?: { x: number; y: number }, extraData?: { adopted?: boolean; type?: string }) => {
    if (isBoardFinalized) {
      warnBoardFinalized();
      return;
    }
    socketNotifyNodeUpdate?.(nodeId, content, position, extraData);
  }, [isBoardFinalized, socketNotifyNodeUpdate, warnBoardFinalized]);

  const sendBoardActionSafely = useCallback((action: 'relayout' | 'clear' | 'finalize') => {
    if (isBoardFinalized && action !== 'finalize') {
      warnBoardFinalized();
      return;
    }
    if (action === 'finalize' && isBoardFinalized) {
      warnBoardFinalized();
      return;
    }
    sendBoardAction?.(action);
  }, [isBoardFinalized, sendBoardAction, warnBoardFinalized]);

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
      if (isBoardFinalized) {
        warnBoardFinalized();
        return;
      }
      // ローカル状態更新
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, adopted: value, type: (value ? "cause" : "why") as NodeType } }
            : n
        )
      );

      // Socket.IO経由でDB保存と他ユーザー伝搬
      if (socketNotifyNodeUpdate) {
        const currentNode = nodes.find(n => n.id === id);
        if (currentNode) {
          // ノード情報を更新してDB保存
          socketNotifyNodeUpdate(id, currentNode.data.label, currentNode.position, {
            adopted: value,
            type: value ? "cause" : "why"
          });
        }
      }
    },
    [isBoardFinalized, nodes, setNodes, socketNotifyNodeUpdate, warnBoardFinalized]
  );

  // 既存ノードに最新の getParentInfo プロキシを一括設定（初回のみ）
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, getParentInfo: (id: string) => getParentInfoRef.current?.(id) ?? {} } })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MARK: アクション — ノード削除（関連エッジも削除）
  const deleteNode = useCallback(
    (id: string) => {
      if (isBoardFinalized) {
        warnBoardFinalized();
        return;
      }
      if (id === "root") return;
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setNodes((nds) => nds.filter((n) => n.id !== id));
    },
    [isBoardFinalized, setNodes, setEdges, warnBoardFinalized]
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
          },
          onChangeLabel: (id: string, value: string) => {
            setNodes((previous) =>
              previous.map((item) =>
                item.id === id ? { ...item, data: { ...item.data, label: value } } : item
              )
            );
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
          },
          openMenu: (id: string) => openMenu(id),
          closeMenu: () => closeMenu(),
          isMenuOpen: node.id === menuOpenFor,
          // ロック機能
          currentUserId: session?.user?.id,
          lockNode: lockNodeSafely,
          unlockNode: socketUnlockNode,
          // Socket.IO同期機能
          notifyNodeUpdate: notifyNodeUpdateSafely,
        },
      };
    },
    [boardId, closeMenu, deleteNode, edges, getParentInfo, menuOpenFor, nodes, onToggleAdopted, openMenu, setNodes, session?.user?.id, lockNodeSafely, notifyNodeUpdateSafely, socketUnlockNode]
  );
  useEffect(() => {
    enhanceNodeRef.current = enhanceNode;
  }, [enhanceNode]);

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
      if (isBoardFinalized) {
        warnBoardFinalized();
        return;
      }
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


      // 新規ノード作成時はensure付きでロック要求（エッジ情報も含む）
      // ノードタイプを正しくDB categoryに変換
      let category = 'Why'; // デフォルト
      if (newNode.data.type === 'root') category = 'Root';
      else if (newNode.data.type === 'cause') category = 'Cause';
      else if (newNode.data.type === 'action') category = 'Action';
      else if (newNode.data.type === 'why') category = 'Why';

      lockNodeSafely(childId, {
        content: newNode.data.label,
        position: { x: newNode.position.x, y: newNode.position.y },
        category,
        adopted: newNode.data.adopted,
        depth: 0,
        tags: [],
        prevNodes: [parentId],
        nextNodes: []
      });

      // 整列: 追加後に同一親の子を等間隔に再配置
      setTimeout(() => layoutChildren(parentId), 0);
    },
    [boardId, enhanceNode, getChildren, isBoardFinalized, layoutChildren, lockNodeSafely, nodes, setEdges, setNodes, warnBoardFinalized]
  );

  useEffect(() => {
    latestAddChildNode.current = addChildNode;
  }, [addChildNode]);

  // MARK: XYFlow — 既存ハンドル同士の接続（エッジのみ追加）
  const onConnect = useCallback(
    (connection: Connection) => {
      if (isBoardFinalized) {
        warnBoardFinalized();
        return;
      }
      if (!connection.source || !connection.target) return;

      setEdges((eds) => addEdge({ ...connection, type: EDGE_TYPE, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
      didConnectRef.current = true;

    },
    [isBoardFinalized, setEdges, warnBoardFinalized]
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
      if (isBoardFinalized) {
        warnBoardFinalized();
        return;
      }
      onNodesChange(changes);
      const affectedParents = new Set<string>();
      const positionChanges: { nodeId: string; position: { x: number; y: number } }[] = [];

      changes.forEach((c) => {
        if (c.type === "position" && c.position) {
          const parentId = getParent(c.id);
          affectedParents.add(parentId ?? c.id);

          // 位置変更をSocket.IO経由でDBに保存
          positionChanges.push({
            nodeId: c.id,
            position: { x: c.position.x, y: c.position.y }
          });
        }
      });

      // debounce処理でドラッグ中の大量イベントを制御
      if (positionChanges.length > 0) {
        // 既存のタイマーをクリア
        if (positionUpdateTimerRef.current) {
          clearTimeout(positionUpdateTimerRef.current);
        }

        // 500ms後に位置をDB保存
        positionUpdateTimerRef.current = setTimeout(() => {
          positionChanges.forEach(({ nodeId, position }) => {
            // 現在のノード情報を取得してcontentと一緒に送信
            const currentNode = nodes.find(n => n.id === nodeId);
            if (currentNode) {
              notifyNodeUpdateSafely(nodeId, currentNode.data.label, position);
            }
          });
        }, 500);
      }

      // NOTE: 子の自由移動を許可するため、移動直後の自動整列はオフ
      // 再度オンにしたい場合は以下を有効化
      // affectedParents.forEach((id) => layoutChildren(id));
    },
    [getParent, isBoardFinalized, nodes, notifyNodeUpdateSafely, onNodesChange, warnBoardFinalized]
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
    console.log('[WhyBoard] loadRemoteFromServer called', { mounted: mountedRef.current, apiEndpoint });
    if (!mountedRef.current) {
      console.log('[WhyBoard] loadRemoteFromServer:early return - not mounted');
      return;
    }
    setIsRemoteSyncing(true);
    try {
      console.debug('[WhyBoard] loadRemoteFromServer:start', { endpoint: apiEndpoint });
      const headers: HeadersInit = {};
      const res = await fetch(apiEndpoint, { cache: 'no-store', credentials: 'include', headers });
      if (!res.ok) {
        console.error('[WhyBoard] Failed to load board from server', res.statusText);
        return;
      }
      const data = (await res.json()) as { graph?: SerializedGraph; board?: BoardMeta };
      const graph = data?.graph;
      if (data?.board) {
        setBoardMeta(data.board);
        setIsBoardFinalized(data.board.status === 'FINALIZED');
      } else {
        setBoardMeta(null);
        setIsBoardFinalized(false);
      }
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
        // ルートノードのみの場合はfitViewしない（画面いっぱい表示を防ぐ）
        if (n2.length > 1) {
          requestAnimationFrame(() => {
            try {
              rf.fitView({ padding: FITVIEW_PADDING });
            } catch (error) {
              console.warn('[WhyBoard] loadRemoteFromServer: fitView failed', error);
            }
          });
        }
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
  }, [apiEndpoint, boardId, rf, setBoardMeta, setEdges, setIsBoardFinalized, setIsRemoteSyncing, setNodes, showToast]);

  useEffect(() => {
    console.log('[WhyBoard] useEffect loadRemoteFromServer triggered');
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
          // ルートノードのみの場合はfitViewしない（画面いっぱい表示を防ぐ）
          if (n2.length > 1) {
            setTimeout(() => rf.fitView({ padding: FITVIEW_PADDING }), 0);
          }
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
        const data = (await res.json()) as { graph?: SerializedGraph; board?: BoardMeta };
        if (data?.board) {
          setBoardMeta(data.board);
          setIsBoardFinalized(data.board.status === 'FINALIZED');
        }
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
        // ルートノードのみの場合はfitViewしない（画面いっぱい表示を防ぐ）
        if (n2.length > 1) {
          setTimeout(() => rf.fitView({ padding: FITVIEW_PADDING }), 0);
        }
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
      // Socket.IO経由でサーバー側クリア実行
      sendBoardActionSafely('clear');
    },
    relayoutAll: () => {
      // Socket.IO経由でサーバー側整列実行
      sendBoardActionSafely('relayout');
    },
    finalizeBoard: () => {
      sendBoardActionSafely('finalize');
    },
    fitView: () => {
      try { rf.fitView({ padding: FITVIEW_PADDING }); } catch {}
    },
    sendBoardAction: (action: 'relayout' | 'clear' | 'finalize') => {
      sendBoardActionSafely(action);
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
