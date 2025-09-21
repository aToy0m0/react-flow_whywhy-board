"use client";
import { memo, useEffect, useRef } from "react";
import { Handle, Position, NodeProps, NodeToolbar } from "@xyflow/react";
import type { Node as RFNode } from "@xyflow/react";
import clsx from "clsx";
import type { NodeType, WhyNodeData } from "./boardTypes";

const colors: Record<NodeType, { border: string; bg: string }> = {
  root: { border: "border-error", bg: "bg-error/10" },
  why: { border: "border-soft", bg: "bg-surface-card" },
  cause: { border: "border-success", bg: "bg-success/10" },
  action: { border: "border-highlight", bg: "bg-highlight/10" },
};

function Header({ type, index }: { type: NodeType; index?: number; adopted?: boolean }) {
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
      {/* <span>なぜ{index ?? 0}｜親ノードはなぜか</span> */}
      <span>なぜ{index ?? 0}</span>
    </div>
  );
}

function WhyNodeImpl({ id, data, selected }: NodeProps<RFNode<WhyNodeData>>) {
  const d = data as WhyNodeData; // 型を明示
  const { index } = d.getParentInfo(id);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const placeholder = d.type === "root" ? "問題" : d.type === "action" ? "対策" : "○○がｘｘだから";

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (d.heightHint) {
      el.style.height = `${d.heightHint}px`;
    } else {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [d.heightHint, d.label]);

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
        <Header type={d.type} index={index} />
        {(d.type === "why" || d.type === "cause") && (
          <label className="ml-auto inline-flex items-center gap-1 text-xs text-gray-600 select-none">
            <input
              type="checkbox"
              checked={!!d.adopted}
              disabled={d.type === "why" && (d.hasChildren(id) || d.hasCauseDescendant?.(id))}
              onChange={(e) => d.onToggleAdopted?.(id, e.target.checked)}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag"
            />
            採用
          </label>
        )}
      </div>
      <textarea
        ref={textareaRef}
        value={d.label}
        onChange={(e) => d.onChangeLabel(id, e.target.value)}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
          d.onUpdateHeight?.(id, el.scrollHeight);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        placeholder={placeholder}
        rows={2}
        className="mt-1 w-full resize-none bg-transparent outline-none nodrag"
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
