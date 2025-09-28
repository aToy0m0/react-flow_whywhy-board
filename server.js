const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// レイアウト定数（クライアント側のlayoutConstants.tsから移植）
const X_COL_GAP = 360;
const BASE_NODE_HEIGHT = 64;
const LINE_HEIGHT = 20;
const SIBLING_BLOCK_PAD = 32;

/**
 * サーバー側レイアウト計算（boardLayout.tsから移植）
 */
function computeServerSideLayout(nodes, edges) {
  // ルートノードを特定
  const rootNode = nodes.find(n => n.data.type === 'root');
  if (!rootNode) {
    console.warn('[Layout] Root node not found');
    return [];
  }

  // 全ノードのレイアウトを計算
  const layoutUpdates = [];
  const processed = new Set();

  // ルートノードは固定位置
  layoutUpdates.push({
    id: rootNode.id,
    x: 250,
    y: 100
  });
  processed.add(rootNode.id);

  // 幅優先探索でレイアウト計算
  const queue = [{ nodeId: rootNode.id, depth: 0 }];

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift();
    const children = getChildrenSorted(nodes, edges, nodeId);

    if (children.length > 0) {
      const parent = nodes.find(n => n.id === nodeId);
      const updatedChildren = computeLayoutForParent(nodes, edges, nodeId, layoutUpdates);

      // 計算結果をlayoutUpdatesに追加
      updatedChildren.forEach(child => {
        if (!processed.has(child.id)) {
          layoutUpdates.push({
            id: child.id,
            x: child.position.x,
            y: child.position.y
          });
          processed.add(child.id);
          queue.push({ nodeId: child.id, depth: depth + 1 });
        }
      });
    }
  }

  return layoutUpdates;
}

/**
 * 親ノード配下の座標を計算（boardLayout.tsから移植）
 */
function computeLayoutForParent(nodes, edges, parentId, currentUpdates) {
  const parent = nodes.find(n => n.id === parentId);
  if (!parent) return [];

  const children = getChildrenSorted(nodes, edges, parentId);
  if (children.length === 0) return [];

  // 親の現在位置を取得（layoutUpdatesから、または元の位置）
  const parentUpdate = currentUpdates.find(u => u.id === parentId);
  const parentPos = parentUpdate ?
    { x: parentUpdate.x, y: parentUpdate.y } :
    parent.position;

  // 子のX座標は親の右側へシフト
  const baseX = parentPos.x + X_COL_GAP;

  // 子孫探索用マップの構築
  const nodesById = new Map(nodes.map(n => [n.id, n]));
  const childrenMap = new Map();
  edges.forEach(e => {
    const arr = childrenMap.get(e.source) ?? [];
    arr.push(e.target);
    childrenMap.set(e.source, arr);
  });

  // ノードの実高さを概算
  const estimateHeight = (id) => {
    const node = nodesById.get(id);
    if (!node) return BASE_NODE_HEIGHT + SIBLING_BLOCK_PAD;

    // heightHintがあれば使用
    if (typeof node.data?.heightHint === 'number' && node.data.heightHint > 0) {
      return Math.ceil(node.data.heightHint) + SIBLING_BLOCK_PAD;
    }

    // ラベル行数から推定
    const lines = Math.max(1, String(node.data.label ?? '').split(/\r?\n/).length);
    return BASE_NODE_HEIGHT + (lines - 1) * LINE_HEIGHT + SIBLING_BLOCK_PAD;
  };

  // ブロック高さ計算（兄弟間の間隔も含む）
  const nodeBlockHeight = (id) => {
    const kids = childrenMap.get(id) ?? [];
    const own = estimateHeight(id);
    if (kids.length === 0) return own;

    // 子ノードのブロック高さの合計 + 兄弟間の間隔
    const sumKids = kids.reduce((acc, k) => acc + nodeBlockHeight(k), 0);
    const siblingGaps = Math.max(0, kids.length - 1) * SIBLING_BLOCK_PAD;

    return Math.max(own, sumKids + siblingGaps);
  };

  const childHeights = children.map(c => nodeBlockHeight(c.id));
  let cursor = parentPos.y;

  // 子ノードの位置を計算（兄弟ノード間に適切な間隔を追加）
  const result = children.map((child, idx) => {
    const h = childHeights[idx];
    const topY = cursor;

    // 次の兄弟との間隔: ブロック高さ + 兄弟間の間隔
    cursor += h;
    if (idx < children.length - 1) {
      cursor += SIBLING_BLOCK_PAD; // 兄弟間の間隔を追加
    }

    return {
      id: child.id,
      position: { x: baseX, y: topY },
      data: child.data
    };
  });

  // 原因ノードの特別処理
  const maxWhyX = Math.max(
    -Infinity,
    ...nodes.filter(n => n.data.type === 'why').map(n => {
      const update = currentUpdates.find(u => u.id === n.id);
      return update ? update.x : n.position.x;
    })
  );

  if (isFinite(maxWhyX)) {
    const causeX = maxWhyX + X_COL_GAP;
    return result.map(child =>
      child.data.type === 'cause' ?
        { ...child, position: { ...child.position, x: causeX } } :
        child
    );
  }

  return result;
}

