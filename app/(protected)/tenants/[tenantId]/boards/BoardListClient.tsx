'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

export type BoardSummary = {
  id: string;
  boardKey: string;
  name: string;
  status: string;
  updatedAt: string;
};

type Props = {
  tenantId: string;
  initialBoards: BoardSummary[];
  isAdmin: boolean;
};

export default function BoardListClient({ tenantId, initialBoards, isAdmin }: Props) {
  const [boards, setBoards] = useState<BoardSummary[]>(initialBoards);
  const [showInactive, setShowInactive] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isActivating, startActivateTransition] = useTransition();

  const handleDelete = (boardKey: string) => {
    if (!window.confirm('このボードを削除しますか？この操作は元に戻せません。')) return;

    startDeleteTransition(async () => {
      try {
        const res = await fetch(`/api/tenants/${tenantId}/boards/${boardKey}`, { method: 'DELETE' });

        if (res.status === 204) {
          setBoards((prev) => prev.filter((board) => board.boardKey !== boardKey));
          return;
        }

        const data = await res.json().catch(() => null);
        if (!res.ok || data?.ok !== true) {
          throw new Error(data?.error ?? 'ボードの削除に失敗しました。');
        }

        setBoards((prev) => prev.filter((board) => board.boardKey !== boardKey));
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'ボードの削除に失敗しました。');
      }
    });
  };

  const handleActivate = (boardKey: string) => {
    if (!window.confirm('このボードを有効化しますか？')) return;

    startActivateTransition(async () => {
      try {
        const res = await fetch(`/api/tenants/${tenantId}/boards/${boardKey}/activate`, {
          method: 'POST',
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? 'ボードの有効化に失敗しました。');
        }

        setBoards((prev) =>
          prev.map((board) =>
            board.boardKey === boardKey ? { ...board, status: 'ACTIVE' } : board
          )
        );
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'ボードの有効化に失敗しました。');
      }
    });
  };

  const activeBoards = boards.filter((b) => b.status === 'ACTIVE');
  const inactiveBoards = boards.filter((b) => b.status !== 'ACTIVE');
  const displayBoards = showInactive ? boards : activeBoards;

  if (boards.length === 0) {
    return (
      <p className="rounded-3xl border border-soft bg-surface-card p-6 text-sm text-muted">
        ボードがまだありません。新規作成してください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && inactiveBoards.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className="rounded-lg border border-soft bg-surface-card px-4 py-2 text-sm font-medium text-paragraph transition hover:border-accent"
          >
            {showInactive ? '有効なボードのみ表示' : `無効化されたボードを表示 (${inactiveBoards.length})`}
          </button>
        </div>
      )}

      {displayBoards.map((board) => (
        <article
          key={board.id}
          className={`rounded-3xl border p-6 shadow-lg backdrop-blur transition ${
            board.status === 'ACTIVE'
              ? 'border-soft bg-surface-card hover:border-accent'
              : 'border-border-danger bg-surface-danger'
          }`}
        >
          <header className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/tenants/${tenantId}/boards/${board.boardKey}`}
                  className="text-lg font-semibold text-headline hover:text-accent"
                >
                  {board.name}
                </Link>
                {board.status !== 'ACTIVE' && (
                  <span className="rounded bg-danger-text/20 px-2 py-0.5 text-xs font-medium text-danger-text">
                    {board.status}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">ID: {board.boardKey}</p>
              <p className="mt-2 text-xs text-muted">更新: {board.updatedAt}</p>
            </div>
            <div className="flex gap-2">
              {isAdmin && board.status !== 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => handleActivate(board.boardKey)}
                  className="rounded-md border border-accent-solid bg-accent-solid/10 px-3 py-1 text-xs text-accent-solid transition hover:bg-accent-solid/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isActivating}
                >
                  有効化
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(board.boardKey)}
                  className="rounded-md border border-error px-2 py-1 text-xs text-error transition hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isDeleting}
                >
                  削除
                </button>
              )}
            </div>
          </header>
        </article>
      ))}
    </div>
  );
}
