// sketch.js
// - ml5.handpose で手を検出
// - ネイティブ WebAudio の単一オシレータで連続的に周波数を制御
// - 親指と小指の距離で高さ（開くほど高い）、手の横位置で微小なピッチベンド

let video;
let handposeModel;
let predictions = [];

// 設定（グローバル定数）
const CONFIG = {
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

// WebAudio
let audioCtx = null;
let osc = null;
let gainNode = null;
let active = false; // 音が出ているかどうか
let lastDisplayedFreq = 0;
let freqHistory = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  // カメラ
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // handpose モデル
  handposeModel = ml5.handpose(video, modelReady);
  handposeModel.on('predict', gotResults);

  // Startボタン
  const btn = document.getElementById('startButton');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // 単一オシレータ + ゲイン
        osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 220;

        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0;

        osc.connect(gainNode).connect(audioCtx.destination);
        osc.start();
      }

      try {
        await audioCtx.resume();
      } catch (e) {
        console.warn('AudioContext resume failed:', e);
      }

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

function modelReady() {
  console.log('Handpose model ready');
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
  drawHand(dx, dy, drawW, drawH, vw, vh);

  // 音声処理: 親指(4)と小指(20)の距離で周波数、手の重心xで微小ピッチベンド
  if (predictions.length > 0 && audioCtx && osc && gainNode) {
    const hand = predictions[0];
    const thumb = hand.landmarks[4];
    const pinky = hand.landmarks[20];

    // 距離
    const d = dist(thumb[0], thumb[1], pinky[0], pinky[1]);

    // 距離を周波数にマップ
    const cd = constrain(d, CONFIG.MIN_D, CONFIG.MAX_D);
    const t = (cd - CONFIG.MIN_D) / (CONFIG.MAX_D - CONFIG.MIN_D);
    const baseFreq = CONFIG.LOW_FREQ + t * (CONFIG.HIGH_FREQ - CONFIG.LOW_FREQ);

    // 手の重心 x
    let cx = 0;
    for (let i = 0; i < hand.landmarks.length; i++) cx += hand.landmarks[i][0];
    cx /= hand.landmarks.length;

    // ピッチベンド（横位置 → ±比率）
    const bend = map(cx, 0, width, -CONFIG.BEND_RANGE, CONFIG.BEND_RANGE);
    const targetFreq = baseFreq * (1 + bend);

    // 周波数を滑らかに変える
    const now = audioCtx.currentTime;
    try {
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(osc.frequency.value, now);
      osc.frequency.linearRampToValueAtTime(targetFreq, now + 0.06);
    } catch (e) {
      osc.frequency.setTargetAtTime(targetFreq, now, 0.06);
    }

    lastDisplayedFreq = targetFreq;

    // 音量を上げる
    if (!active) {
      const now2 = audioCtx.currentTime;
      gainNode.gain.cancelScheduledValues(now2);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now2);
      gainNode.gain.linearRampToValueAtTime(0.18, now2 + 0.08);
      active = true;
    }

    // 軽く重心位置を可視化
    push();
    noStroke();
    fill(255, 200, 0, 180);
    // cx はミラーしているので反転して描画
    const drawX = width - cx;
    ellipse(drawX, 20, 12, 12);
    pop();

  } else if (audioCtx && gainNode && active) {
    // 手が見えないときはフェードアウト
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.12);
    active = false;
  }

  // 周波数ヒストリを更新（NaN/Infinity を除外）
  if (!isNaN(lastDisplayedFreq) && isFinite(lastDisplayedFreq)) {
    freqHistory.push(lastDisplayedFreq);
    if (freqHistory.length > CONFIG.GRAPH.HISTORY) freqHistory.shift();
  }

  // 周波数グラフを左下に描画
  drawFrequencyGraph();

  // 情報表示
  noStroke();
  fill(255, 255, 255, 200);
  rect(8, 8, 320, 56, 6);
  fill(0);
  textSize(14);
  textAlign(LEFT, TOP);
  text('Handpose: ' + (predictions.length > 0 ? 'detected' : 'no hand'), 14, 12);
  if (predictions.length > 0) text('Freq: ' + nf(lastDisplayedFreq, 0, 1) + ' Hz', 14, 30);
  else text('Freq: -', 14, 30);
}

