"use client";
import { useRef, useState } from "react";
import WhyBoardCanvas from "@/components/WhyBoardCanvas";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FloatingHelpButton from "@/components/FloatingHelpButton";
import Markdown from "@/components/Markdown";
import type { BoardHandle } from "@/components/boardActions";

export default function BoardPage({ params }: { params: { boardId: string } }) {
  const { boardId } = params;
  const ref = useRef<BoardHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-blue-50 font-sans">
      {/* サイドバー */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        boardRef={ref}
        fileRef={fileRef}
      />

      {/* ファイル入力（非表示） */}
      <input
        ref={fileRef}
        type="file"
        accept=".toml,text/plain"
        className="hidden"
        onChange={async (e) => {
          const input = e.currentTarget;
          const f = input.files?.[0];
          if (!f) return;
          const text = await f.text();
          await ref.current?.importTomlText(text);
          input.value = "";
        }}
      />

      {/* メインエリア */}
      <div className="flex-1 flex flex-col">
        {/* ヘッダー */}
        <Header 
          boardId={boardId}
          onToggleSidebar={toggleSidebar}
          boardRef={ref}
        />

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }} />
          <div className="relative z-10 h-full">
            <WhyBoardCanvas ref={ref} boardId={boardId} />
          </div>
        </div>

      </div>
    </div>
  );
}

// Header下部にあったHints部分を削除。
// ただし今後使う可能性があるのでコメントアウトで残しておく
        // {/* Hints */}
        // {/* 1列目: 「なぜなぜ分析」の使い方 */}
        // <div className="p-3 border-b bg-white/80 backdrop-blur-xl">
        //   <details className="group">
        //     <summary className="cursor-pointer select-none text-sm text-gray-700 flex items-center gap-2">
        //       <span className="inline-block w-4 text-center">▸</span>
        //       <span>「なぜなぜ分析」の使い方</span>
        //     </summary>
        //     <Markdown
        //       className="mt-2 ml-6 text-sm leading-6"
        //       source={`- 始めに「問題」ノードに問題を記入してください。\n- 「ノードを右クリック」するか、「ノード右の・(ハンドル)を何もないところにドラッグ」すると次のノードを追加できます。\n- 下記の準備と注意事項に沿ってなぜなぜ分析を進めてください。`}
        //     />
        //   </details>
        //   {/* 2列目: 「なぜなぜ分析」の事前準備と注意ポイント */}
        //   <details className="group">
        //     <summary className="cursor-pointer select-none text-sm text-gray-700 flex items-center gap-2">
        //       <span className="inline-block w-4 text-center">▸</span>
        //       <span>「なぜなぜ分析」の事前準備と注意ポイント</span>
        //     </summary>
        //     <Markdown
        //       className="mt-2 ml-6 text-sm leading-6"
        //       source={`- (a) 問題を整理（羅列）し、事実をしっかりつかむこと。\n- (b) 問題となっている部分の仕組み（構造）や役割（機能）を理解しておくこと。\n\n## 注意ポイント\n1) 「現象」や「なぜ」のところに書く文章は短く、簡潔に、「〇〇がｘｘだから」という形にする。\n2) 「なぜなぜ分析」を終了した後、必ず最後の「なぜ」の部分から「現象」まで遡る形で読んでいくことにより、論理的に正しいか確認する。\n3) その前の事象に対して要因がすべて挙げられているか、ということをその逆（その要因が発生しなければ、その前に書かれている事象は発生しない）かを考えてチェックする。\n4) 再発防止策につながるような要因が出てくるところまで「なぜ」を続ける。\n5) 正常からずれている（異常）と思われることだけを書く。\n6) 人間の心の側面への原因追求（ぼーっとしていた、疲れていた、といった事柄）は避ける。\n7) 文中に「悪い」という言葉は使わない。`}
        //     />
        //   </details>
        // </div>

// ボード下部にあったヘルプ部分を削除。
// ただし今後使う可能性があるのでコメントアウトで残しておく
            // {/* フローティングヘルプボタン */}
            // <FloatingHelpButton />