/**
 * 親の子ノードを作成順でソート（boardLayout.tsから移植）
 */
function getChildrenSorted(nodes, edges, parentId) {
  return edges
    .filter(e => e.source === parentId)
    .map(e => nodes.find(n => n.id === e.target))
    .filter(Boolean)
    .sort((a, b) => (a.data.createdAt ?? 0) - (b.data.createdAt ?? 0));
}

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

  // Socket.IO インスタンスを Next.js API ルートから参照できるように公開
  try {
    globalThis.__whyBoardIO = io;
  } catch (error) {
    console.warn('[Socket.IO] Failed to expose global io instance', error);
  }

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
    console.log('[SOCK] conn', {
      id: socket.id,
      hs: socket.handshake.auth,
      q: socket.handshake.query,
      data: socket.data
    });

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

      // ack応答でリアルタイムモード確実化
      socket.emit('joined', { roomId, userId: socket.data.userId });

      // 他のユーザーに参加を通知
      socket.to(roomId).emit('user-joined', { userId, socketId: socket.id });
    });

    // ノードロック要求（ensure+lock原子化）
    socket.on('lock-node', async ({ nodeId, ensure }) => {
      const { roomId, userId, tenantId, boardKey } = socket.data;
      if (!roomId || !userId || userId === 'anonymous') {
        socket.emit('lock-error', { nodeId, error: 'Authentication required' });
        return;
      }

      try {
        // テナントIDの解決（スラグ→ID変換）
        console.log('[Socket.IO] Looking up tenant:', { tenantId });
        const tenant = await prisma.tenant.findUnique({
          where: { slug: tenantId },
          select: { id: true }
        });

        if (!tenant) {
          console.log('[Socket.IO] Tenant not found:', { tenantId });
          socket.emit('lock-error', { nodeId, error: 'Tenant not found' });
          return;
        }
        console.log('[Socket.IO] Found tenant:', { slug: tenantId, id: tenant.id });

        // ボードの取得または作成
        console.log('[Socket.IO] Looking up board:', { tenantId: tenant.id, boardKey });
        let board = await prisma.board.findUnique({
          where: { tenantId_boardKey: { tenantId: tenant.id, boardKey } },
          select: { id: true, status: true, deletedAt: true },
        });
        console.log('[Socket.IO] Board lookup result:', { found: !!board, boardId: board?.id });

        if (!board) {
          // ボードが存在しない場合は作成
          board = await prisma.board.create({
            data: {
              tenantId: tenant.id,
              boardKey,
              name: boardKey
            },
            select: { id: true, status: true, deletedAt: true }
          });

          // rootノードも作成
          await prisma.node.create({
            data: {
              boardId: board.id,
              tenantId: tenant.id,
              nodeKey: 'root',
              content: '',
              category: 'Root',
              depth: 0,
              tags: [],
              prevNodes: [],
              nextNodes: [],
              x: 250,
              y: 100,
              adopted: false
            }
          });

          console.log('[Socket.IO] Created board and root node:', { boardId: board.id, boardKey });
        }

        if (board.deletedAt) {
          socket.emit('lock-error', { nodeId, error: 'Board has been deleted' });
          return;
        }

        if (board.status === 'FINALIZED') {
          socket.emit('lock-error', { nodeId, error: 'Board is finalized' });
          return;
        }

        console.log('[Socket.IO] About to start transaction');
        // ensure+lockを1トランザクションで原子的実行
        console.log('[Socket.IO] Starting transaction for lock-node');
        const result = await prisma.$transaction(async (tx) => {
          console.log('[Socket.IO] Searching for node:', { boardId: board.id, nodeId });
          let node = await tx.node.findFirst({
            where: { boardId: board.id, OR: [{ id: nodeId }, { nodeKey: nodeId }] },
            select: { id: true, nodeKey: true },
          });

          console.log('[Socket.IO] Node search result:', { found: !!node, nodeId, ensure: !!ensure, ensureData: ensure });
          let nodeWasCreated = false;

          if (!node) {
            if (!ensure) {
              throw new Error('Node not found (no ensure payload)');
            }
            console.log('[Socket.IO] Creating new node with ensure data:', ensure);
            // ensureデータで正しい初期値を作成
            node = await tx.node.create({
              data: {
                boardId: board.id,
                tenantId: tenant.id,
                nodeKey: nodeId,
                content: ensure.content ?? '',
                x: ensure.position?.x ?? 0,
                y: ensure.position?.y ?? 0,
                category: ensure.category ?? 'Why',
                depth: ensure.depth ?? 0,
                tags: ensure.tags ?? [],
                prevNodes: ensure.prevNodes ?? [],
                nextNodes: ensure.nextNodes ?? [],
                adopted: ensure.adopted ?? false
              },
              select: { id: true, nodeKey: true }
            });
            nodeWasCreated = true;
            console.log('[Socket.IO] New node created successfully:', { nodeId: node.id, nodeKey: node.nodeKey });

            // 親ノードのnextNodesも更新
            if (ensure.prevNodes && ensure.prevNodes.length > 0) {
              for (const parentNodeKey of ensure.prevNodes) {
                const parentNode = await tx.node.findFirst({
                  where: { boardId: board.id, OR: [{ id: parentNodeKey }, { nodeKey: parentNodeKey }] }
                });
                if (parentNode) {
                  const currentNextNodes = parentNode.nextNodes || [];
                  if (!currentNextNodes.includes(nodeId)) {
                    await tx.node.update({
                      where: { id: parentNode.id },
                      data: { nextNodes: [...currentNextNodes, nodeId] }
                    });
                    console.log('[Socket.IO] Updated parent nextNodes:', { parentId: parentNode.nodeKey, childId: nodeId });
                  }
                }
              }
            }
          }

          // ロック処理
          console.log('[Socket.IO] Checking existing locks:', { nodeId: node.id, userId });
          const existing = await tx.nodeLock.findFirst({
            where: { nodeId: node.id, isActive: true },
            include: { user: { select: { id: true, email: true } } },
          });

          console.log('[Socket.IO] Existing lock check result:', { hasExisting: !!existing, conflictUserId: existing?.userId });
          if (existing && existing.userId !== userId) {
            return { kind: 'conflict', node, existing };
          }

          console.log('[Socket.IO] Creating/updating lock:', { hasExisting: !!existing, nodeId: node.id, userId });
          const lock = existing
            ? await tx.nodeLock.update({
                where: { id: existing.id },
                data: {
                  lockedAt: new Date(),
                  isActive: true,
                },
                include: { user: { select: { id: true, email: true } } }
              })
            : await tx.nodeLock.create({
                data: {
                  nodeId: node.id,
                  userId,
                  tenantId: tenant.id,
                  boardId: board.id,
                  isActive: true,
                },
                include: { user: { select: { id: true, email: true } } }
              });

          console.log('[Socket.IO] Lock operation successful:', { lockId: lock.id, userId: lock.userId });
          return { kind: 'ok', node, lock, nodeWasCreated };
        });

        console.log('[Socket.IO] Transaction completed:', { resultKind: result.kind });

        if (result.kind === 'conflict') {
          return socket.emit('lock-error', {
            nodeId,
            error: 'Node is locked by another user',
            lockedBy: result.existing.user
          });
        }

        console.log('[Socket.IO] Sending node-locked event:', { nodeId, userId, roomId });
        io.to(roomId).emit('node-locked', {
          nodeId,
          userId,
          userName: result.lock.user.email,
          lockedAt: result.lock.lockedAt,
        });
        console.log('[Socket.IO] node-locked event sent successfully');

        // 新規ノード作成時（ensure付き）の場合は再読み込み通知を送信
        if (ensure && result.nodeWasCreated) {
          io.to(roomId).emit('board-reload-required', {
            action: 'node-created',
            initiatedBy: userId,
            timestamp: new Date().toISOString(),
          });
          console.log('[Socket.IO] Board reload notification sent for new node creation');
        }
      } catch (e) {
        console.error('[Socket.IO] Lock-node error:', e);
        socket.emit('lock-error', { nodeId, error: e?.message || 'Internal server error' });
      }
    });

    // ノードロック解除
    socket.on('unlock-node', async ({ nodeId }) => {
      const { roomId, userId, tenantId, boardKey } = socket.data;
      if (!roomId || !userId || userId === 'anonymous') {
        socket.emit('unlock-error', { nodeId, error: 'Authentication required' });
        return;
      }

      try {
        // テナントIDの解決（スラグ→ID変換）
        const tenant = await prisma.tenant.findUnique({
          where: { slug: tenantId },
          select: { id: true }
        });

        if (!tenant) {
          socket.emit('unlock-error', { nodeId, error: 'Tenant not found' });
          return;
        }

        const board = await prisma.board.findUnique({
          where: { tenantId_boardKey: { tenantId: tenant.id, boardKey } },
          select: { id: true, status: true, deletedAt: true },
        });

        if (!board) {
          socket.emit('unlock-error', { nodeId, error: 'Board not found' });
          return;
        }

        if (board.deletedAt) {
          socket.emit('unlock-error', { nodeId, error: 'Board has been deleted' });
          return;
        }

        if (board.status === 'FINALIZED') {
          socket.emit('unlock-error', { nodeId, error: 'Board is finalized' });
          return;
        }

        let node = await prisma.node.findFirst({
          where: { boardId: board.id, OR: [{ id: nodeId }, { nodeKey: nodeId }] },
          select: { id: true },
        });

        // ノードが見つからなければ何もしない（ロック解除は冪等）
        if (!node) {
          console.log('[Socket.IO] Node not found for unlock (idempotent):', { nodeId });
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
      const { nodeId, content, position, adopted, type } = data;
      const { roomId, userId, tenantId, boardKey } = socket.data;
      if (!roomId || !tenantId || !boardKey || !userId || userId === 'anonymous') return;

      try {
        // 1) テナントIDの解決（スラグ→ID変換）
        const tenant = await prisma.tenant.findUnique({
          where: { slug: tenantId },
          select: { id: true }
        });

        if (!tenant) {
          socket.emit('node-save-error', { nodeId, error: 'Tenant not found' });
          return;
        }

        // 2) ボード特定（tenantId + boardKey）
        const board = await prisma.board.findUnique({
          where: { tenantId_boardKey: { tenantId: tenant.id, boardKey } },
          select: { id: true, status: true, deletedAt: true },
        });
        if (!board) {
          socket.emit('node-save-error', { nodeId, error: 'Board not found' });
          return;
        }

        if (board.deletedAt) {
          socket.emit('node-save-error', { nodeId, error: 'Board has been deleted' });
          return;
        }

        if (board.status === 'FINALIZED') {
          socket.emit('node-save-error', { nodeId, error: 'Board is finalized' });
          return;
        }

        // 3) ノード特定（DBの id OR nodeKey のどちらでもヒット）
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

        const publicId = node.nodeKey ?? node.id;

        const activeLock = await prisma.nodeLock.findFirst({
          where: { nodeId: node.id, isActive: true },
        });

        if (activeLock && activeLock.userId !== userId) {
          socket.emit('node-save-error', { nodeId, error: 'Node is locked by another user' });
          return;
        }

        // 位置変更のみの場合はロック検証をスキップ
        const isPositionOnlyUpdate = (content === undefined || content === node.content) && position;

        if (!isPositionOnlyUpdate) {
          const ownLock = await prisma.nodeLock.findFirst({
            where: { nodeId: node.id, userId, isActive: true },
          });
          if (!ownLock) {
            const reacquiredLock = await prisma.nodeLock.create({
              data: {
                nodeId: node.id,
                userId,
                tenantId: tenant.id,
                boardId: board.id,
                isActive: true,
              }
            });

            try {
              const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true }
              });
              io.to(roomId).emit('node-locked', {
                nodeId: publicId,
                userId,
                userName: user?.email ?? userId,
                lockedAt: reacquiredLock.lockedAt,
              });
            } catch (lockNotifyError) {
              console.warn('[Socket.IO] Failed to broadcast auto-lock reacquire', lockNotifyError);
            }
          }
        }

        // 4) パッチオブジェクト作成（空文字防止）
        const patch = {};
        if (content !== undefined && content !== '') patch.content = content;
        if (position?.x != null && position?.y != null) {
          patch.x = position.x;
          patch.y = position.y;
        }
        // 採用状態とタイプの更新
        if (adopted !== undefined) {
          patch.adopted = adopted;
          // 採用状態変更時にタイプも自動連動（root, actionは除外）
          if (node.category !== 'Root' && node.category !== 'Action') {
            patch.category = adopted ? 'Cause' : 'Why';
          }
        }
        if (type !== undefined) {
          // フロントエンドのタイプをPrismaカテゴリーに変換
          if (type === 'root') patch.category = 'Root';
          else if (type === 'cause') patch.category = 'Cause';
          else if (type === 'action') patch.category = 'Action';
          else if (type === 'why') patch.category = 'Why';
        }

        // 5) 履歴保存とノード更新をトランザクションで実行
        const updated = await prisma.$transaction(async (tx) => {
          await tx.nodeEdit.create({
            data: {
              nodeId: node.id,
              userId,
              action: isPositionOnlyUpdate ? 'position_update' : 'update',
              beforeData: {
                content: node.content,
                x: node.x,
                y: node.y,
                adopted: node.adopted,
                category: node.category
              },
              afterData: {
                content: patch.content ?? node.content,
                x: patch.x ?? node.x,
                y: patch.y ?? node.y,
                adopted: patch.adopted ?? node.adopted,
                category: patch.category ?? node.category,
              },
            },
          });

          return await tx.node.update({
            where: { id: node.id },
            data: patch,
          });
        });

        console.log(`[Socket.IO] Node ${isPositionOnlyUpdate ? 'position updated' : 'saved'} to DB:`, {
          nodeId: node.nodeKey ?? node.id,
          content: isPositionOnlyUpdate ? `moved to (${position.x}, ${position.y})` : content?.substring(0, 50) + '...',
          boardId: updated.boardId
        });

        // 6) ブロードキャスト（nodeKey を優先、なければ id）
        const broadcastData = {
          nodeId: publicId,
          content: updated.content,
          position: { x: updated.x, y: updated.y }, // 常に{x,y}形式
          userId,
          savedAt: new Date().toISOString(),
        };

        // 採用状態とタイプがある場合は含める
        if (patch.adopted !== undefined) broadcastData.adopted = updated.adopted;
        if (patch.category !== undefined) {
          // Prismaカテゴリーをフロントエンドタイプに変換
          if (updated.category === 'Root') broadcastData.type = 'root';
          else if (updated.category === 'Cause') broadcastData.type = 'cause';
          else if (updated.category === 'Action') broadcastData.type = 'action';
          else if (updated.category === 'Why') broadcastData.type = 'why';
        }

        socket.to(roomId).emit('node-updated', broadcastData);
        socket.emit('node-saved', { nodeId: publicId, savedAt: new Date().toISOString() });
      } catch (error) {
        console.error('[Socket.IO] Failed to save node to DB:', error);
        socket.emit('node-save-error', { nodeId, error: error.message });
      }
    });

    // ノード削除
    socket.on('node-delete', async ({ nodeId }) => {
      const { roomId, userId, tenantId, boardKey } = socket.data;
      if (!roomId || !userId || userId === 'anonymous') {
        socket.emit('node-delete-error', { nodeId, error: 'Authentication required' });
        return;
      }

      try {
        const tenant = await prisma.tenant.findUnique({
          where: { slug: tenantId },
          select: { id: true }
        });

        if (!tenant) {
          socket.emit('node-delete-error', { nodeId, error: 'Tenant not found' });
          return;
        }

        const board = await prisma.board.findUnique({
          where: { tenantId_boardKey: { tenantId: tenant.id, boardKey } },
          select: { id: true, status: true, deletedAt: true },
        });

        if (!board) {
          socket.emit('node-delete-error', { nodeId, error: 'Board not found' });
          return;
        }

        if (board.deletedAt) {
          socket.emit('node-delete-error', { nodeId, error: 'Board has been deleted' });
          return;
        }

        if (board.status === 'FINALIZED') {
          socket.emit('node-delete-error', { nodeId, error: 'Board is finalized' });
          return;
        }

        const node = await prisma.node.findFirst({
          where: {
            boardId: board.id,
            OR: [{ id: nodeId }, { nodeKey: nodeId }],
          },
          select: {
            id: true,
            nodeKey: true,
            content: true,
            category: true,
            x: true,
            y: true,
            adopted: true,
            prevNodes: true,
            nextNodes: true,
          },
        });

        if (!node) {
          socket.emit('node-delete-error', { nodeId, error: 'Node not found' });
          return;
        }

        if (node.nodeKey === 'root' || node.category === 'Root') {
          socket.emit('node-delete-error', { nodeId, error: 'Root node cannot be deleted' });
          return;
        }

        const publicId = node.nodeKey ?? node.id;

        const conflictingLock = await prisma.nodeLock.findFirst({
          where: { nodeId: node.id, isActive: true, userId: { not: userId } },
          include: {
            user: { select: { id: true, email: true } }
          }
        });

        if (conflictingLock) {
          socket.emit('node-delete-error', {
            nodeId,
            error: 'Node is locked by another user',
            lockedBy: conflictingLock.user,
          });
          return;
        }

        const now = new Date();

        await prisma.$transaction(async (tx) => {
          await tx.nodeLock.updateMany({
            where: { nodeId: node.id, isActive: true },
            data: { isActive: false, unlockedAt: now },
          });

          const parents = await tx.node.findMany({
            where: { boardId: board.id, nextNodes: { has: publicId } },
            select: { id: true, nextNodes: true },
          });
          for (const parent of parents) {
            const filtered = (parent.nextNodes ?? []).filter((childId) => childId !== publicId);
            await tx.node.update({
              where: { id: parent.id },
              data: { nextNodes: filtered },
            });
          }

          const children = await tx.node.findMany({
            where: { boardId: board.id, prevNodes: { has: publicId } },
            select: { id: true, prevNodes: true },
          });
          for (const child of children) {
            const filtered = (child.prevNodes ?? []).filter((parentId) => parentId !== publicId);
            await tx.node.update({
              where: { id: child.id },
              data: { prevNodes: filtered },
            });
          }

          await tx.nodeEdit.create({
            data: {
              nodeId: node.id,
              userId,
              action: 'delete',
              beforeData: {
                id: publicId,
                content: node.content,
                category: node.category,
                x: node.x,
                y: node.y,
                adopted: node.adopted,
                prevNodes: node.prevNodes,
                nextNodes: node.nextNodes,
              },
            },
          });

          await tx.node.delete({ where: { id: node.id } });
        });

        io.to(roomId).emit('nodes-unlocked', { userId, nodeIds: [publicId] });
        io.to(roomId).emit('node-deleted', {
          nodeId: publicId,
          deletedBy: userId,
          deletedAt: now.toISOString(),
        });
        socket.emit('node-delete-success', { nodeId: publicId });
      } catch (error) {
        console.error('[Socket.IO] Failed to delete node:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        socket.emit('node-delete-error', { nodeId, error: message });
      }
    });

    // ボードアクション（整列・クリア）の共有
    socket.on('board-action', async (data) => {
      const { action } = data;
      const { roomId, userId, tenantId, boardKey } = socket.data;
      if (!roomId || !userId || userId === 'anonymous') return;

      // actionの検証
      if (!['relayout', 'clear', 'finalize'].includes(action)) {
        console.log('[Socket.IO] Invalid board action:', action);
        return;
      }

      try {
        console.log(`[Socket.IO] Board action ${action} by ${userId} in room ${roomId}`);
        const timestamp = new Date().toISOString();

        // 1) テナントIDの解決（スラグ→ID変換）
        const tenant = await prisma.tenant.findUnique({
          where: { slug: tenantId },
          select: { id: true }
        });

        if (!tenant) {
          console.log('[Socket.IO] Tenant not found for board action:', { tenantId });
          return;
        }

        // 2) ボード特定（tenantId + boardKey）
        const board = await prisma.board.findUnique({
          where: { tenantId_boardKey: { tenantId: tenant.id, boardKey } },
          select: { id: true, status: true, deletedAt: true },
        });

        if (!board) {
          console.log('[Socket.IO] Board not found for board action:', { tenantId: tenant.id, boardKey });
          socket.emit('board-action-error', { action, error: 'Board not found' });
          return;
        }

        if (board.deletedAt) {
          socket.emit('board-action-error', { action, error: 'Board has been deleted' });
          return;
        }

        if (board.status === 'FINALIZED' && action !== 'finalize') {
          socket.emit('board-action-error', { action, error: 'Board is finalized' });
          return;
        }

        if (action === 'clear') {
          // クリア: rootノード以外を削除
          await prisma.$transaction(async (tx) => {
            // rootノード以外のノードを削除
            await tx.node.deleteMany({
              where: {
                boardId: board.id,
                NOT: { nodeKey: 'root' }
              }
            });

            // rootノードをリセット
            await tx.node.updateMany({
              where: {
                boardId: board.id,
                nodeKey: 'root'
              },
              data: {
                content: '',
                x: 250,
                y: 100,
                nextNodes: [],
                prevNodes: []
              }
            });
          });

          console.log(`[Socket.IO] Board cleared: ${boardKey}`);

        } else if (action === 'relayout') {
          // 整列: サーバー側でレイアウト計算（改善版）
          const nodes = await prisma.node.findMany({
            where: { boardId: board.id },
            orderBy: { createdAt: 'asc' }
          });

          // Prisma Node を React Flow 形式に変換
          const rfNodes = nodes.map(node => ({
            id: node.nodeKey || node.id,
            position: { x: node.x, y: node.y },
            data: {
              label: node.content,
              type: node.category.toLowerCase(), // Root -> root, Why -> why, etc.
              createdAt: node.createdAt.getTime(),
              heightHint: node.uiHeight
            }
          }));

          // エッジを構築（prevNodes/nextNodes から）
          const rfEdges = [];
          nodes.forEach(node => {
            const nodeId = node.nodeKey || node.id;
            node.nextNodes.forEach(nextNodeKey => {
              rfEdges.push({
                id: `${nodeId}-${nextNodeKey}`,
                source: nodeId,
                target: nextNodeKey
              });
            });
          });

          // レイアウト計算（boardLayout.ts ロジックを移植）
          const layoutUpdates = computeServerSideLayout(rfNodes, rfEdges);

          // DB更新
          await prisma.$transaction(async (tx) => {
            for (const update of layoutUpdates) {
              // nodeKey または id でマッチするノードを更新
              const node = nodes.find(n => (n.nodeKey || n.id) === update.id);
              if (node) {
                await tx.node.update({
                  where: { id: node.id },
                  data: { x: update.x, y: update.y }
                });
              }
            }
          });

          console.log(`[Socket.IO] Board relayout completed: ${boardKey}, updated ${layoutUpdates.length} nodes`);
        } else if (action === 'finalize') {
          if (board.status === 'FINALIZED') {
            socket.emit('board-action-error', { action, error: 'Board already finalized' });
            return;
          }

          const activeLocks = await prisma.nodeLock.findMany({
            where: { isActive: true, node: { boardId: board.id } },
            include: { node: { select: { nodeKey: true, id: true } } }
          });

          await prisma.$transaction(async (tx) => {
            await tx.nodeLock.updateMany({
              where: { isActive: true, node: { boardId: board.id } },
              data: { isActive: false, unlockedAt: new Date() }
            });

            await tx.board.update({
              where: { id: board.id },
              data: { status: 'FINALIZED', finalizedAt: new Date() }
            });
          });

          const unlockedNodeIds = activeLocks
            .map((lock) => lock.node?.nodeKey ?? lock.node?.id)
            .filter((id) => typeof id === 'string');

          if (unlockedNodeIds.length > 0) {
            io.to(roomId).emit('nodes-unlocked', {
              userId,
              nodeIds: unlockedNodeIds,
            });
          }

          io.to(roomId).emit('board-finalized', {
            status: 'finalized',
            initiatedBy: userId,
            finalizedAt: timestamp,
          });

          console.log(`[Socket.IO] Board finalized: ${boardKey}`);
        }

        // 2.5) 全クライアントへアクション通知
        io.to(roomId).emit('board-action', {
          action,
          initiatedBy: userId,
          timestamp,
        });

        // 3) 全クライアント（実行者含む）に再読み込み指示
        io.to(roomId).emit('board-reload-required', {
          action,
          initiatedBy: userId,
          timestamp,
        });

        console.log(`[Socket.IO] Board reload notification sent to room ${roomId}`);

      } catch (error) {
        console.error('[Socket.IO] Error processing board action:', error);
      }
    });

    // 切断処理
    socket.on('disconnect', async (reason) => {
      const { roomId, userId } = socket.data;

      console.log('[Socket.IO] Client disconnected:', {
        socketId: socket.id,
        roomId,
        userId,
        reason
      });

      if (roomId && userId) {
        const disconnectedAt = new Date().toISOString();
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

        if (reason === 'ping timeout') {
          io.to(roomId).emit('user-timeout', { userId, lastSeenAt: disconnectedAt });
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