function drawHand(dx, dy, drawW, drawH, vw, vh) {
  if (!predictions || predictions.length === 0) return;
  const sx = drawW / vw;
  const sy = drawH / vh;

  for (let i = 0; i < predictions.length; i++) {
    const prediction = predictions[i];
    const lm = prediction.landmarks;

    // Draw keypoints
    noStroke();
    fill(0, 255, 0);
    for (let j = 0; j < lm.length; j++) {
      const kx = lm[j][0];
      const ky = lm[j][1];
      // scale and mirror x inside the drawn video area
      const drawX = dx + (drawW - (kx * sx));
      const drawY = dy + (ky * sy);
      ellipse(drawX, drawY, 8, 8);
    }

    // Draw connections
    stroke(0, 200, 255, 150);
    strokeWeight(2);
    const fingers = [ [0,1,2,3,4], [0,5,6,7,8], [0,9,10,11,12], [0,13,14,15,16], [0,17,18,19,20] ];
    for (let f=0; f<fingers.length; f++){
      const arr = fingers[f];
      for (let k=0; k<arr.length-1; k++){
        const a = lm[arr[k]];
        const b = lm[arr[k+1]];
        const ax = dx + (drawW - (a[0] * sx));
        const ay = dy + (a[1] * sy);
        const bx = dx + (drawW - (b[0] * sx));
        const by = dy + (b[1] * sy);
        line(ax, ay, bx, by);
      }
    }
  }
}

// 左下に周波数の折れ線グラフを描画（シアン＆白ベース）
function drawFrequencyGraph() {
  const W = CONFIG.GRAPH.WIDTH;
  const H = CONFIG.GRAPH.HEIGHT;
  const M = CONFIG.GRAPH.MARGIN;
  const x0 = M;
  const y0 = height - H - M;

  // パネル背景
  noStroke();
  fill(0, 0, 0, 140); // 半透明の黒
  rect(x0, y0, W, H, 10);

  // グリッド（白系）
  stroke(255, 255, 255, 60);
  strokeWeight(1);
  const gridRows = 4;
  const gridCols = 6;
  for (let r = 1; r < gridRows; r++) {
    const gy = y0 + (H * r) / gridRows;
    line(x0, gy, x0 + W, gy);
  }
  for (let c = 1; c < gridCols; c++) {
    const gx = x0 + (W * c) / gridCols;
    line(gx, y0, gx, y0 + H);
  }

  if (freqHistory.length < 2) return;

  // 表示レンジ（ピッチベンド分を少し加味）
  const fMin = CONFIG.LOW_FREQ * 0.9;
  const fMax = CONFIG.HIGH_FREQ * 1.1;
  const n = freqHistory.length;

  // 折れ線（シアン）
  noFill();
  stroke(0, 255, 255);
  strokeWeight(2);
  beginShape();
  for (let i = 0; i < n; i++) {
    const f = constrain(freqHistory[i], fMin, fMax);
    const tx = i / (CONFIG.GRAPH.HISTORY - 1);
    const x = x0 + tx * W;
    const y = y0 + H - ((f - fMin) / (fMax - fMin)) * H;
    vertex(x, y);
  }
  endShape();

  // 最新点を強調（白）
  const lastF = constrain(freqHistory[n - 1], fMin, fMax);
  const lx = x0 + ((n - 1) / (CONFIG.GRAPH.HISTORY - 1)) * W;
  const ly = y0 + H - ((lastF - fMin) / (fMax - fMin)) * H;
  noStroke();
  fill(255);
  circle(lx, ly, 5);

  // ラベル（白）
  fill(255);
  textSize(11);
  textAlign(LEFT, BOTTOM);
  text(nf(lastDisplayedFreq, 0, 1) + ' Hz', x0 + 8, y0 + H - 8);
}