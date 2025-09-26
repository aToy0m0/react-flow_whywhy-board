'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

export type BoardSummary = {
  id: string;
  boardKey: string;
  name: string;
  updatedAt: string;
};

type Props = {
  tenantId: string;
  initialBoards: BoardSummary[];
};

export default function BoardListClient({ tenantId, initialBoards }: Props) {
  const [boards, setBoards] = useState<BoardSummary[]>(initialBoards);
  const [isDeleting, startDeleteTransition] = useTransition();

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

  if (boards.length === 0) {
    return (
      <p className="rounded-3xl border border-soft bg-surface-card p-6 text-sm text-muted">
        ボードがまだありません。新規作成してください。
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {boards.map((board) => (
        <article
          key={board.id}
          className="rounded-3xl border border-soft bg-surface-card p-6 shadow-lg backdrop-blur transition hover:border-accent"
        >
          <header className="flex items-start justify-between gap-3">
            <div>
              <Link
                href={`/tenants/${tenantId}/boards/${board.boardKey}`}
                className="text-lg font-semibold text-headline hover:text-accent"
              >
                {board.name}
              </Link>
              <p className="mt-1 text-xs text-muted">ID: {board.boardKey}</p>
              <p className="mt-2 text-xs text-muted">更新: {board.updatedAt}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(board.boardKey)}
              className="rounded-md border border-error px-2 py-1 text-xs text-error transition hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDeleting}
            >
              削除
            </button>
          </header>
        </article>
      ))}
    </div>
  );
}
