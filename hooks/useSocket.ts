import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  tenantId: string;
  boardKey: string;
  userId: string;
  onNodeLocked?: (data: { nodeId: string; userId: string; userName: string; lockedAt: string }) => void;
  onNodeUnlocked?: (data: { nodeId: string; userId: string }) => void;
  onNodeUpdated?: (data: { nodeId: string; content: string; position: { x: number; y: number }; userId: string }) => void;
  onUserJoined?: (data: { userId: string; socketId: string }) => void;
  onUserLeft?: (data: { userId: string; socketId: string }) => void;
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
    onUserLeft
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

  useEffect(() => { lockedRef.current = onNodeLocked; }, [onNodeLocked]);
  useEffect(() => { unlockedRef.current = onNodeUnlocked; }, [onNodeUnlocked]);
  useEffect(() => { updatedRef.current = onNodeUpdated; }, [onNodeUpdated]);
  useEffect(() => { joinedRef.current = onUserJoined; }, [onUserJoined]);
  useEffect(() => { leftRef.current = onUserLeft; }, [onUserLeft]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!tenantId || !boardKey || !userId) return;

    // 既存socketがあれば使う（作り直さない）
    if (!socketRef.current) {
      socketRef.current = io({
        transports: ['websocket'], // まずWSだけで安定化を確認
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionAttempts: 10,
        auth: { tenantId, boardKey, userId }, // ハンドシェイクで渡す
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
      s.on('node-updated', (d) => updatedRef.current?.(d));
      s.on('user-joined', (d) => joinedRef.current?.(d));
      s.on('user-left', (d) => leftRef.current?.(d));

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
        console.error('[Socket.IO] Unlock error:', data);
        setError(`Unlock error: ${data.error}`);
      });

      s.on('node-saved', (data) => {
        console.log('[Socket.IO] Node saved:', data);
      });

      s.on('node-save-error', (data) => {
        console.error('[Socket.IO] Node save error:', data);
        setError(`Save error: ${data.error}`);
      });
    }

    return () => {
      // 依存が変わっても即破棄しない（チラつきを防ぐ）
      // socketRef.current?.off(...); // 各イベントoff
      // socketRef.current?.disconnect();
      // socketRef.current = null;
    };
  }, [tenantId, boardKey, userId]); // ← 不要に増やさない

  // ノードロック要求（ensure+lock原子化）
  const lockNode = (nodeId: string, ensure?: {
    content?: string;
    position?: { x: number; y: number };
    category?: string;
    depth?: number;
    tags?: string[];
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

  // ノード更新通知（シンプル版）
  const notifyNodeUpdate = (nodeId: string, content: string, position?: { x: number; y: number }) => {
    if (socketRef.current?.connected) {
      console.log('[Socket.IO] Sending node update:', { nodeId, content });
      socketRef.current.emit('node-updated', {
        nodeId,
        content,
        position
      });
    }
  };

  return {
    isConnected,
    error,
    lockNode,
    unlockNode,
    notifyNodeUpdate,
    socket: socketRef.current
  };
}