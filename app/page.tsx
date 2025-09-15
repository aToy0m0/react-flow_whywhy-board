import Link from "next/link";
// import Link from "next/link";

export default function HomePage() {
  return (
    // <style>
    //   body { 
    //     font-family: system-ui, -apple-system, sans-serif; 
    //     line-height: 1.6; 
    //     padding: 20px; 
    //     max-width: 800px; 
    //     margin: 0 auto;
    //     background-color: #f8fafc;
    //     color: #374151;
    //   }
    //   h1, h2 { 
    //     color: #1e3a8a; 
    //     border-bottom: 2px solid #dbeafe; 
    //     padding-bottom: 8px; 
    //   }
    //   h1 { font-size: 1.8em; margin-bottom: 1em; }
    //   h2 { font-size: 1.3em; margin-top: 2em; margin-bottom: 1em; }
    //   ul, ol { margin: 1em 0; padding-left: 2em; }
    //   li { margin: 0.5em 0; }
    //   .section { 
    //     background: white; 
    //     padding: 20px; 
    //     margin: 20px 0; 
    //     border-radius: 8px; 
    //     box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    //   }
    //   .highlight { 
    //     background-color: #fef3c7; 
    //     padding: 12px; 
    //     border-radius: 6px; 
    //     border-left: 4px solid #f59e0b;
    //     margin: 1em 0;
    //   }
    // </style>
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">WhyWhy Board</h1>
      <p>ボード画面へ移動：<Link className="text-blue-600 underline" href="/boards/MVP">ここをクリック</Link></p>
      {/* <ul className="list-disc list-inside">
        <li>
          <Link className="text-blue-600 underline" href="/boards/dev">/boards/dev</Link>
        </li>
      </ul> */}

      <p className="mb-4"></p>
      <h1 className="text-2xl font-bold mb-4">なぜなぜ分析の使い方</h1>
      
        <strong font-color="#1e3a8a">基本的な使い方</strong>
        <ul className="list-disc list-inside">
          <li>始めに「問題」ノードに問題を記入してください。</li>
          <li>「ノードを右クリック」するか、「ノード右の・(ハンドル)を何もないところにドラッグ」すると次のノードを追加できます。</li>
          <li>下記の準備と注意事項に沿ってなぜなぜ分析を進めてください。</li>
        </ul>

      <p className="mb-4"></p>
      <strong>事前準備と注意ポイント</strong>
      <ul>
        <li>(a) 問題を整理（羅列）し、事実をしっかりつかむこと。</li>
        <li>(b) 問題となっている部分の仕組み（構造）や役割（機能）を理解しておくこと。</li>
      </ul>

      <p className="mb-4"></p>
      <strong>重要な注意ポイント</strong>
      <ul className="list-disc list-inside">
        <li>「現象」や「なぜ」のところに書く文章は短く、簡潔に、「〇〇がｘｘだから」という形にする。</li>
        <li>「なぜなぜ分析」を終了した後、必ず最後の「なぜ」の部分から「現象」まで遡る形で読んでいくことにより、論理的に正しいか確認する。</li>
        <li>その前の事象に対して要因がすべて挙げられているか、ということをその逆（その要因が発生しなければ、その前に書かれている事象は発生しない）かを考えてチェックする。</li>
        <li>再発防止策につながるような要因が出てくるところまで「なぜ」を続ける。</li>
        <li>正常からずれている（異常）と思われることだけを書く。</li>
        <li>人間の心の側面への原因追求（ぼーっとしていた、疲れていた、といった事柄）は避ける。</li>
        <li>文中に「悪い」という言葉は使わない。</li>
      </ul>
    </main>
  );
}

