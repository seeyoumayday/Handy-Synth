// sketch.js
// - ml5.handpose で手を検出
// - ネイティブ WebAudio の単一オシレータで連続的に周波数を制御
// - 親指と小指の距離で高さ（開くほど高い）、手の横位置で微小なピッチベンド

let video;
let handposeModel;
let predictions = [];

// WebAudio
let audioCtx = null;
let osc = null;
let gainNode = null;
let active = false; // 音が出ているかどうか
let lastDisplayedFreq = 0;

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

    // マッピング設定（必要に応じて調整）
    const MIN_D = 20;
    const MAX_D = 300;
    const LOW_FREQ = 150; // 閉じたとき
    const HIGH_FREQ = 900; // 開いたとき

    const cd = constrain(d, MIN_D, MAX_D);
    const t = (cd - MIN_D) / (MAX_D - MIN_D);
    const baseFreq = LOW_FREQ + t * (HIGH_FREQ - LOW_FREQ);

    // 手の重心 x
    let cx = 0;
    for (let i = 0; i < hand.landmarks.length; i++) cx += hand.landmarks[i][0];
    cx /= hand.landmarks.length;

    // ピッチベンドの範囲（±6%）
    const BEND_RANGE = 0.06;
    const bend = map(cx, 0, width, -BEND_RANGE, BEND_RANGE);
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

  // 情報表示
  noStroke();
  fill(255, 255, 255, 200);
  rect(8, 8, 320, 56, 6);
  fill(0);
  textSize(14);
  textAlign(LEFT, TOP);
  text('Handpose: ' + (predictions.length > 0 ? 'detected' : 'no hand'), 14, 12);
  if (predictions.length > 0) {
    text('Freq: ' + nf(lastDisplayedFreq, 0, 1) + ' Hz', 14, 30);
  } else {
    text('Freq: -', 14, 30);
  }
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