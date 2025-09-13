// MARK: Layout constants – single source of truth

// エッジタイプ（'step' | 'smoothstep' | 'straight' | 'simplebezier'）
// Note: @xyflow/react v12 では 'bezier' のビルトインキーが無く、
// 'simplebezier' が推奨です。pathOptions（offset / borderRadius）を
export const EDGE_TYPE = "simplebezier" as const;

// 横方向の列間オフセット（親→子のX差）
export const X_COL_GAP = 360;

// 縦方向の初期行間（初期追加時のY差分。詳細整列は boardLayout 側で再計算）
export const Y_ROW_GAP = 120;

// 直交エッジの縦線位置（pathOptions.offset）
// 列幅に応じて連動させるのが基本（例: X_COL_GAP / 2）
export const STEP_EDGE_OFFSET = 0;

// エッジの角の丸み
export const STEP_EDGE_RADIUS = 8;

// fitView のパディング
export const FITVIEW_PADDING = 0.2;

// 接続の吸着半径（ドラッグ時の当たり判定）
export const CONNECT_RADIUS = 28;

// ノード高さの推定用（複数行対応）
export const BASE_NODE_HEIGHT = 64;   // ヘッダ+1行相当
export const LINE_HEIGHT = 20;        // 追加行の高さ
export const SIBLING_BLOCK_PAD = 32;  // 兄弟ブロック間のパディング

// 既定ビューポート（位置と倍率）
export const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1.2 } as const;

// 既定の問題（root）ノード位置
export const DEFAULT_ROOT_POS = { x: 0, y: 0 } as const;

// MARK: 主なエッジタイプ（@xyflow/react 標準）

// step
// 直交（横→縦→横）。ダイアグラムの「列」を強調したいときに最適。
// 制御: pathOptions.offset（最初/最後の水平区間の長さ＝縦線の寄り）、pathOptions.borderRadius（角の丸み）
// ノード側の sourcePosition/targetPosition（Right/Left/Top/Bottom）とも相性が良い

// smoothstep
// step の角をスムースにつないだ直交カーブ。step より柔らかい見た目。
// 制御: pathOptions.offset, pathOptions.borderRadius（カーブの出だし・曲率）

// straight
// 直線。最短距離で接続したいときや、小規模の図で見やすい。
// 制御: 特になし（ノードの Position で入出角度は影響）

// simplebezier
// 簡易ベジェ（v12のビルトイン）。自由なレイアウトと相性が良い。
// 制御: 基本は内蔵。pathOptions は未使用。

// （補足）simplebezier
// 一部バージョンで提供される簡易ベジェ。見た目は bezier に近い。利用可否はバージョンによる。
// 共通で使えるオプション/機能
// マーカー（矢印）
// markerEnd/markerStart に MarkerType.ArrowClosed などを指定可能
// アニメーション
// edge.animated = true で流れるようなアニメ表示
// ノードの入出角度
// node.sourcePosition / targetPosition を Right/Left/Top/Bottom に設定して、経路の取り回しを安定化
