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
  const [syncTimeout, setSyncTimeout] = useState<NodeJS.Timeout | null>(null);
  const isEditingRef = useRef(false);
  const isComposingRef = useRef(false);

  // ロック機能フック
  const {
    lockNode: registerLocalLock,
    unlockNode: releaseLocalLock,
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

  const handleEditStart = useCallback(() => {
    if (!canEdit) return;

    if (editTimeout) {
      clearTimeout(editTimeout);
      setEditTimeout(null);
    }
    isEditingRef.current = true;

    if (!lockedByMe && d.currentUserId && registerLocalLock) {
      registerLocalLock(
        id,
        d.currentUserId,
        d.currentUserName ?? d.currentUserId,
        new Date().toISOString()
      );
    }

    // Socket.IOでロック要求
    if (d.lockNode) {
      d.lockNode(id);
    }
  }, [canEdit, d, editTimeout, id, lockedByMe, registerLocalLock, setEditTimeout]);

  const handleTextChange = useCallback((newValue: string, options?: { forceSync?: boolean }) => {
    d.onChangeLabel(id, newValue);

    console.log('[WhyNode] Text changed:', { id, newValue: newValue.substring(0, 20), canEdit });

    if (syncTimeout) {
      clearTimeout(syncTimeout);
      setSyncTimeout(null);
    }

    d.registerPendingUpdate?.(id, { content: newValue });

    if (isComposingRef.current && !options?.forceSync) {
      return;
    }

    if (options?.forceSync) {
      console.log('[WhyNode] Force flushing pending update:', { id });
      d.flushPendingUpdate?.(id);
      return;
    }

    const timeout = setTimeout(() => {
      console.log('[WhyNode] Debounced flush for node:', { id });
      d.flushPendingUpdate?.(id);
      setSyncTimeout(null);
    }, 500);

    setSyncTimeout(timeout);
  }, [syncTimeout, d, id, canEdit]);

  const handleEditEnd = useCallback(() => {
    if (editTimeout) {
      clearTimeout(editTimeout);
    }

    isEditingRef.current = false;
    isComposingRef.current = false;
    d.flushPendingUpdate?.(id);

    const timeout = setTimeout(() => {
      if (isEditingRef.current) {
        console.log('[WhyNode] Unlock skipped - textarea regained focus before timeout');
        setEditTimeout(null);
        return;
      }

      console.log('[WhyNode] Unlock conditions:', {
        hasUnlockNode: !!d.unlockNode,
        lockedByMe,
        currentUserId: d.currentUserId,
        isLockedByCurrentUser: isNodeLockedByCurrentUser(id, d.currentUserId || '')
      });

      if (d.unlockNode && lockedByMe && isNodeLockedByCurrentUser(id, d.currentUserId || '')) {
        console.log('[WhyNode] Executing unlock for node:', id);
        d.unlockNode(id);
      } else {
        console.log('[WhyNode] Unlock skipped - conditions not met');
      }
      if (lockedByMe && releaseLocalLock) {
        releaseLocalLock(id);
      }
      setEditTimeout(null);
    }, 2000);

    setEditTimeout(timeout);
  }, [d, editTimeout, id, isNodeLockedByCurrentUser, lockedByMe, releaseLocalLock, setEditTimeout]);

  useEffect(() => {
    return () => {
      if (editTimeout) {
        clearTimeout(editTimeout);
      }
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      d.flushPendingUpdate?.(id);
      if (lockedByMe && d.unlockNode && isNodeLockedByCurrentUser(id, d.currentUserId || '')) {
        d.unlockNode(id);
      }
      if (lockedByMe && releaseLocalLock) {
        releaseLocalLock(id);
      }
    };
  }, [editTimeout, syncTimeout, lockedByMe, d, id, isNodeLockedByCurrentUser, releaseLocalLock]);

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
              (d.type === "action" || d.type === "cause")
                ? "text-gray-400 cursor-not-allowed"
                : "text-black"
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
              (d.type === "action" || d.type === "cause")
                ? "text-gray-400 cursor-not-allowed"
                : "text-black"
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
              d.type !== "cause"
                ? "text-gray-400 cursor-not-allowed"
                : "text-black"
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
              !d.canDelete(id)
                ? "text-gray-400 cursor-not-allowed"
                : "text-black"
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
              onChange={(e) => {
                console.log('[WhyNode] Checkbox onChange:', { id, checked: e.target.checked, hasOnToggleAdopted: !!d.onToggleAdopted, type: d.type });
                d.onToggleAdopted?.(id, e.target.checked);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag"
            />
            採用
          </label>
        )}
      </div>
      
      {/* MARK: textarea */}

      <textarea
        ref={textareaRef}
        value={d.label}
        readOnly={!canEdit}
        onChange={(e) => {
          if (canEdit) {
            handleTextChange(e.target.value);
            // handleEditEnd()は削除: onChange毎にロック解除タイマーをリセットしない
          }
        }}
        onFocus={handleEditStart}
        onBlur={handleEditEnd}
        onCompositionStart={() => {
          isComposingRef.current = true;
          if (syncTimeout) {
            clearTimeout(syncTimeout);
            setSyncTimeout(null);
          }
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          if (canEdit) {
            handleTextChange(e.currentTarget.value, { forceSync: true });
          }
        }}
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
