// config.js
// アプリ全体で使う定数設定
window.CONFIG = {
  MIN_D: 20,          // 指が閉じた距離（ピクセル）
  MAX_D: 300,         // 指が開いた距離（ピクセル）
  LOW_FREQ: 150,      // 最低周波数（Hz）
  HIGH_FREQ: 900,     // 最高周波数（Hz）
  BEND_RANGE: 0.06,   // ピッチベンド幅（±比率）
  GRAPH: {
    WIDTH: 320,
    HEIGHT: 120,
    MARGIN: 12,
    HISTORY: 240      // ヒストリの長さ（フレーム数）
  }
  ,
  // フィルタのカットオフレンジ（Hz）
  FILTER_MIN_CUTOFF: 200,   // ローパス最低カットオフ（低いほどこもる）
  FILTER_MAX_CUTOFF: 5000,  // ローパス最高カットオフ（高いほどブライト）
  FILTER_Q: 0.9,            // ローパスフィルタの初期Q（共鳴）
  FILTER_Q_MIN: 0.1,        // UIスライダー用 Q 最小値
  FILTER_Q_MAX: 18          // UIスライダー用 Q 最大値（過剰な共鳴を避ける範囲）
};
