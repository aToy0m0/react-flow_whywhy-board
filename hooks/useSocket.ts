import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  tenantId: string;
  boardKey: string;
  userId: string;
  onNodeLocked?: (data: { nodeId: string; userId: string; userName: string; lockedAt: string }) => void;
  onNodeUnlocked?: (data: { nodeId: string; userId: string }) => void;
  onNodeUpdated?: (data: { nodeId: string; content: string; position: { x: number; y: number }; userId: string; adopted?: boolean; type?: string }) => void;
  onUserJoined?: (data: { userId: string; socketId: string }) => void;
  onUserLeft?: (data: { userId: string; socketId: string }) => void;
  onUserTimeout?: (data: { userId: string; lastSeenAt: string }) => void;
  onBoardAction?: (data: { action: 'relayout' | 'clear' | 'finalize'; initiatedBy: string; timestamp: string }) => void;
  onBoardReloadRequired?: (data: { action: 'relayout' | 'clear' | 'finalize' | 'node-created'; initiatedBy: string; timestamp: string }) => void;
  onBoardFinalized?: (data: { status: 'finalized'; initiatedBy: string; finalizedAt: string }) => void;
  onBoardDeleted?: (data: { boardId: string; boardKey?: string; initiatedBy: string; deletedAt: string; redirectTo: string }) => void;
  onNodeDeleted?: (data: { nodeId: string; deletedBy: string; deletedAt: string }) => void;
}

