"use client";
import { memo, useEffect, useRef, useCallback } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
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

const UNLOCK_DELAY_MS = 25000; // 25 seconds before auto-unlock on idle

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
  const editTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditingRef = useRef(false);
  const isComposingRef = useRef(false);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const isTouchPointerRef = useRef(false);


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

  const unlockNodeRef = useRef(d.unlockNode);
  const releaseLocalLockRef = useRef(releaseLocalLock);
  const flushPendingUpdateRef = useRef(d.flushPendingUpdate);
  const currentUserIdRef = useRef(d.currentUserId || '');
  const lockedByMeRef = useRef(lockedByMe);
  const isNodeLockedByCurrentUserRef = useRef(isNodeLockedByCurrentUser);

  useEffect(() => {
    unlockNodeRef.current = d.unlockNode;
  }, [d.unlockNode]);

  useEffect(() => {
    releaseLocalLockRef.current = releaseLocalLock;
  }, [releaseLocalLock]);

  useEffect(() => {
    flushPendingUpdateRef.current = d.flushPendingUpdate;
  }, [d.flushPendingUpdate]);

  useEffect(() => {
    currentUserIdRef.current = d.currentUserId || '';
  }, [d.currentUserId]);

  useEffect(() => {
    lockedByMeRef.current = lockedByMe;
  }, [lockedByMe]);

  useEffect(() => {
    isNodeLockedByCurrentUserRef.current = isNodeLockedByCurrentUser;
  }, [isNodeLockedByCurrentUser]);

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

    if (editTimeoutRef.current) {
      clearTimeout(editTimeoutRef.current);
      editTimeoutRef.current = null;
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
  }, [canEdit, d, id, lockedByMe, registerLocalLock]);

  const handleTextChange = useCallback((newValue: string, options?: { forceSync?: boolean }) => {
    d.onChangeLabel(id, newValue);

    console.log('[WhyNode] Text changed:', { id, newValue: newValue.substring(0, 20), canEdit });

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    d.registerPendingUpdate?.(id, { content: newValue });

    if (isComposingRef.current && !options?.forceSync) {
      return;
    }

    if (options?.forceSync) {
      console.log('[WhyNode] Force flushing pending update:', { id });
      (d.flushPendingUpdate ?? flushPendingUpdateRef.current)?.(id);
      return;
    }

    const timeout = setTimeout(() => {
      console.log('[WhyNode] Debounced flush for node:', { id });
      (d.flushPendingUpdate ?? flushPendingUpdateRef.current)?.(id);
      syncTimeoutRef.current = null;
    }, 500);

    syncTimeoutRef.current = timeout;
  }, [d, id, canEdit]);

  const handleEditEnd = useCallback(() => {
    if (editTimeoutRef.current) {
      clearTimeout(editTimeoutRef.current);
      editTimeoutRef.current = null;
    }

    isEditingRef.current = false;
    isComposingRef.current = false;
    (d.flushPendingUpdate ?? flushPendingUpdateRef.current)?.(id);

    const timeout = setTimeout(() => {
      if (isEditingRef.current) {
        console.log('[WhyNode] Unlock skipped - textarea regained focus before timeout');
        editTimeoutRef.current = null;
        return;
      }

      const currentUserId = currentUserIdRef.current;
      const unlockNode = unlockNodeRef.current;
      const releaseLocal = releaseLocalLockRef.current;
      const stillLockedByMe = !!lockedByMeRef.current && !!isNodeLockedByCurrentUserRef.current?.(id, currentUserId || '');

      console.log('[WhyNode] Unlock conditions:', {
        hasUnlockNode: !!unlockNode,
        lockedByMe: lockedByMeRef.current,
        currentUserId,
        isLockedByCurrentUser: !!isNodeLockedByCurrentUserRef.current?.(id, currentUserId || '')
      });

      if (unlockNode && stillLockedByMe) {
        console.log('[WhyNode] Executing unlock for node:', id);
        unlockNode(id);
      } else {
        console.log('[WhyNode] Unlock skipped - conditions not met');
      }
      if (stillLockedByMe && releaseLocal) {
        releaseLocal(id);
      }
      editTimeoutRef.current = null;
    }, UNLOCK_DELAY_MS);

    editTimeoutRef.current = timeout;
  }, [d, id]);

  useEffect(() => {
    return () => {
      if (editTimeoutRef.current) {
        clearTimeout(editTimeoutRef.current);
        editTimeoutRef.current = null;
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      flushPendingUpdateRef.current?.(id);

      const currentUserId = currentUserIdRef.current;
      const unlockNode = unlockNodeRef.current;
      const releaseLocal = releaseLocalLockRef.current;
      const stillLockedByMe = !!lockedByMeRef.current && !!isNodeLockedByCurrentUserRef.current?.(id, currentUserId || '');

      if (stillLockedByMe && unlockNode) {
        unlockNode(id);
      }
      if (stillLockedByMe && releaseLocal) {
        releaseLocal(id);
      }
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    };
  }, [id]);

  const clearLongPressTimer = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleLongPress = () => {
    if (!canEdit) return;
    longPressTriggeredRef.current = true;
    d.openMenu?.(id);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      isTouchPointerRef.current = false;
      return;
    }
    isTouchPointerRef.current = true;
    longPressTriggeredRef.current = false;
    clearLongPressTimer();
    longPressTimeoutRef.current = setTimeout(() => {
      handleLongPress();
    }, 500);
  };

  const handlePointerUp = () => {
    clearLongPressTimer();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTouchPointerRef.current) return;
    const movement = Math.abs(event.movementX) + Math.abs(event.movementY);
    if (movement > 6) {
      clearLongPressTimer();
    }
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerMove={handlePointerMove}
      onClickCapture={handleClickCapture}
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
        <div className="flex items-stretch gap-1.5 bg-white border rounded-md shadow-md overflow-hidden px-1.5 py-1">
          <button
            disabled={d.type === "action" || d.type === "cause"}
            className={clsx(
              "flex flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200",
              (d.type === "action" || d.type === "cause") && "opacity-50 cursor-not-allowed hover:bg-gray-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!(d.type === "action" || d.type === "cause")) d.onAddChild(id, "why");
              d.closeMenu();
            }}
          >
            <span className="text-sm leading-none">＋</span>
            <span>なぜ</span>
          </button>
          <button
            disabled={d.type === "action" || d.type === "cause"}
            className={clsx(
              "flex flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-green-700 bg-green-100 hover:bg-green-200",
              (d.type === "action" || d.type === "cause") && "opacity-50 cursor-not-allowed hover:bg-green-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!(d.type === "action" || d.type === "cause")) d.onAddChild(id, "cause");
              d.closeMenu();
            }}
          >
            <span className="text-sm leading-none">＋</span>
            <span>原因</span>
          </button>
          <button
            disabled={d.type !== "cause"}
            className={clsx(
              "flex flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-blue-700 bg-blue-100 hover:bg-blue-200",
              d.type !== "cause" && "opacity-50 cursor-not-allowed hover:bg-blue-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (d.type === "cause") d.onAddChild(id, "action");
              d.closeMenu();
            }}
          >
            <span className="text-sm leading-none">＋</span>
            <span>対策</span>
          </button>
          <button
            disabled={!d.canDelete(id)}
            className={clsx(
              "flex flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-[11px] font-semibold text-red-600 bg-red-100 hover:bg-red-200",
              !d.canDelete(id) && "opacity-50 cursor-not-allowed hover:bg-red-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (d.canDelete(id)) d.onDelete(id);
              d.closeMenu();
            }}
          >
            <span className="text-sm leading-none">×</span>
            <span>削除</span>
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
          if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
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
