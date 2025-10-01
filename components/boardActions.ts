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
  saveRemote: () => Promise<void>;
  loadRemote: () => Promise<void>;
  exportToml: () => void;
  importTomlText: (text: string) => void;
  exportSvg: () => Promise<void>;  // 追加: SVG書き出し
  exportPng: () => Promise<void>;
  clearBoard: () => void;   // 追加: 盤面クリア
  relayoutAll: () => void;  // 追加: 全体整列
  finalizeBoard: () => void; // 追加: ボード成立
  fitView: () => void;      // 追加: 表示領域にフィット
  sendBoardAction: (action: 'relayout' | 'clear' | 'finalize') => void;  // 追加: ボードアクション送信
};
