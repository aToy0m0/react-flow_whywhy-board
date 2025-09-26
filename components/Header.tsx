"use client";
import { Menu, Home, ChevronLeft, RotateCcw, Grid3X3, Maximize, HelpCircle, Pencil, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import type { LucideIcon } from 'lucide-react';
import type { BoardHandle } from './boardActions';

interface HeaderProps {
  tenantId: string;
  boardId: string;
  boardName: string;
  renaming?: boolean;
  onRename?: () => void;
  onToggleSidebar: () => void;
  boardRef: React.RefObject<BoardHandle>;
  isBoardFinalized?: boolean;
}

export default function Header({ tenantId, boardId, boardName, renaming = false, onRename, onToggleSidebar, boardRef, isBoardFinalized = false }: HeaderProps) {
  const openHelpWindow = () => {
    const helpWindow = window.open('', 'helpWindow', 'width=800,height=600,scrollbars=yes,resizable=yes');
    if (helpWindow) {
      helpWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>なぜなぜ分析の使い方 - WhyWhyボード</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; background-color: #ffffffff; color: #1d1d1dff; }
            h1, h2 { color: #1d1d1dff; border-bottom: 2px solid rgba(66, 66, 66, 0.4); padding-bottom: 8px; }
            h1 { font-size: 1.8em; margin-bottom: 1em; }
            h2 { font-size: 1.3em; margin-top: 2em; margin-bottom: 1em; }
            ul, ol { margin: 1em 0; padding-left: 2em; }
            li { margin: 0.5em 0; }
            .section { background: rgba(255, 255, 255, 1); padding: 20px; margin: 20px 0; border-radius: 12px; border: 1px solid rgba(51, 51, 51, 0.2); }
            .highlight { background-color: rgba(255, 255, 255, 1); padding: 12px; border-radius: 10px; border-left: 4px solid #1d1d1dff; margin: 1em 0; }
          </style>
        </head>
        <body>
          <h1>なぜなぜ分析の使い方</h1>
          <div class="section">
            <h2>基本的な使い方</h2>
            <ul>
              <li>始めに「問題」ノードに問題を記入してください。</li>
              <li>「ノードを右クリック」するか、「ノード右の・(ハンドル)を何もないところにドラッグ」すると次のノードを追加できます。</li>
              <li>下記の準備と注意事項に沿ってなぜなぜ分析を進めてください。</li>
            </ul>
          </div>
          <div class="section">
            <h2>事前準備と注意ポイント</h2>
            <ul>
              <li>(a) 問題を整理（羅列）し、事実をしっかりつかむこと。</li>
              <li>(b) 問題となっている部分の仕組み（構造）や役割（機能）を理解しておくこと。</li>
            </ul>
            <h2>重要な注意ポイント</h2>
            <ol>
              <li>「現象」や「なぜ」のところに書く文章は短く、簡潔に、「〇〇がｘｘだから」という形にする。</li>
              <li>「なぜなぜ分析」を終了した後、必ず最後の「なぜ」の部分から「現象」まで遡る形で読んでいくことにより、論理的に正しいか確認する。</li>
              <li>その前の事象に対して要因がすべて挙げられているか、ということをその逆（その要因が発生しなければ、その前に書かれている事象は発生しない）かを考えてチェックする。</li>
              <li>再発防止策につながるような要因が出てくるところまで「なぜ」を続ける。</li>
              <li>正常からずれている（異常）と思われることだけを書く。</li>
              <li>人間の心の側面への原因追求（ぼーっとしていた、疲れていた、といった事柄）は避ける。</li>
              <li>文中に「悪い」という言葉は使わない。</li>
            </ol>
          </div>
          <div class="section">
            <p style="text-align: center; color: #a4b2ffff; font-size: 0.9em; margin-top: 2em;">このウィンドウを開いたまま、メインウィンドウで分析作業を進めることができます。</p>
          </div>
        </body>
        </html>
      `);
      helpWindow.document.close();
      helpWindow.focus();
    }
  };

  return (
    <div className="bg-[rgba(255, 255, 255, 0.85)] backdrop-blur-xl shadow-sm border-b border-[rgba(0, 0, 0, 0.45)] px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={onToggleSidebar}
            className="p-2.5 hover:bg-[rgba(0, 0, 0, 0.1)] rounded-xl transition-colors"
            aria-label="サイドバー切替"
          >
            <Menu size={20} className="text-black" />
          </button>

          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-black truncate" title={boardName}>
                {boardName}
              </h1>
              {onRename && (
                <button
                  type="button"
                  onClick={onRename}
                  disabled={renaming}
                  className="inline-flex items-center justify-center rounded-md border border-[rgba(0, 0, 0, 0.45)] bg-transparent px-2 py-1 text-xs font-medium text-black shadow-sm transition hover:border-[rgba(88, 88, 88, 0.12)] hover:bg-[rgba(238,187,195,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
                  title="ボード名を編集"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2 text-xs text-black">
              <span className="truncate" title={`Tenant: ${tenantId}`}>{tenantId}</span>
              <span>／</span>
              <span className="truncate" title={`Board: ${boardId}`}>{boardId}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getMenuItems({ boardRef, openHelpWindow, tenantId, isBoardFinalized }).map((item) => {
            const Icon = item.icon;

            if (item.isLink && item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex flex-col items-center px-3 py-2 hover:bg-[rgba(238,187,195,0.1)] rounded-xl transition-colors group"
                  title={item.tooltip}
                >
                  <Icon size={18} className="text-black group-hover:text-gray-600 transition-colors mb-1" />
                  <span className="text-xs text-black group-hover:text-gray-600 transition-colors">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <button
                key={item.label}
                onClick={() => item.disabled ? undefined : item.onClick?.()}
                className={`flex flex-col items-center px-3 py-2 rounded-xl transition-colors group ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[rgba(238,187,195,0.1)]'}`}
                disabled={item.disabled}
                title={item.tooltip}
              >
                <Icon size={18} className="text-black group-hover:text-gray-600 transition-colors mb-1" />
                <span className="text-xs text-black group-hover:text-gray-600 transition-colors">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type HeaderMenuItem = {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  onClick?: () => void;
  href?: Route;
  isLink?: boolean;
  disabled?: boolean;
};

function getMenuItems({
  boardRef,
  openHelpWindow,
  tenantId,
  isBoardFinalized,
}: {
  boardRef: React.RefObject<BoardHandle>;
  openHelpWindow: () => void;
  tenantId: string;
  isBoardFinalized: boolean;
}): HeaderMenuItem[] {
  return [
    {
      icon: Home,
      label: 'ホーム',
      tooltip: 'ダッシュボードに戻る',
      href: `/tenants/${tenantId}/dashboard` as Route,
      isLink: true,
    },
    {
      icon: ChevronLeft,
      label: '戻る',
      tooltip: '前のページに戻る',
      onClick: () => window.history.back(),
    },
    {
      icon: CheckCircle,
      label: '成立',
      tooltip: isBoardFinalized ? '成立済みのボードです' : 'ボードを成立（編集終了）',
      onClick: () => {
        if (isBoardFinalized) return;
        boardRef.current?.finalizeBoard?.();
      },
      disabled: isBoardFinalized,
    },
    {
      icon: RotateCcw,
      label: 'クリア',
      tooltip: '全てのノードを削除',
      onClick: () => boardRef.current?.clearBoard(),
      disabled: isBoardFinalized,
    },
    {
      icon: Grid3X3,
      label: '整列',
      tooltip: 'ノードを自動で整列',
      onClick: () => boardRef.current?.relayoutAll(),
      disabled: isBoardFinalized,
    },
    {
      icon: Maximize,
      label: 'フィット',
      tooltip: '全体を画面に表示',
      onClick: () => boardRef.current?.fitView(),
    },
    {
      icon: HelpCircle,
      label: '使い方',
      tooltip: 'なぜなぜ分析の使い方を別ウィンドウで表示',
      onClick: openHelpWindow,
    },
  ];
}
