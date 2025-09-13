export type { NodeType, WhyNodeData } from "./boardTypes";

export type SerializedNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  type: "root" | "why" | "cause" | "action";
  adopted?: boolean;
  createdAt?: number;
  uiHeight?: number;
};

export type SerializedEdge = {
  id: string;
  source: string;
  target: string;
};

export type SerializedGraph = {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
};

export type BoardHandle = {
  saveLocal: () => void;
  loadLocal: () => void;
  exportToml: () => void;
  importTomlText: (text: string) => void;
  exportPng: () => Promise<void>;
  clearBoard: () => void;   // 追加: 盤面クリア
  relayoutAll: () => void;  // 追加: 全体整列
  fitView: () => void;      // 追加: 表示領域にフィット
};
