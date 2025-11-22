// sketch.js
// 役割：ステージ生成、映像・推論・音声のオーケストレーション

let video;
let isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let handModel = null;
let handposeAttached = false; // 予測リスナー接続状態
let predictions = [];
let lastDisplayedFreq = 0;
let freqHistory = [];
let lastCutoff = NaN; // フィルタカットオフの最新値

function setup() {
  createCanvas(windowWidth, windowHeight);
  // モバイルでは負荷を下げる
  if (isMobile) {
    frameRate(24);
    pixelDensity(1);
  }
  // カメラ（モバイルは低解像度で負荷軽減）
  video = createCapture(VIDEO);
  if (isMobile) {
    video.size(320, 240);
  } else {
    video.size(width, height);
  }
  video.hide();

  // handpose モデル（初期は未接続：Start Audioで接続）
  handModel = window.handposeCtrl.init(video, gotResults);
  detachHandpose();

  // Startボタン
  const btn = document.getElementById('startButton');
  const stopBtn = document.getElementById('stopButton');
  if (btn) {
    btn.addEventListener('click', async () => {
      await window.audioEngine.startAudio();
      attachHandpose();
      btn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'inline-block';
    });
  }
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      window.audioEngine.stopAudio();
      detachHandpose();
      stopBtn.style.display = 'none';
      if (btn) btn.style.display = 'inline-block';
    });
  }

  // フィルタQスライダー初期化
  const qSlider = document.getElementById('filterQ');
  const qValueLabel = document.getElementById('filterQValue');
  if (qSlider && qValueLabel) {
    // 初期値を CONFIG から反映
    if (window.CONFIG) {
      qSlider.value = window.CONFIG.FILTER_Q;
    }
    qValueLabel.textContent = qSlider.value;
    qSlider.addEventListener('input', () => {
      const q = parseFloat(qSlider.value);
      window.audioEngine.setFilterQ(q);
      qValueLabel.textContent = qSlider.value;
    });
  }
}

function windowResized() {
  // ウィンドウサイズに合わせてキャンバスとビデオをリサイズ
  resizeCanvas(windowWidth, windowHeight);
  if (video && typeof video.size === 'function') {
    if (!isMobile) {
      video.size(width, height);
    }
    // モバイルは固定低解像度維持
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

  // ミラーしつつ、アスペクト比を保った大きさで描画する（常に表示）
  push();
  translate(dx + drawW, 0);
  scale(-1, 1);
  image(video, 0, dy, drawW, drawH);
  pop();

  // 停止中はここで終了（ランドマーク・グラフ等を描かない）
  if (!window.audioEngine.isRunning()) {
    return;
  }

  // 推論／オーディオ更新のスロットリング（モバイルでは間引く）
  if (typeof window._hs_frameCounter === 'undefined') window._hs_frameCounter = 0;
  window._hs_frameCounter++;
  const processEvery = isMobile ? 3 : 1; // モバイルは3フレームに1回更新

  // ランドマーク描画（描画領域に合わせてスケーリング & ミラー処理）
  window.drawUtils.drawHand(predictions, dx, dy, drawW, drawH, vw, vh);

  // 音声処理（新設計）: 横位置=基本ピッチ、縦位置=微小ピッチベンド、開閉=ローカット(HPF)
  if ((window._hs_frameCounter % processEvery) === 0 && predictions.length > 0 && window.audioEngine.isReady() && window.audioEngine.isRunning()) {
    const hand = predictions[0];
    const thumb = hand.landmarks[4];
    const pinky = hand.landmarks[20];

    // 距離（開閉判定）
    const d = dist(thumb[0], thumb[1], pinky[0], pinky[1]);
    const cd = constrain(d, CONFIG.MIN_D, CONFIG.MAX_D);

    // 手の重心 (動画座標系)
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < hand.landmarks.length; i++){
      cx += hand.landmarks[i][0];
      cy += hand.landmarks[i][1];
    }
    cx /= hand.landmarks.length;
    cy /= hand.landmarks.length;

    // 横位置 → 基本ピッチ（右へ行くほど高く：ミラー補正のため 1 - cx/vw）
    const xNorm = 1 - (cx / vw);
    const baseFreq = CONFIG.LOW_FREQ + xNorm * (CONFIG.HIGH_FREQ - CONFIG.LOW_FREQ);

    // 縦位置 → 微小ピッチベンド（上で+、下で-）
    const bendY = map(cy, 0, vh, CONFIG.BEND_RANGE, -CONFIG.BEND_RANGE);
    const targetFreq = baseFreq * (1 + bendY);

    // ハイパス（ローカット）: 手を閉じるほど強いローカット
    const openness = (cd - CONFIG.MIN_D) / (CONFIG.MAX_D - CONFIG.MIN_D); // 0=閉,1=開
    const hpfCutoff = CONFIG.FILTER_MAX_CUTOFF + (CONFIG.FILTER_MIN_CUTOFF - CONFIG.FILTER_MAX_CUTOFF) * openness; // 開くほどカットオフ低下
    window.audioEngine.setHighpassCutoff(hpfCutoff, 0.08);
    lastCutoff = hpfCutoff;

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

  } else if (window.audioEngine.isReady() && window.audioEngine.isActive() && window.audioEngine.isRunning()) {
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
  window.drawUtils.drawFilterGraph(lastCutoff, window.CONFIG);

  // フィルタグラフ直下に Q スライダーを配置（レスポンシブ）
  const qContainer = document.getElementById('filterQContainer');
  if (qContainer) {
    const M = window.CONFIG.GRAPH.MARGIN;
    const W = window.CONFIG.GRAPH.WIDTH;
    const H = window.CONFIG.GRAPH.HEIGHT;
    // drawFilterGraph の x0,y0 計算と揃える（x0=M+6, y0=M+48+H+M+6）
    const x0 = M + 6;
    const y0 = M + 48 + H + M + 6;
    const sliderTop = y0 + H + 8; // グラフの下 + 余白
    qContainer.style.left = `${x0}px`;
    qContainer.style.top = `${sliderTop}px`;
  }

  // 情報表示（左上テキストボックス）はUI要望により削除しました。
}

// Handpose予測リスナー接続
function attachHandpose(){
  if (handModel && !handposeAttached) {
    try {
      handModel.on('predict', gotResults);
      handposeAttached = true;
    } catch(e){ console.warn('attachHandpose failed', e); }
  }
}

// Handpose予測リスナー解除
function detachHandpose(){
  if (handModel && handposeAttached) {
    try {
      // ml5 の EventEmitter 互換APIがある前提
      if (handModel.off) handModel.off('predict', gotResults);
      handposeAttached = false;
    } catch(e){ console.warn('detachHandpose failed', e); }
  }
  predictions = []; // 前回の結果をクリア
}