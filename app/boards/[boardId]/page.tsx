"use client";
import { useRef } from "react";
import Link from "next/link";
import WhyBoardCanvas from "@/components/WhyBoardCanvas";
import Markdown from "@/components/Markdown";
import type { BoardHandle } from "@/components/boardActions";

export default function BoardPage({ params }: { params: { boardId: string } }) {
  const { boardId } = params;
  const ref = useRef<BoardHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <main className="w-full h-screen">
      <div className="p-3 border-b flex flex-col gap-2">
        {/* 1列目: タイトルと操作群 */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold mr-4">WhyWhy Board – {boardId}</h1>
          <Link href="/" className="px-2 py-1 text-sm border rounded">ホーム</Link>
          <span className="mx-2 text-gray-300">||</span>
          {/* 左側グループ */}
          <div className="flex items-center gap-2">
          <button className="px-2 py-1 text-sm border rounded" onClick={() => ref.current?.saveLocal()}>一時保存</button>
          <button className="px-2 py-1 text-sm border rounded" onClick={() => ref.current?.loadLocal()}>一時読込</button>
          <span className="mx-2 text-gray-300">|</span>
          <button className="px-2 py-1 text-sm border rounded" onClick={() => ref.current?.exportToml()}>ファイル出力</button>
          <button
            className="px-2 py-1 text-sm border rounded"
            onClick={() => fileRef.current?.click()}
          >ファイル読込</button>
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
              // Reset the file input after async to allow re-selecting the same file
              input.value = "";
            }}
          />
          <span className="mx-2 text-gray-300">|</span>
          <button className="px-2 py-1 text-sm border rounded" onClick={() => ref.current?.exportPng()}>PNG書き出し</button>
          </div>
          <span className="mx-2 text-gray-300">||</span>
          {/* 右側グループ */}
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 text-sm border rounded" onClick={() => ref.current?.clearBoard()}>クリア</button>
            <button className="px-2 py-1 text-sm border rounded" onClick={() => ref.current?.relayoutAll()}>整列</button>
            <button className="px-2 py-1 text-sm border rounded" onClick={() => ref.current?.fitView()}>画面フィット</button>
          </div>
        </div>
        {/* 2列目: 使い方 */}
        <details className="group">
          <summary className="cursor-pointer select-none text-sm text-gray-700 flex items-center gap-2">
            <span className="inline-block w-4 text-center">▸</span>
            <span>WhyWhy Boardの使い方</span>
          </summary>
          <Markdown
            className="mt-2 ml-6 text-sm leading-6"
            source={`- 始めに「問題」ノードに問題を記入してください。\n- 「ノードを右クリック」するか、「ノード右の・(ハンドル)を何もないところにドラッグ」すると次のノードを追加できます。\n- 下記の準備と注意事項に沿ってなぜなぜ分析を進めてください。`}
          />
        </details>
        {/* 2列目: 「なぜなぜ分析」の事前準備と注意ポイント */}
        <details className="group">
          <summary className="cursor-pointer select-none text-sm text-gray-700 flex items-center gap-2">
            <span className="inline-block w-4 text-center">▸</span>
            <span>「なぜなぜ分析」の事前準備と注意ポイント</span>
          </summary>
          <Markdown
            className="mt-2 ml-6 text-sm leading-6"
            source={`- (a) 問題を整理（羅列）し、事実をしっかりつかむこと。\n- (b) 問題となっている部分の仕組み（構造）や役割（機能）を理解しておくこと。\n\n## 注意ポイント\n1) 「現象」や「なぜ」のところに書く文章は短く、簡潔に、「〇〇がｘｘだから」という形にする。\n2) 「なぜなぜ分析」を終了した後、必ず最後の「なぜ」の部分から「現象」まで遡る形で読んでいくことにより、論理的に正しいか確認する。\n3) その前の事象に対して要因がすべて挙げられているか、ということをその逆（その要因が発生しなければ、その前に書かれている事象は発生しない）かを考えてチェックする。\n4) 再発防止策につながるような要因が出てくるところまで「なぜ」を続ける。\n5) 正常からずれている（異常）と思われることだけを書く。\n6) 人間の心の側面への原因追求（ぼーっとしていた、疲れていた、といった事柄）は避ける。\n7) 文中に「悪い」という言葉は使わない。`}
          />
        </details>
      </div>
      <WhyBoardCanvas ref={ref} boardId={boardId} />
    </main>
  );
}
