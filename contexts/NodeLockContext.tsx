'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NodeLockInfo {
  nodeId: string;
  userId: string;
  userName: string;
  lockedAt: string;
}

interface NodeLockContextType {
  lockedNodes: Map<string, NodeLockInfo>;
  lockNode: (nodeId: string, userId: string, userName: string, lockedAt: string) => void;
  unlockNode: (nodeId: string) => void;
  isNodeLocked: (nodeId: string) => boolean;
  getNodeLockInfo: (nodeId: string) => NodeLockInfo | undefined;
  isNodeLockedByCurrentUser: (nodeId: string, currentUserId: string) => boolean;
}

const NodeLockContext = createContext<NodeLockContextType | undefined>(undefined);

export function NodeLockProvider({ children }: { children: ReactNode }) {
  const [lockedNodes, setLockedNodes] = useState<Map<string, NodeLockInfo>>(new Map());

  const lockNode = (nodeId: string, userId: string, userName: string, lockedAt: string) => {
    setLockedNodes(prev => {
      const newMap = new Map(prev);
      newMap.set(nodeId, { nodeId, userId, userName, lockedAt });
      return newMap;
    });
  };

  const unlockNode = (nodeId: string) => {
    setLockedNodes(prev => {
      const newMap = new Map(prev);
      newMap.delete(nodeId);
      return newMap;
    });
  };

  const isNodeLocked = (nodeId: string): boolean => {
    return lockedNodes.has(nodeId);
  };

  const getNodeLockInfo = (nodeId: string): NodeLockInfo | undefined => {
    return lockedNodes.get(nodeId);
  };

  const isNodeLockedByCurrentUser = (nodeId: string, currentUserId: string): boolean => {
    const lockInfo = lockedNodes.get(nodeId);
    return lockInfo?.userId === currentUserId;
  };

  return (
    <NodeLockContext.Provider
      value={{
        lockedNodes,
        lockNode,
        unlockNode,
        isNodeLocked,
        getNodeLockInfo,
        isNodeLockedByCurrentUser
      }}
    >
      {children}
    </NodeLockContext.Provider>
  );
}

export function useNodeLock() {
  const context = useContext(NodeLockContext);
  if (context === undefined) {
    throw new Error('useNodeLock must be used within a NodeLockProvider');
  }
  return context;
}