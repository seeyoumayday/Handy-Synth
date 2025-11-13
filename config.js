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
};
