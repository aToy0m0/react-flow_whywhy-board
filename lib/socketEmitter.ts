import type { Server as SocketIOServer } from 'socket.io';

declare global {
  // eslint-disable-next-line no-var
  var __whyBoardIO: SocketIOServer | undefined;
}

type BoardDeletedPayload = {
  boardId: string;
  boardKey: string;
  initiatedBy: string;
  deletedAt: string;
  redirectTo: string;
};

export function getSocketServer(): SocketIOServer | undefined {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }
  return globalThis.__whyBoardIO;
}

export function emitBoardDeleted(roomId: string, payload: BoardDeletedPayload): boolean {
  const io = getSocketServer();
  if (!io) {
    console.warn('[SocketEmitter] Socket server not ready for board-deleted emit', { roomId });
    return false;
  }

  io.to(roomId).emit('board-deleted', payload);
  return true;
}
