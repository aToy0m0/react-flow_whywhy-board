import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  tenantId: string;
  boardKey: string;
  userId: string;
  onNodeLocked?: (data: { nodeId: string; userId: string; userName: string; lockedAt: string }) => void;
  onNodeUnlocked?: (data: { nodeId: string; userId: string }) => void;
  onNodeUpdated?: (data: { nodeId: string; content: string; position?: { x: number; y: number }; userId: string }) => void;
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

  useEffect(() => {
    // 既存の接続があれば切断
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    // Socket.IO接続
    const socket = io({
      transports: ['polling', 'websocket'], // pollingを先に試す
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
      timeout: 10000,
      forceNew: true,
      upgrade: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected:', socket.id, { tenantId, boardKey, userId });
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;

      // ボードルームに参加
      socket.emit('join-board', {
        tenantId,
        boardKey,
        userId
      });
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket.IO] Connection error:', err);
      setError(err.message);
      setIsConnected(false);
    });

    // ノードロックイベント
    socket.on('node-locked', (data) => {
      console.log('[Socket.IO] Node locked:', data);
      onNodeLocked?.(data);
    });

    socket.on('node-unlocked', (data) => {
      console.log('[Socket.IO] Node unlocked:', data);
      onNodeUnlocked?.(data);
    });

    socket.on('lock-error', (data) => {
      console.error('[Socket.IO] Lock error:', data);
      setError(`Lock error: ${data.error}`);
    });

    socket.on('unlock-error', (data) => {
      console.error('[Socket.IO] Unlock error:', data);
      setError(`Unlock error: ${data.error}`);
    });

    // ノード更新イベント
    socket.on('node-updated', (data) => {
      console.log('[Socket.IO] Node updated:', data);
      onNodeUpdated?.(data);
    });

    socket.on('node-saved', (data) => {
      console.log('[Socket.IO] Node saved:', data);
    });

    socket.on('node-save-error', (data) => {
      console.error('[Socket.IO] Node save error:', data);
      setError(`Save error: ${data.error}`);
    });

    // ユーザー参加/離脱イベント
    socket.on('user-joined', (data) => {
      console.log('[Socket.IO] User joined:', data);
      onUserJoined?.(data);
    });

    socket.on('user-left', (data) => {
      console.log('[Socket.IO] User left:', data);
      onUserLeft?.(data);
    });

    return () => {
      // 未完了のタイマーをクリア
      debounceTimers.current.forEach(timer => clearTimeout(timer));
      debounceTimers.current.clear();

      socket.disconnect();
    };
  }, [tenantId, boardKey, userId, onNodeLocked, onNodeUnlocked, onNodeUpdated, onUserJoined, onUserLeft]);

  // ノードロック要求
  const lockNode = (nodeId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('lock-node', { nodeId });
    }
  };

  // ノードロック解除
  const unlockNode = (nodeId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unlock-node', { nodeId });
    }
  };

  // デバウンス用タイマー管理
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ノード更新通知（デバウンス機能付き）
  const notifyNodeUpdate = (nodeId: string, content: string, position?: { x: number; y: number }) => {
    if (!socketRef.current?.connected) return;

    // 既存のタイマーをクリア
    const existingTimer = debounceTimers.current.get(nodeId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 新しいタイマーを設定（1秒後に送信）
    const timer = setTimeout(() => {
      if (socketRef.current?.connected) {
        console.log('[Socket.IO] Sending node update:', { nodeId, content });
        socketRef.current.emit('node-updated', {
          nodeId,
          content,
          position
        });
      }
      debounceTimers.current.delete(nodeId);
    }, 1000);

    debounceTimers.current.set(nodeId, timer);
  };

  return {
    isConnected,
    error,
    lockNode,
    unlockNode,
    notifyNodeUpdate
  };
}