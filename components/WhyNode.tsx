"use client";
import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Handle, Position, NodeProps, NodeToolbar } from "@xyflow/react";
import type { Node as RFNode } from "@xyflow/react";
import clsx from "clsx";
import type { NodeType, WhyNodeData } from "./boardTypes";
import { useNodeLock } from "../contexts/NodeLockContext";

const colors: Record<NodeType, { border: string; bg: string }> = {
  root: { border: "border-red-500", bg: "bg-red-50" },
  why: { border: "border-gray-500", bg: "bg-gray-50" },
  cause: { border: "border-green-600", bg: "bg-green-50" },
  action: { border: "border-blue-600", bg: "bg-blue-50" },
};

function Header({ type, index }: { type: NodeType; index?: number; adopted?: boolean }) {
  if (type === "root") return <div className="text-sm font-semibold text-black">問題</div>;
  if (type === "cause") {
    // return <div className="text-sm font-semibold">原因｜{parentLabel ?? ""} はなぜか</div>;
    return <div className="text-sm font-semibold text-black">原因</div>;
  }
  if (type === "action") {
    return <div className="text-sm font-semibold text-black">対策</div>;
  }
  return (
    <div className="text-sm font-semibold flex items-center gap-2 text-black">
      {/* <span>なぜ{index ?? 0}｜親ノードはなぜか</span> */}
      <span>なぜ{index ?? 0}</span>
    </div>
  );
}

function WhyNodeImpl({ id, data, selected }: NodeProps<RFNode<WhyNodeData>>) {
  const d = data as WhyNodeData; // 型を明示
  const { index } = d.getParentInfo(id);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [editTimeout, setEditTimeout] = useState<NodeJS.Timeout | null>(null);

  // ロック機能フック
  const {
    isNodeLocked,
    getNodeLockInfo,
    isNodeLockedByCurrentUser
  } = useNodeLock();

  const placeholder = d.type === "root" ? "問題" : d.type === "action" ? "対策" : "○○がｘｘだから";

  // ノードのロック状態
  const locked = isNodeLocked(id);
  const lockInfo = getNodeLockInfo(id);
  const lockedByMe = isNodeLockedByCurrentUser(id, d.currentUserId || '');
  const canEdit = !locked || lockedByMe;

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

  // 編集開始時のロック処理
  const handleEditStart = useCallback(() => {
    if (!canEdit) return;

    // Socket.IOでロック要求
    if (d.lockNode) {
      d.lockNode(id);
    }
  }, [canEdit, d, id]);

  // 編集終了時のロック解除処理
  const handleEditEnd = useCallback(() => {
    if (editTimeout) {
      clearTimeout(editTimeout);
    }

    const timeout = setTimeout(() => {
      if (d.unlockNode && lockedByMe) {
        d.unlockNode(id);
      }
    }, 2000); // 2秒後に自動でロック解除

    setEditTimeout(timeout);
  }, [editTimeout, d, lockedByMe, id]);

  // コンポーネントがアンマウントされる時のクリーンアップ
  useEffect(() => {
    return () => {
      if (editTimeout) {
        clearTimeout(editTimeout);
      }
      if (lockedByMe && d.unlockNode) {
        d.unlockNode(id);
      }
    };
  }, [editTimeout, lockedByMe, d, id]);

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (canEdit) d.openMenu(id);
      }}
      className={clsx(
        "rounded-md border shadow-sm px-3 py-2 w-[260px] relative",
        colors[d.type].border,
        colors[d.type].bg,
        selected && "ring-2 ring-blue-400",
        locked && !lockedByMe && "opacity-60 cursor-not-allowed",
        locked && "border-2",
        lockedByMe && "border-orange-400",
        locked && !lockedByMe && "border-red-400"
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
      {/* ロック状態表示バッジ */}
      {locked && (
        <div className={clsx(
          "absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-semibold text-white z-10",
          lockedByMe ? "bg-orange-500" : "bg-red-500"
        )}>
          {lockedByMe ? "編集中" : `${lockInfo?.userName}が編集中`}
        </div>
      )}

      <div className="flex items-center">
        <Header type={d.type} index={index} />
        {(d.type === "why" || d.type === "cause") && (
          <label className="ml-auto inline-flex items-center gap-1 text-xs text-gray-600 select-none">
            <input
              type="checkbox"
              checked={!!d.adopted}
              disabled={!canEdit || (d.type === "why" && (d.hasChildren(id) || d.hasCauseDescendant?.(id)))}
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
        readOnly={!canEdit}
        onChange={(e) => {
          if (canEdit) {
            d.onChangeLabel(id, e.target.value);
            handleEditEnd(); // 編集時にタイマーリセット
          }
        }}
        onFocus={handleEditStart}
        onBlur={handleEditEnd}
        onInput={(e) => {
          if (!canEdit) return;
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
          d.onUpdateHeight?.(id, el.scrollHeight);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!canEdit) {
            e.preventDefault();
          }
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!canEdit) {
            e.preventDefault();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        placeholder={canEdit ? placeholder : (locked ? `${lockInfo?.userName}が編集中...` : placeholder)}
        rows={2}
        className={clsx(
          "mt-1 w-full resize-none bg-transparent outline-none nodrag text-black",
          !canEdit && "cursor-not-allowed"
        )}
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
