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

  // Socket.IOの名前空間とイベント処理
  io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

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
    socket.on('lock-node', async (data) => {
      const { nodeId } = data;
      const { roomId, userId } = socket.data;

      if (!roomId || !userId) {
        socket.emit('lock-error', {
          nodeId,
          error: 'Not joined to any board'
        });
        return;
      }

      console.log('[Socket.IO] Lock node request:', {
        nodeId,
        userId,
        roomId
      });

      try {
        // APIを呼び出してロックを取得
        const response = await fetch(`http://localhost:${port}/api/tenants/${socket.data.tenantId}/boards/${socket.data.boardKey}/nodes/${nodeId}/lock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 実際の実装では認証ヘッダーも必要
          }
        });

        const result = await response.json();

        if (result.ok) {
          // ロック成功 - 全クライアントに通知
          io.to(roomId).emit('node-locked', {
            nodeId,
            userId,
            userName: result.lock.user.email,
            lockedAt: result.lock.lockedAt
          });
        } else {
          // ロック失敗
          socket.emit('lock-error', {
            nodeId,
            error: result.error,
            lockedBy: result.lockedBy
          });
        }
      } catch (error) {
        console.error('[Socket.IO] Lock node error:', error);
        socket.emit('lock-error', {
          nodeId,
          error: 'Internal server error'
        });
      }
    });

    // ノードロック解除
    socket.on('unlock-node', async (data) => {
      const { nodeId } = data;
      const { roomId, userId } = socket.data;

      if (!roomId || !userId) {
        socket.emit('unlock-error', {
          nodeId,
          error: 'Not joined to any board'
        });
        return;
      }

      console.log('[Socket.IO] Unlock node request:', {
        nodeId,
        userId,
        roomId
      });

      try {
        // APIを呼び出してロックを解除
        const response = await fetch(`http://localhost:${port}/api/tenants/${socket.data.tenantId}/boards/${socket.data.boardKey}/nodes/${nodeId}/lock`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            // 実際の実装では認証ヘッダーも必要
          }
        });

        const result = await response.json();

        if (result.ok) {
          // ロック解除成功 - 全クライアントに通知
          io.to(roomId).emit('node-unlocked', {
            nodeId,
            userId
          });
        } else {
          socket.emit('unlock-error', {
            nodeId,
            error: result.error
          });
        }
      } catch (error) {
        console.error('[Socket.IO] Unlock node error:', error);
        socket.emit('unlock-error', {
          nodeId,
          error: 'Internal server error'
        });
      }
    });

    // ノード更新通知
    socket.on('node-updated', async (data) => {
      const { nodeId, content, position } = data;
      const { roomId, userId } = socket.data;

      if (!roomId) return;

      console.log('[Socket.IO] Node updated:', { nodeId, userId, content });

      try {
        // ノードが存在するか確認
        const existingNode = await prisma.node.findUnique({
          where: { id: nodeId }
        });

        if (!existingNode) {
          console.error('[Socket.IO] Node not found in DB:', nodeId);
          socket.emit('node-save-error', {
            nodeId,
            error: 'Node not found'
          });
          return;
        }

        // DBに保存
        const updatedNode = await prisma.node.update({
          where: { id: nodeId },
          data: {
            content: content || '',
            ...(position ? { x: position.x, y: position.y } : {})
          }
        });

        console.log('[Socket.IO] Node saved to DB:', {
          nodeId,
          content: content?.substring(0, 50) + '...',
          boardId: updatedNode.boardId
        });

        // 保存成功後、自分以外に更新を通知
        socket.to(roomId).emit('node-updated', {
          nodeId,
          content,
          position,
          userId,
          savedAt: new Date().toISOString()
        });

        // 自分にも保存完了を通知
        socket.emit('node-saved', {
          nodeId,
          savedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error('[Socket.IO] Failed to save node to DB:', error);
        socket.emit('node-save-error', {
          nodeId,
          error: error.message
        });
      }
    });

    // 切断処理
    socket.on('disconnect', () => {
      const { roomId, userId } = socket.data;

      console.log('[Socket.IO] Client disconnected:', {
        socketId: socket.id,
        roomId,
        userId
      });

      if (roomId && userId) {
        // TODO: 切断時にアクティブロックを自動解除する処理を追加
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