export function useSocket(options: UseSocketOptions) {
  const {
    tenantId,
    boardKey,
    userId,
    onNodeLocked,
    onNodeUnlocked,
    onNodeUpdated,
    onUserJoined,
    onUserLeft,
    onUserTimeout,
    onBoardAction,
    onBoardReloadRequired,
    onBoardFinalized,
    onBoardDeleted,
    onNodeDeleted,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);

  // ハンドラをrefに退避（依存配列から外すため）
  const lockedRef = useRef(onNodeLocked);
  const unlockedRef = useRef(onNodeUnlocked);
  const updatedRef = useRef(onNodeUpdated);
  const joinedRef = useRef(onUserJoined);
  const leftRef = useRef(onUserLeft);
  const userTimeoutRef = useRef(onUserTimeout);
  const boardActionRef = useRef(onBoardAction);
  const boardReloadRequiredRef = useRef(onBoardReloadRequired);
  const boardFinalizedRef = useRef(onBoardFinalized);
  const boardDeletedRef = useRef(onBoardDeleted);
  const nodeDeletedRef = useRef(onNodeDeleted);

  useEffect(() => { lockedRef.current = onNodeLocked; }, [onNodeLocked]);
  useEffect(() => { unlockedRef.current = onNodeUnlocked; }, [onNodeUnlocked]);
  useEffect(() => { updatedRef.current = onNodeUpdated; }, [onNodeUpdated]);
  useEffect(() => { joinedRef.current = onUserJoined; }, [onUserJoined]);
  useEffect(() => { leftRef.current = onUserLeft; }, [onUserLeft]);
  useEffect(() => { userTimeoutRef.current = onUserTimeout; }, [onUserTimeout]);
  useEffect(() => { boardActionRef.current = onBoardAction; }, [onBoardAction]);
  useEffect(() => { boardReloadRequiredRef.current = onBoardReloadRequired; }, [onBoardReloadRequired]);
  useEffect(() => { boardFinalizedRef.current = onBoardFinalized; }, [onBoardFinalized]);
  useEffect(() => { boardDeletedRef.current = onBoardDeleted; }, [onBoardDeleted]);
  useEffect(() => { nodeDeletedRef.current = onNodeDeleted; }, [onNodeDeleted]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!tenantId || !boardKey || !userId || userId === 'anonymous') return;

    // 既存socketがあれば使う（作り直さない）
    if (!socketRef.current) {
      // 認証オブジェクト: tenantIdとboardKeyのみ（NextAuthクッキーはブラウザが自動送信）
      const authPayload = { tenantId, boardKey, userId };

      socketRef.current = io({
        transports: ['websocket'], // まずWSだけで安定化を確認
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionAttempts: 10,
        auth: authPayload, // ハンドシェイクで渡す
        withCredentials: true, // クッキーを含める（重要！）
        timeout: 10000,
      });

      const s = socketRef.current;
      const roomId = `${tenantId}:${boardKey}`;

      // connect後にjoin（ここが重要）
      const join = () => s.emit('join-board', {
        tenantId, boardKey, userId, roomId
      });

      s.on('connect', () => {
        console.log('[Socket.IO] Connected:', s.id, { tenantId, boardKey, userId });
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        join();
      });

      s.on('disconnect', () => {
        console.log('[Socket.IO] Disconnected');
        setIsConnected(false);
      });

      s.on('connect_error', (err) => {
        console.error('[Socket.IO] Connection error:', err);
        setError(err.message);
        setIsConnected(false);
      });

      // イベントハンドラをref経由に変更
      s.on('node-locked', (d) => lockedRef.current?.(d));
      s.on('node-unlocked', (d) => unlockedRef.current?.(d));
      s.on('nodes-unlocked', (d: { userId: string; nodeIds: string[] }) => {
        if (!Array.isArray(d?.nodeIds)) return;
        d.nodeIds.forEach((nodeId) => {
          unlockedRef.current?.({ nodeId, userId: d.userId });
        });
      });
      s.on('node-updated', (d) => updatedRef.current?.(d));
      s.on('user-joined', (d) => joinedRef.current?.(d));
      s.on('user-left', (d) => leftRef.current?.(d));
      s.on('user-timeout', (d) => userTimeoutRef.current?.(d));
      s.on('board-action', (d) => boardActionRef.current?.(d));
      s.on('board-reload-required', (d) => boardReloadRequiredRef.current?.(d));
      s.on('board-finalized', (d) => boardFinalizedRef.current?.(d));
      s.on('board-deleted', (d) => boardDeletedRef.current?.(d));
      s.on('node-deleted', (d) => nodeDeletedRef.current?.(d));

      // join確認でリアルタイムモード確実化
      s.on('joined', ({ roomId, userId }) => {
        console.log('[Socket.IO] Joined confirmed:', { roomId, userId });
        // この処理はuseSocketの外で実装される予定
      });

      s.on('lock-error', (data) => {
        console.error('[Socket.IO] Lock error:', data);
        setError(`Lock error: ${data.error}`);
      });

      s.on('unlock-error', (data) => {
        // "No active lock found"は正常なケースなのでエラーログを抑制
        if (data.error === 'No active lock found') {
          console.debug('[Socket.IO] Unlock skipped (no active lock):', data.nodeId);
        } else {
          console.error('[Socket.IO] Unlock error:', data);
          setError(`Unlock error: ${data.error}`);
        }
      });

      s.on('node-saved', (data) => {
        console.log('[Socket.IO] Node saved:', data);
      });

      s.on('node-save-error', (data) => {
        console.error('[Socket.IO] Node save error:', data);
        setError(`Save error: ${data.error}`);
      });

      s.on('node-delete-error', (data) => {
        console.error('[Socket.IO] Node delete error:', data);
        setError(`Node delete error: ${data.error}`);
      });

      s.on('board-action-error', (data) => {
        console.warn('[Socket.IO] Board action error:', data);
        setError(`Board action error: ${data?.error ?? 'Unknown error'}`);
      });
    }

    return () => {
      // 依存が変わっても即破棄しない（チラつきを防ぐ）
      // socketRef.current?.off(...); // 各イベントoff
      // socketRef.current?.disconnect();
      // socketRef.current = null;
    };
  }, [tenantId, boardKey, userId]);

  // ノードロック要求（ensure+lock原子化）
  const lockNode = (nodeId: string, ensure?: {
    content?: string;
    position?: { x: number; y: number };
    category?: string;
    depth?: number;
    tags?: string[];
    prevNodes?: string[];
    nextNodes?: string[];
    adopted?: boolean;
  }) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('lock-node', { nodeId, ensure });
    }
  };

  // ノードロック解除
  const unlockNode = (nodeId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unlock-node', { nodeId });
    }
  };

  // ノード更新通知（拡張版：採用状態やタイプも送信可能）
  const notifyNodeUpdate = (nodeId: string, content: string, position?: { x: number; y: number }, extraData?: { adopted?: boolean; type?: string }) => {
    if (socketRef.current?.connected) {
      console.log('[Socket.IO] Sending node update:', { nodeId, content, extraData });
      socketRef.current.emit('node-updated', {
        nodeId,
        content,
        position,
        ...extraData
      });
    }
  };

  // ノード削除通知
  const deleteNode = (nodeId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('node-delete', { nodeId });
    }
  };

  // ボードアクション送信（整列・クリア）
  const sendBoardAction = (action: 'relayout' | 'clear' | 'finalize') => {
    if (socketRef.current?.connected) {
      console.log('[Socket.IO] Sending board action:', action);
      socketRef.current.emit('board-action', { action });
    }
  };

  return {
    isConnected,
    error,
    lockNode,
    unlockNode,
    notifyNodeUpdate,
    deleteNode,
    sendBoardAction,
    socket: socketRef.current
  };
}
