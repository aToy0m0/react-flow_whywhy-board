"use client";
import { memo } from "react";
import { Handle, Position, NodeProps, NodeToolbar } from "@xyflow/react";
import type { Node as RFNode } from "@xyflow/react";
import clsx from "clsx";
import type { NodeType, WhyNodeData } from "./boardTypes";

const colors: Record<NodeType, { border: string; bg: string }> = {
  root: { border: "border-red-500", bg: "bg-red-50" },
  why: { border: "border-gray-500", bg: "bg-gray-50" },
  cause: { border: "border-green-600", bg: "bg-green-50" },
  action: { border: "border-blue-600", bg: "bg-blue-50" },
};

function Header({ type, parentLabel, index }: { type: NodeType; parentLabel?: string; index?: number; adopted?: boolean }) {
  if (type === "root") return <div className="text-sm font-semibold">問題</div>;
  if (type === "cause") {
    // return <div className="text-sm font-semibold">原因｜{parentLabel ?? ""} はなぜか</div>;
    return <div className="text-sm font-semibold">原因</div>;
  }
  if (type === "action") {
    return <div className="text-sm font-semibold">対策</div>;
  }
  return (
    <div className="text-sm font-semibold flex items-center gap-2">
      {/* <span>なぜ{index ?? 0}｜{parentLabel ?? ""} はなぜか</span> */}
      <span>なぜ{index ?? 0}</span>
    </div>
  );
}

function WhyNodeImpl({ id, data, selected }: NodeProps<RFNode<WhyNodeData>>) {
  const d = data as WhyNodeData; // 型を明示
  const { parentLabel, index } = d.getParentInfo(id);

  const placeholder = d.type === "root" ? "問題" : d.type === "action" ? "対策" : "○○がｘｘだから";

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        d.openMenu(id);
      }}
      className={clsx(
        "rounded-md border shadow-sm px-3 py-2 w-[260px]",
        colors[d.type].border,
        colors[d.type].bg,
        selected && "ring-2 ring-blue-400"
      )}
    >
      <NodeToolbar isVisible={d.isMenuOpen} position={Position.Top} className="!p-1">
        <div className="flex flex-col bg-white border rounded-md shadow-md overflow-hidden min-w-[160px]">
          <button
            disabled={d.type === "action" || d.type === "cause"}
            className={clsx(
              "px-3 py-2 text-left hover:bg-gray-100",
              (d.type === "action" || d.type === "cause") && "opacity-50 cursor-not-allowed"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!(d.type === "action" || d.type === "cause")) d.onAddChild(id, "why");
              d.closeMenu();
            }}
          >
            なぜを追加
          </button>
          <button
            disabled={d.type === "action" || d.type === "cause"}
            className={clsx(
              "px-3 py-2 text-left hover:bg-gray-100",
              (d.type === "action" || d.type === "cause") && "opacity-50 cursor-not-allowed"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!(d.type === "action" || d.type === "cause")) d.onAddChild(id, "cause");
              d.closeMenu();
            }}
          >
            原因を追加
          </button>
          <button
            disabled={d.type !== "cause"}
            className={clsx(
              "px-3 py-2 text-left hover:bg-gray-100",
              d.type !== "cause" && "opacity-50 cursor-not-allowed"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (d.type === "cause") d.onAddChild(id, "action");
              d.closeMenu();
            }}
          >
            対策を追加
          </button>
          <button
            disabled={!d.canDelete(id)}
            className={clsx(
              "px-3 py-2 text-left hover:bg-gray-100 border-t",
              !d.canDelete(id) && "opacity-50 cursor-not-allowed"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (d.canDelete(id)) d.onDelete(id);
              d.closeMenu();
            }}
          >
            ノードを削除
          </button>
        </div>
      </NodeToolbar>
      <div className="flex items-center">
        <Header type={d.type} parentLabel={parentLabel} index={index} />
        {(d.type === "why" || d.type === "cause") && (
          <label className="ml-auto inline-flex items-center gap-1 text-xs text-gray-600 select-none">
            <input
              type="checkbox"
              checked={!!d.adopted}
              disabled={d.type === "why" && (d.hasChildren(id) || d.hasCauseDescendant?.(id))}
              onChange={(e) => d.onToggleAdopted?.(id, e.target.checked)}
            />
            採用
          </label>
        )}
      </div>
      <textarea
        value={d.label}
        onChange={(e) => d.onChangeLabel(id, e.target.value)}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder={placeholder}
        rows={2}
        className="mt-1 w-full resize-none bg-transparent outline-none"
      />
      {/* 左（上位）ハンドルはルートで非表示 */}
      {d.type !== "root" && (
        <Handle type="target" position={Position.Left} />
      )}
      {d.type !== "action" && (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}

export const WhyNode = memo(WhyNodeImpl);
