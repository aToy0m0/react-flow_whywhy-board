"use client";
import {
  Menu,
  Home,
  ChevronLeft,
  RotateCcw,
  Grid3X3,
  Maximize,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import Link, { type LinkProps } from 'next/link';
import type { BoardHandle } from './boardActions';
import WhyBoardIcon from './WhyBoardIcon';

interface HeaderProps {
  tenantId: string;
  boardId: string;
  onToggleSidebar: () => void;
  boardRef: React.RefObject<BoardHandle>;
}

export default function Header({ tenantId, boardId, onToggleSidebar, boardRef }: HeaderProps) {
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
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              line-height: 1.6; 
              padding: 20px; 
              max-width: 800px; 
              margin: 0 auto;
              background-color: #f8fafc;
              color: #374151;
            }
            h1, h2 { 
              color: #1e3a8a; 
              border-bottom: 2px solid #dbeafe; 
              padding-bottom: 8px; 
            }
            h1 { font-size: 1.8em; margin-bottom: 1em; }
            h2 { font-size: 1.3em; margin-top: 2em; margin-bottom: 1em; }
            ul, ol { margin: 1em 0; padding-left: 2em; }
            li { margin: 0.5em 0; }
            .section { 
              background: white; 
              padding: 20px; 
              margin: 20px 0; 
              border-radius: 8px; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .highlight { 
              background-color: #fef3c7; 
              padding: 12px; 
              border-radius: 6px; 
              border-left: 4px solid #f59e0b;
              margin: 1em 0;
            }
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

            <div class="highlight">
              <strong>重要な注意ポイント</strong>
            </div>
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
            <p style="text-align: center; color: #6b7280; font-size: 0.9em; margin-top: 2em;">
              このウィンドウを開いたまま、メインウィンドウで分析作業を進めることができます。
            </p>
          </div>
        </body>
        </html>
      `);
      helpWindow.document.close();
      helpWindow.focus();
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onToggleSidebar} className="p-3 hover:bg-gray-100 rounded-xl transition-colors">
            <Menu size={20} className="text-gray-600" />
          </button>
          
          <div className="flex items-center space-x-3">
            <WhyBoardIcon size={40} />
            <div>
              <h1 className="text-xl font-bold text-gray-800">WhyWhyボード</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>{tenantId}</span>
                <span>／</span>
                <span>{boardId}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {getMenuItems({ boardRef, openHelpWindow }).map((item) => {
            const Icon = item.icon;
            if (item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex flex-col items-center px-3 py-2 hover:bg-gray-50 rounded-xl transition-colors group relative"
                  title={item.tooltip}
                >
                  <Icon
                    size={18}
                    className={`text-gray-600 group-hover:text-${item.color} transition-colors mb-1`}
                  />
                  <span className={`text-xs text-gray-600 group-hover:text-${item.color} transition-colors`}>
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <button
                key={item.label}
                onClick={() => item.onClick?.()}
                className="flex flex-col items-center px-3 py-2 hover:bg-gray-50 rounded-xl transition-colors group relative"
                title={item.tooltip}
              >
                <Icon
                  size={18}
                  className={`text-gray-600 group-hover:text-${item.color} transition-colors mb-1`}
                />
                <span className={`text-xs text-gray-600 group-hover:text-${item.color} transition-colors`}>
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

type MenuHref = LinkProps<string>['href'];

type HeaderMenuItem = {
  icon: LucideIcon;
  color: string;
  label: string;
  tooltip: string;
  href?: MenuHref;
  onClick?: () => void;
};

function getMenuItems({
  boardRef,
  openHelpWindow,
}: {
  boardRef: React.RefObject<BoardHandle>;
  openHelpWindow: () => void;
}): HeaderMenuItem[] {
  return [
    {
      icon: Home,
      color: "blue-600",
      label: "ホーム",
      tooltip: "ホーム",
      href: '/' satisfies MenuHref,
    },
    {
      icon: ChevronLeft,
      color: "blue-600",
      label: "戻る",
      tooltip: "戻る",
      onClick: () => window.history.back(),
    },
    {
      icon: RotateCcw,
      color: "red-600",
      label: "クリア",
      tooltip: "全てのノードを削除",
      onClick: () => boardRef.current?.clearBoard(),
    },
    {
      icon: Grid3X3,
      color: "purple-600",
      label: "整列",
      tooltip: "ノードを自動で整列",
      onClick: () => boardRef.current?.relayoutAll(),
    },
    {
      icon: Maximize,
      color: "orange-600",
      label: "フィット",
      tooltip: "全体を画面に表示",
      onClick: () => boardRef.current?.fitView(),
    },
    {
      icon: HelpCircle,
      color: "green-600",
      label: "使い方",
      tooltip: "なぜなぜ分析の使い方を別ウィンドウで表示",
      onClick: openHelpWindow,
    },
  ];
}
