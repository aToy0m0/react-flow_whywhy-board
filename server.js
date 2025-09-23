const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : true,
      methods: ["GET", "POST"],
      credentials: true
    },
    allowEIO3: true,
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // ハンドシェイク認証ミドルウェア
  io.use((socket, next) => {
    const a = socket.handshake.auth || socket.handshake.query || {};
    const { tenantId, boardKey, userId } = a;
    if (tenantId && boardKey && userId) {
      socket.data = { tenantId, boardKey, userId, roomId: `${tenantId}:${boardKey}` };
    }
    next();
  });

  // Socket.IOの名前空間とイベント処理
  io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    // ハンドシェイクでデータがある場合は自動参加
    if (socket.data?.roomId) {
      socket.join(socket.data.roomId);
      console.log('[Socket.IO] Auto-joined room from handshake:', {
        socketId: socket.id,
        roomId: socket.data.roomId,
        userId: socket.data.userId
      });

      // 他のユーザーに参加を通知
      socket.to(socket.data.roomId).emit('user-joined', {
        userId: socket.data.userId,
        socketId: socket.id
      });
    }

    // ボードルームに参加
    socket.on('join-board', (data) => {
      const { tenantId, boardKey, userId } = data;
      const roomId = `${tenantId}:${boardKey}`;

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;
      socket.data.tenantId = tenantId;
      socket.data.boardKey = boardKey;

      console.log('[Socket.IO] User joined board:', {
        socketId: socket.id,
        roomId,
        userId
      });

      // 他のユーザーに参加を通知
      socket.to(roomId).emit('user-joined', { userId, socketId: socket.id });
    });

    // ノードロック要求
    socket.on('lock-node', async ({ nodeId }) => {
      const { roomId, userId, tenantId, boardKey } = socket.data;
      if (!roomId || !userId) {
        socket.emit('lock-error', { nodeId, error: 'Not joined to any board' });
        return;
      }

      try {
        const board = await prisma.board.findUnique({
          where: { tenantId_boardKey: { tenantId, boardKey } },
          select: { id: true },
        });
        const node = board && await prisma.node.findFirst({
          where: { boardId: board.id, OR: [{ id: nodeId }, { nodeKey: nodeId }] },
          select: { id: true },
        });
        if (!node) {
          socket.emit('lock-error', { nodeId, error: 'Node not found' });
          return;
        }

        // 既存ロック確認
        const existing = await prisma.nodeLock.findFirst({
          where: { nodeId: node.id, isActive: true },
          include: { user: { select: { id: true, email: true } } },
        });

        if (existing) {
          if (existing.userId === userId) {
            // 自分のロックは延長
            const updated = await prisma.nodeLock.update({
              where: { id: existing.id },
              data: { lockedAt: new Date() },
              include: { user: { select: { id: true, email: true } } },
            });
            io.to(roomId).emit('node-locked', {
              nodeId,
              userId,
              userName: updated.user.email,
              lockedAt: updated.lockedAt,
            });
            return;
          }
          socket.emit('lock-error', { nodeId, error: 'Node is locked by another user', lockedBy: existing.user });
          return;
        }

        // 新規ロック
        const created = await prisma.nodeLock.create({
          data: { nodeId: node.id, userId, isActive: true },
          include: { user: { select: { id: true, email: true } } },
        });

        io.to(roomId).emit('node-locked', {
          nodeId,
          userId,
          userName: created.user.email,
          lockedAt: created.lockedAt,
        });
      } catch (e) {
        console.error(e);
        socket.emit('lock-error', { nodeId, error: 'Internal server error' });
      }
    });

    // ノードロック解除
    socket.on('unlock-node', async ({ nodeId }) => {
      const { roomId, userId, tenantId, boardKey } = socket.data;
      if (!roomId || !userId) {
        socket.emit('unlock-error', { nodeId, error: 'Not joined to any board' });
        return;
      }

      try {
        const board = await prisma.board.findUnique({
          where: { tenantId_boardKey: { tenantId, boardKey } },
          select: { id: true },
        });
        const node = board && await prisma.node.findFirst({
          where: { boardId: board.id, OR: [{ id: nodeId }, { nodeKey: nodeId }] },
          select: { id: true },
        });
        if (!node) {
          socket.emit('unlock-error', { nodeId, error: 'Node not found' });
          return;
        }

        // 自分のアクティブロックを解除
        const updated = await prisma.nodeLock.updateMany({
          where: { nodeId: node.id, userId, isActive: true },
          data: { isActive: false, unlockedAt: new Date() },
        });

        if (updated.count > 0) {
          io.to(roomId).emit('node-unlocked', { nodeId, userId });
        } else {
          socket.emit('unlock-error', { nodeId, error: 'No active lock found' });
        }
      } catch (e) {
        console.error(e);
        socket.emit('unlock-error', { nodeId, error: 'Internal server error' });
      }
    });

    // ノード更新通知
    socket.on('node-updated', async (data) => {
      const { nodeId, content, position } = data;
      const { roomId, userId, tenantId, boardKey } = socket.data;
      if (!roomId || !tenantId || !boardKey) return;

      try {
        // 1) ボード特定（tenantId + boardKey）
        const board = await prisma.board.findUnique({
          where: { tenantId_boardKey: { tenantId, boardKey } },
          select: { id: true },
        });
        if (!board) {
          socket.emit('node-save-error', { nodeId, error: 'Board not found' });
          return;
        }

        // 2) ノード特定（DBの id OR nodeKey のどちらでもヒット）
        const node = await prisma.node.findFirst({
          where: {
            boardId: board.id,
            OR: [{ id: nodeId }, { nodeKey: nodeId }],
          },
        });
        if (!node) {
          socket.emit('node-save-error', { nodeId, error: 'Node not found' });
          return;
        }

        // 3) （任意だが推奨）ロック検証：自分のアクティブロックがあるか
        const activeLock = await prisma.nodeLock.findFirst({
          where: { nodeId: node.id, userId, isActive: true },
        });
        if (!activeLock) {
          socket.emit('node-save-error', { nodeId, error: 'No active lock' });
          return;
        }

        // 4) パッチオブジェクト作成（空文字防止）
        const patch = {};
        if (content !== undefined && content !== '') patch.content = content;
        if (position?.x != null && position?.y != null) {
          patch.x = position.x;
          patch.y = position.y;
        }

        // 5) 履歴保存とノード更新をトランザクションで実行
        const updated = await prisma.$transaction(async (tx) => {
          await tx.nodeEdit.create({
            data: {
              nodeId: node.id,
              userId,
              action: 'update',
              beforeData: { content: node.content, x: node.x, y: node.y },
              afterData: {
                content: patch.content ?? node.content,
                x: patch.x ?? node.x,
                y: patch.y ?? node.y,
              },
            },
          });

          return await tx.node.update({
            where: { id: node.id },
            data: patch,
          });
        });

        console.log('[Socket.IO] Node saved to DB:', {
          nodeId: node.nodeKey ?? node.id,
          content: content?.substring(0, 50) + '...',
          boardId: updated.boardId
        });

        // 6) ブロードキャスト（nodeKey を優先、なければ id）
        const publicId = node.nodeKey ?? node.id;
        socket.to(roomId).emit('node-updated', {
          nodeId: publicId,
          content: updated.content,
          position: { x: updated.x, y: updated.y },
          userId,
          savedAt: new Date().toISOString(),
        });
        socket.emit('node-saved', { nodeId: publicId, savedAt: new Date().toISOString() });
      } catch (error) {
        console.error('[Socket.IO] Failed to save node to DB:', error);
        socket.emit('node-save-error', { nodeId, error: error.message });
      }
    });

    // 切断処理
    socket.on('disconnect', async () => {
      const { roomId, userId } = socket.data;

      console.log('[Socket.IO] Client disconnected:', {
        socketId: socket.id,
        roomId,
        userId
      });

      if (roomId && userId) {
        try {
          // 切断前にアクティブロック中のnodeIdを取得
          const activeLocks = await prisma.nodeLock.findMany({
            where: { userId, isActive: true },
            include: { node: { select: { id: true, nodeKey: true } } }
          });

          if (activeLocks.length > 0) {
            // アクティブロックを解除
            await prisma.nodeLock.updateMany({
              where: { userId, isActive: true },
              data: { isActive: false, unlockedAt: new Date() }
            });

            // 解除されたノードのIDリスト（nodeKeyを優先）
            const unlockedNodeIds = activeLocks.map(lock =>
              lock.node.nodeKey ?? lock.node.id
            );

            console.log(`[Socket.IO] Auto-unlocked ${activeLocks.length} nodes for user ${userId}:`, unlockedNodeIds);

            // 具体的なnodeIdリストで通知（自分含む全員へ）
            io.to(roomId).emit('nodes-unlocked', {
              userId,
              nodeIds: unlockedNodeIds
            });
          }
        } catch (error) {
          console.error('[Socket.IO] Error during auto-unlock:', error);
        }

        socket.to(roomId).emit('user-left', { userId, socketId: socket.id });
      }
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> LAN access: http://[your-machine-ip]:${port}`);
    });
});