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
  const {
    lockNode: registerLock,
    unlockNode: releaseLock,
    isNodeLocked,
    isNodeLockedByCurrentUser,
    getNodeLockInfo
  } = useNodeLock();
  const currentUserId = session?.user?.id || '';
  const [isBoardFinalized, setIsBoardFinalized] = useState(false);
    const pendingNodeUpdatesRef = useRef(new Map<string, { content: string; position?: { x: number; y: number }; extra?: { adopted?: boolean; type?: string } }>());

const loadRemoteFromServerRef = useRef<(options?: { fitView?: boolean }) => Promise<void>>(() => Promise.resolve());



  // Socket.IO統合（同時編集用）- 認証済みユーザーのみ
  // 注: NextAuthセッショントークンは HttpOnly クッキーとしてサーバーに自動送信される
  const { lockNode: socketLockNode, unlockNode: socketUnlockNode, socket, notifyNodeUpdate: socketNotifyNodeUpdate, deleteNode: socketDeleteNode, sendBoardAction } = useSocket({
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
    onUserTimeout: (data) => {
      console.warn('[WhyBoard] User timeout detected:', data);
      showToast(`ユーザー ${data.userId} がタイムアウトしました`);
    },
    onBoardAction: (data) => {
      console.log('[WhyBoard] Board action received:', data);
      const isInitiator = data.initiatedBy === session?.user?.id;

      flushAllPendingNodeUpdates();

      if (data.action === 'relayout') {
        if (isInitiator) {
          loadRemoteFromServerRef.current({ fitView: false });
        } else {
          const parentIds = Array.from(new Set(edges.map(e => e.source)));
          setNodes(prev => parentIds.reduce((acc, pid) => computeLayoutForParent(acc, edges, pid), prev));
        }
      } else if (data.action === 'clear') {
        if (isInitiator) {
          loadRemoteFromServerRef.current({ fitView: false });
        } else {
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
        }
      } else if (data.action === 'finalize') {
        setIsBoardFinalized(true);
      }
    },
    onBoardReloadRequired: (data) => {
      console.log('[WhyBoard] Board reload required:', data);

      const isInitiator = data.initiatedBy === session?.user?.id;

      flushAllPendingNodeUpdates();

      if (data.action === 'node-created') {
        if (!isInitiator) {
          loadRemoteFromServerRef.current({ fitView: false });
        }
      } else {
        loadRemoteFromServerRef.current({ fitView: false });
      }

      if (data.action === 'finalize') {
        setIsBoardFinalized(true);
      }

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
    onNodeDeleted: (data) => {
      console.log('[WhyBoard] Node deleted event received:', data);
      releaseLock(data.nodeId);
      setNodes((prev) => prev.filter((node) => node.id !== data.nodeId));
      setEdges((prev) => prev.filter((edge) => edge.source !== data.nodeId && edge.target !== data.nodeId));
      const isInitiator = data.deletedBy === session?.user?.id;
      if (!isInitiator) {
        showToast('ノードが削除されました');
        loadRemoteFromServerRef.current({ fitView: false });
      }
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
  const lastLockWarningRef = useRef(0);
  const nodesRef = useRef<WNode[]>(nodes);

  // nodesが更新されたらRefも更新
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

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

  const registerPendingNodeUpdate = useCallback((nodeId: string, update: { content: string; position?: { x: number; y: number }; extra?: { adopted?: boolean; type?: string } }) => {
    pendingNodeUpdatesRef.current.set(nodeId, update);
  }, []);

  const flushPendingNodeUpdate = useCallback((nodeId: string) => {
    if (!socketNotifyNodeUpdate) return;
    const entry = pendingNodeUpdatesRef.current.get(nodeId);
    if (!entry) return;
    socketNotifyNodeUpdate(nodeId, entry.content, entry.position, entry.extra);
    pendingNodeUpdatesRef.current.delete(nodeId);
  }, [socketNotifyNodeUpdate]);

  const flushAllPendingNodeUpdates = useCallback(() => {
    if (!socketNotifyNodeUpdate) return;
    if (pendingNodeUpdatesRef.current.size === 0) return;
    pendingNodeUpdatesRef.current.forEach((entry, nodeId) => {
      socketNotifyNodeUpdate(nodeId, entry.content, entry.position, entry.extra);
    });
    pendingNodeUpdatesRef.current.clear();
  }, [socketNotifyNodeUpdate]);

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
    if (isBoardFinalized) {
      warnBoardFinalized();
      return;
    }
    socketNotifyNodeUpdate?.(nodeId, content, position, extraData);
    pendingNodeUpdatesRef.current.delete(nodeId);
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
    flushAllPendingNodeUpdates();
    sendBoardAction?.(action);
  }, [flushAllPendingNodeUpdates, isBoardFinalized, sendBoardAction, warnBoardFinalized]);

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
      console.log('[WhyBoard] onToggleAdopted called:', { id, value, isBoardFinalized, hasSocketNotify: !!socketNotifyNodeUpdate });

      if (isBoardFinalized) {
        warnBoardFinalized();
        return;
      }

      // まずnodesRefから現在のノード情報を取得
      const currentNode = nodesRef.current.find(n => n.id === id);
      console.log('[WhyBoard] Current node for adoption (from Ref):', {
        id,
        found: !!currentNode,
        label: currentNode?.data.label,
        position: currentNode?.position,
        totalNodesCount: nodesRef.current.length,
        allNodeIds: nodesRef.current.map(n => n.id)
      });

      if (!currentNode) {
        console.warn('[WhyBoard] Current node not found for adoption update:', id);
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
        socketNotifyNodeUpdate(id, currentNode.data.label, currentNode.position, {
          adopted: value,
          type: value ? "cause" : "why"
        });
        console.log('[WhyBoard] Sent adoption update via socket:', { id, value, label: currentNode.data.label });
      } else {
        console.warn('[WhyBoard] socketNotifyNodeUpdate not available');
      }
    },
    [isBoardFinalized, setNodes, socketNotifyNodeUpdate, warnBoardFinalized]
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
      releaseLock(id);
      socketDeleteNode?.(id);
      showToast('ノードを削除しました');
    },
    [isBoardFinalized, releaseLock, setEdges, setNodes, showToast, socketDeleteNode, warnBoardFinalized]
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
          currentUserName: session?.user?.email ?? session?.user?.name ?? session?.user?.id ?? '',
          lockNode: lockNodeSafely,
          unlockNode: socketUnlockNode,
          // Socket.IO同期機能
          notifyNodeUpdate: notifyNodeUpdateSafely,
          registerPendingUpdate: (id: string, value: { content: string; extra?: { adopted?: boolean; type?: string } }) => {
            registerPendingNodeUpdate(id, { content: value.content, extra: value.extra });
          },
          flushPendingUpdate: (id: string) => {
            flushPendingNodeUpdate(id);
          },
        },
      };
    },
    [
      boardId,
      closeMenu,
      deleteNode,
      edges,
      flushPendingNodeUpdate,
      getParentInfo,
      menuOpenFor,
      nodes,
      onToggleAdopted,
      openMenu,
      registerPendingNodeUpdate,
      setNodes,
      session?.user?.id,
      session?.user?.email,
      session?.user?.name,
      lockNodeSafely,
      notifyNodeUpdateSafely,
      socketUnlockNode,
    ]
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

      const blockedNodeIds = new Set<string>();
      const allowedChanges: NodeChange<RFNode<WhyNodeData>>[] = [];
      const affectedParents = new Set<string>();
      const positionChanges: { nodeId: string; position: { x: number; y: number } }[] = [];

      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const locked = isNodeLocked(change.id);
          const lockedByMe = isNodeLockedByCurrentUser(change.id, currentUserId);
          if (locked && !lockedByMe) {
            blockedNodeIds.add(change.id);
            return;
          }
          allowedChanges.push(change);
          const parentId = getParent(change.id);
          affectedParents.add(parentId ?? change.id);
          positionChanges.push({
            nodeId: change.id,
            position: { x: change.position.x, y: change.position.y }
          });
          return;
        }
        allowedChanges.push(change);
      });

      if (blockedNodeIds.size > 0) {
        const now = Date.now();
        if (now - lastLockWarningRef.current > 1500) {
          const iterator = blockedNodeIds.values().next();
          const firstBlocked = iterator.value;
          if (firstBlocked) {
            const lockInfo = getNodeLockInfo(firstBlocked);
            const editorName = lockInfo?.userName ?? '別のユーザー';
            showToast(`${editorName}が編集中のため移動できません`);
            lastLockWarningRef.current = now;
          }
        }
      }

      if (!allowedChanges.length) {
        return;
      }

      onNodesChange(allowedChanges);

      if (positionChanges.length > 0) {
        if (positionUpdateTimerRef.current) {
          clearTimeout(positionUpdateTimerRef.current);
        }

        positionUpdateTimerRef.current = setTimeout(() => {
          positionChanges.forEach(({ nodeId, position }) => {
            const currentNode = nodes.find((node) => node.id === nodeId);
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
    [
      currentUserId,
      getNodeLockInfo,
      getParent,
      isBoardFinalized,
      isNodeLocked,
      isNodeLockedByCurrentUser,
      nodes,
      notifyNodeUpdateSafely,
      onNodesChange,
      showToast,
      warnBoardFinalized
    ]
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

  const loadRemoteFromServer = useCallback(async (options?: { fitView?: boolean }) => {
    const shouldFitView = options?.fitView ?? true;
    console.log('[WhyBoard] loadRemoteFromServer called', { mounted: mountedRef.current, apiEndpoint, shouldFitView });
    if (!mountedRef.current) {
      console.log('[WhyBoard] loadRemoteFromServer:early return - not mounted');
      return;
    }
    setIsRemoteSyncing(true);
    try {
      console.debug('[WhyBoard] loadRemoteFromServer:start', { endpoint: apiEndpoint, shouldFitView });
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
        if (shouldFitView && n2.length > 1) {
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
    loadRemoteFromServerRef.current = (options) => loadRemoteFromServer(options);
  }, [loadRemoteFromServer]);

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

        // SVG内のpath要素を確認
        const pathElements = viewportElement.querySelectorAll('svg path');
        console.log(`[PNG Export Debug] Found ${pathElements.length} path elements in SVG:`, pathElements);

        // エッジのスタイルを確認
        if (edgeElements.length > 0) {
          const firstEdge = edgeElements[0] as HTMLElement;
          const computedStyle = window.getComputedStyle(firstEdge);
          console.log('[PNG Export Debug] First edge computed style:', {
            stroke: computedStyle.stroke,
            strokeWidth: computedStyle.strokeWidth,
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
          });
        }

        // html-to-imageはCSS変数をコピーしないため、SVG要素に直接stroke属性を設定
        const allEdgePaths = viewportElement.querySelectorAll('.react-flow__edge-path');
        allEdgePaths.forEach((path) => {
          (path as SVGPathElement).setAttribute('stroke', '#111111');
          (path as SVGPathElement).setAttribute('stroke-width', '2');
          (path as SVGPathElement).setAttribute('fill', 'none');
        });
        console.log(`[PNG Export Debug] Applied direct stroke to ${allEdgePaths.length} edge paths`);

        const styleOverrides: Partial<CSSStyleDeclaration> = {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          color: '#111111',
        };

        const dataUrl = await mod.toPng(viewportElement as HTMLElement, {
          backgroundColor: '#ffffff',
          width: imageWidth,
          height: imageHeight,
          cacheBust: true,
          pixelRatio: 2, // 高解像度で出力
          style: styleOverrides,
          filter: (node) => {
            // 除外する要素を先にチェック
            if (node.classList?.contains('react-flow__minimap')) return false;
            if (node.classList?.contains('react-flow__controls')) return false;
            if (node.classList?.contains('react-flow__panel')) return false;
            if (node.classList?.contains('react-flow__attribution')) return false;

            // SVG要素は必ず含める（エッジ描画に必須）
            const tagName = node.tagName?.toUpperCase();
            if (tagName === 'SVG' || tagName === 'PATH' || tagName === 'G' ||
                tagName === 'DEFS' || tagName === 'MARKER' || tagName === 'CIRCLE' ||
                tagName === 'POLYLINE' || tagName === 'LINE') {
              return true;
            }

            // React Flow要素を全て含める
            if (node.classList?.contains('react-flow__viewport')) return true;
            if (node.classList?.contains('react-flow__edges')) return true;
            if (node.classList?.contains('react-flow__edge')) return true;
            if (node.classList?.contains('react-flow__edge-path')) return true;
            if (node.classList?.contains('react-flow__edge-text')) return true;
            if (node.classList?.contains('react-flow__edge-textbg')) return true;
            if (node.classList?.contains('react-flow__edge-textwrapper')) return true;
            if (node.classList?.contains('react-flow__edgelabel-renderer')) return true;
            if (node.classList?.contains('react-flow__nodes')) return true;
            if (node.classList?.contains('react-flow__node')) return true;

            // デフォルトは含める
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
    exportSvg: async () => {
      const root = containerRef.current;
      if (!root) return;

      try {
        // React Flowのビューポート要素を取得
        const viewportElement = document.querySelector('.react-flow__viewport');
        if (!viewportElement) {
          throw new Error('React Flow viewport element not found');
        }

        // 全ノードの境界を計算
        const nodesBounds = getNodesBounds(rf.getNodes());
        const imageWidth = 1024;
        const imageHeight = 768;
        const viewport = getViewportForBounds(nodesBounds, imageWidth, imageHeight, 0.5, 2, 0);

        // SVGコンテナを作成
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNamespace, 'svg');
        svg.setAttribute('width', imageWidth.toString());
        svg.setAttribute('height', imageHeight.toString());
        svg.setAttribute('viewBox', `0 0 ${imageWidth} ${imageHeight}`);
        svg.setAttribute('xmlns', svgNamespace);

        // 背景
        const background = document.createElementNS(svgNamespace, 'rect');
        background.setAttribute('width', '100%');
        background.setAttribute('height', '100%');
        background.setAttribute('fill', '#ffffff');
        svg.appendChild(background);

        // ビューポート変換用のグループ
        const g = document.createElementNS(svgNamespace, 'g');
        g.setAttribute('transform', `translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`);
        svg.appendChild(g);

        // エッジをコピー（React FlowのSVGエッジ要素）
        // React Flowは .react-flow__edges > svg:not(.react-flow__marker) 構造でエッジを描画
        const edgesContainer = viewportElement.querySelector('.react-flow__edges');
        console.log('[SVG Export Debug] Edges container:', edgesContainer);

        if (edgesContainer) {
          // マーカー定義SVGをコピー（矢印用）
          const markerSvg = edgesContainer.querySelector('svg.react-flow__marker');
          if (markerSvg) {
            const clonedMarker = markerSvg.cloneNode(true) as SVGElement;
            g.appendChild(clonedMarker);
            console.log('[SVG Export Debug] Copied marker definitions');
          }

          // 実際のエッジを描画するSVG要素を取得（マーカー以外のSVG）
          const allSvgs = edgesContainer.querySelectorAll('svg');
          console.log('[SVG Export Debug] Total SVG elements in edges container:', allSvgs.length);

          let edgePathCount = 0;
          allSvgs.forEach((svg, index) => {
            if (!svg.classList.contains('react-flow__marker')) {
              console.log('[SVG Export Debug] Processing edge SVG', index, ':', svg);
              const clonedEdges = svg.cloneNode(true) as SVGElement;

              // エッジのpath要素にstrokeを明示的に設定
              const edgePaths = clonedEdges.querySelectorAll('.react-flow__edge-path');
              console.log('[SVG Export Debug] Found', edgePaths.length, 'edge paths in SVG', index);

              edgePaths.forEach((path) => {
                (path as SVGPathElement).setAttribute('stroke', '#111111');
                (path as SVGPathElement).setAttribute('stroke-width', '2');
                (path as SVGPathElement).setAttribute('fill', 'none');
                edgePathCount++;
              });

              g.appendChild(clonedEdges);
            }
          });

          console.log('[SVG Export Debug] Total edge paths copied:', edgePathCount);
        } else {
          console.warn('[SVG Export Debug] No .react-flow__edges container found');
        }

        // ノードをSVG foreignObjectとして追加
        const nodeElements = viewportElement.querySelectorAll('.react-flow__node');
        nodeElements.forEach((nodeEl) => {
          const htmlNode = nodeEl as HTMLElement;
          const nodeId = htmlNode.getAttribute('data-id');
          const node = rf.getNodes().find(n => n.id === nodeId);
          if (!node) return;

          const foreignObject = document.createElementNS(svgNamespace, 'foreignObject');
          foreignObject.setAttribute('x', node.position.x.toString());
          foreignObject.setAttribute('y', node.position.y.toString());
          foreignObject.setAttribute('width', (node.width || 300).toString());
          foreignObject.setAttribute('height', (node.height || 100).toString());

          // ノードのHTMLをコピー
          const clonedNode = htmlNode.cloneNode(true) as HTMLElement;
          foreignObject.appendChild(clonedNode);
          g.appendChild(foreignObject);
        });

        console.log('[SVG Export Debug] Created SVG with nodes and edges');

        // SVGをシリアライズしてダウンロード
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.setAttribute('download', `board-${boardId}.svg`);
        a.setAttribute('href', url);
        a.click();

        URL.revokeObjectURL(url);
        console.log('[SVG Export] Download initiated');
      } catch (e) {
        console.error('SVG export error:', e);
        alert('SVG エクスポートに失敗しました。');
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
        minZoom={0.1}
        maxZoom={4}
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
