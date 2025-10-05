export type NodeType = "root" | "why" | "cause" | "action";

export type WhyNodeData = {
  label: string;
  type: NodeType;
  adopted?: boolean;
  boardId: string;
  createdAt?: number;
  heightHint?: number; // 既知のUI高さ（複数行対応のため）
  onChangeLabel: (id: string, value: string) => void;
  onToggleAdopted?: (id: string, value: boolean) => void;
  getParentInfo: (id: string) => { parentLabel?: string; index?: number };
  hasChildren: (id: string) => boolean;
  hasCauseDescendant?: (id: string) => boolean;
  canDelete: (id: string) => boolean;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, type?: NodeType) => void;
  onUpdateHeight?: (id: string, height: number) => void;
  openMenu: (id: string) => void;
  closeMenu: () => void;
  isMenuOpen: boolean;
  // ロック機能
  currentUserId?: string;
  currentUserName?: string;
  lockNode?: (nodeId: string) => void;
  unlockNode?: (nodeId: string) => void;
  // Socket.IO同期機能
  notifyNodeUpdate?: (nodeId: string, content: string, position?: { x: number; y: number }, extraData?: { adopted?: boolean; type?: string }) => void;
  registerPendingUpdate?: (nodeId: string, payload: { content: string; extra?: { adopted?: boolean; type?: string } }) => void;
  flushPendingUpdate?: (nodeId: string) => void;
};
