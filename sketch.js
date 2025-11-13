// sketch.js
// 役割：ステージ生成、映像・推論・音声のオーケストレーション

let video;
let predictions = [];
let lastDisplayedFreq = 0;
let freqHistory = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  // カメラ
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // handpose モデル
  window.handposeCtrl.init(video, gotResults);

  // Startボタン
  const btn = document.getElementById('startButton');
  if (btn) {
    btn.addEventListener('click', async () => {
      await window.audioEngine.ensureStarted();
      btn.style.display = 'none';
    });
  }
}

function windowResized() {
  // ウィンドウサイズに合わせてキャンバスとビデオをリサイズ
  resizeCanvas(windowWidth, windowHeight);
  if (video && typeof video.size === 'function') {
    video.size(width, height);
  }
}

function gotResults(results) {
  predictions = results;
}

function draw() {
  background(200);

  // ビデオの実際のピクセルサイズ（取得できなければキャンバスサイズを使う）
  const vw = (video && video.elt && video.elt.videoWidth) ? video.elt.videoWidth : video.width;
  const vh = (video && video.elt && video.elt.videoHeight) ? video.elt.videoHeight : video.height;

  // アスペクト比を保持してキャンバスに収める（letterbox）
  const scl = Math.min(width / vw, height / vh);
  const drawW = vw * scl;
  const drawH = vh * scl;
  const dx = (width - drawW) / 2;
  const dy = (height - drawH) / 2;

  // ミラーしつつ、アスペクト比を保った大きさで描画する
  push();
  translate(dx + drawW, 0);
  scale(-1, 1);
  image(video, 0, dy, drawW, drawH);
  pop();

  // ランドマーク描画（描画領域に合わせてスケーリング & ミラー処理）
  window.drawUtils.drawHand(predictions, dx, dy, drawW, drawH, vw, vh);

  // 音声処理: 親指(4)と小指(20)の距離で周波数、手の重心xで微小ピッチベンド
  if (predictions.length > 0 && window.audioEngine.isReady()) {
    const hand = predictions[0];
    const thumb = hand.landmarks[4];
    const pinky = hand.landmarks[20];

    // 距離
    const d = dist(thumb[0], thumb[1], pinky[0], pinky[1]);

    // 距離を周波数にマップ
    const cd = constrain(d, CONFIG.MIN_D, CONFIG.MAX_D);
    const t = (cd - CONFIG.MIN_D) / (CONFIG.MAX_D - CONFIG.MIN_D);
    const baseFreq = CONFIG.LOW_FREQ + t * (CONFIG.HIGH_FREQ - CONFIG.LOW_FREQ);

    // 手の重心 (動画座標系)
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < hand.landmarks.length; i++){
      cx += hand.landmarks[i][0];
      cy += hand.landmarks[i][1];
    }
    cx /= hand.landmarks.length;
    cy /= hand.landmarks.length;

    // ピッチベンド（横位置 → ±比率）
    // hand.landmarks は動画座標系 (0..vw, 0..vh) のため、vw を基準にマップする
    const bend = map(cx, 0, vw, -CONFIG.BEND_RANGE, CONFIG.BEND_RANGE);
    const targetFreq = baseFreq * (1 + bend);

    // 周波数を滑らかに変える
    window.audioEngine.rampToFrequency(targetFreq, 0.06);

    lastDisplayedFreq = targetFreq;

    // 音量を上げる
    if (!window.audioEngine.isActive()) {
      window.audioEngine.noteOn(0.18, 0.08);
    }

  // 軽く重心位置を可視化（動画→描画領域へスケール＆ミラー変換）
  // drawW/drawH, dx/dy は上で計算済み
  const sx = drawW / vw;
  const sy = drawH / vh;
  const drawCX = dx + (drawW - (cx * sx)); // ミラー処理
  const drawCY = dy + (cy * sy);

  push();
  noStroke();
  fill(255, 200, 0, 180);
  ellipse(drawCX, drawCY, 12, 12);
  pop();

  } else if (window.audioEngine.isReady() && window.audioEngine.isActive()) {
    // 手が見えないときはフェードアウト
    window.audioEngine.noteOff(0.12);
  }

  // 周波数ヒストリを更新（NaN/Infinity を除外）
  if (!isNaN(lastDisplayedFreq) && isFinite(lastDisplayedFreq)) {
    freqHistory.push(lastDisplayedFreq);
    if (freqHistory.length > CONFIG.GRAPH.HISTORY) freqHistory.shift();
  }

  // 周波数グラフを左下に描画
  window.drawUtils.drawFrequencyGraph(freqHistory, lastDisplayedFreq, window.CONFIG);

  // 情報表示（左上テキストボックス）はUI要望により削除しました。
}