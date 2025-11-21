// drawUtils.js
// 手のランドマーク描画と周波数グラフ描画

(function(){
  function drawHand(predictions, dx, dy, drawW, drawH, vw, vh){
    if (!predictions || predictions.length === 0) return;
    const sx = drawW / vw;
    const sy = drawH / vh;

    for (let i = 0; i < predictions.length; i++) {
      const prediction = predictions[i];
      const lm = prediction.landmarks;

      // keypoints
      noStroke();
      fill(0, 255, 0);
      for (let j = 0; j < lm.length; j++) {
        const kx = lm[j][0];
        const ky = lm[j][1];
        const drawX = dx + (drawW - (kx * sx)); // mirror x
        const drawY = dy + (ky * sy);
        ellipse(drawX, drawY, 8, 8);
      }

      // connections
      stroke(0, 200, 255, 150);
      strokeWeight(2);
      const fingers = [
        [0,1,2,3,4],
        [0,5,6,7,8],
        [0,9,10,11,12],
        [0,13,14,15,16],
        [0,17,18,19,20]
      ];
      for (let f = 0; f < fingers.length; f++){
        const arr = fingers[f];
        for (let k = 0; k < arr.length - 1; k++){
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

  function drawFrequencyGraph(freqHistory, lastDisplayedFreq, CONFIG){
    const W = CONFIG.GRAPH.WIDTH;
    const H = CONFIG.GRAPH.HEIGHT;
    const M = CONFIG.GRAPH.MARGIN;
    const x0 = M;
    const y0 = M + 48; // Startボタン下に配置

    // パネル背景
    noStroke();
    fill(0, 0, 0, 140);
    rect(x0, y0, W, H, 10);

    // グリッド
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

    if (!freqHistory || freqHistory.length < 2) return;

    const fMin = CONFIG.LOW_FREQ * 0.9;
    const fMax = CONFIG.HIGH_FREQ * 1.1;
    const n = freqHistory.length;

    // 折れ線
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

    // 最新点
    const lastF = constrain(freqHistory[n - 1], fMin, fMax);
    const lx = x0 + ((n - 1) / (CONFIG.GRAPH.HISTORY - 1)) * W;
    const ly = y0 + H - ((lastF - fMin) / (fMax - fMin)) * H;
    noStroke();
    fill(255);
    circle(lx, ly, 5);

    // ラベル
    fill(255);
    textSize(11);
    textAlign(LEFT, BOTTOM);
    text(nf(lastDisplayedFreq, 0, 1) + ' Hz', x0 + 8, y0 + H - 8);
  }

  function drawFilterGraph(cutoff, CONFIG){
    const W = CONFIG.GRAPH.WIDTH;
    const H = CONFIG.GRAPH.HEIGHT;
    const M = CONFIG.GRAPH.MARGIN;
  // 周波数グラフの下に配置
  const x0 = M + 6;                // さらに左余白
  const y0 = M + 48 + H + M + 6;   // さらに上余白

  // パネル背景
  noStroke();
  fill(0, 0, 0, 140);
  rect(x0, y0, W, H, 10);

  // 内部描画パディングで曲線を少し下げる
  const padTop = 8;
  const padBottom = 10;
  const innerHeight = H - padTop - padBottom;

    // グリッド
    stroke(255, 255, 255, 50);
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

    // cutoff が未定義ならラベルのみ
    if (!cutoff || isNaN(cutoff)) {
      fill(255);
      textSize(11);
      textAlign(LEFT, TOP);
      text('HP Cutoff: -- Hz', x0 + 8, y0 + 8);
      return;
    }

    const fMin = CONFIG.FILTER_MIN_CUTOFF;
    const fMax = CONFIG.FILTER_MAX_CUTOFF;
  const samplePoints = 120; // 曲線サンプル密度
    const clampedCutoff = constrain(cutoff, fMin, fMax);

    // ハイパス一次フィルタ風の理想振幅: A_hp(f) = (f/fc) / sqrt(1 + (f/fc)^2)
    // （視覚的にわかりやすいように改変可能）
    noFill();
    stroke(0, 255, 255);
    strokeWeight(2);
    beginShape();
    for (let i = 0; i < samplePoints; i++) {
      const t = i / (samplePoints - 1);
      const f = fMin + t * (fMax - fMin);
      const ratio = f / clampedCutoff;
      const amp = (ratio) / Math.sqrt(1 + Math.pow(ratio, 2));
      // 1.0 が innerHeight の最上端に近づきすぎないよう 0.92 スケールを適用
      const scaledAmp = amp * 0.92;
      const x = x0 + t * W;
      const y = y0 + padTop + (innerHeight - scaledAmp * innerHeight);
      vertex(x, y);
    }
    endShape();

    // カットオフ位置の垂直ライン
    const cutoffT = (clampedCutoff - fMin) / (fMax - fMin);
    const cutoffX = x0 + cutoffT * W;
    stroke(0, 255, 255, 120);
    strokeWeight(1);
    line(cutoffX, y0, cutoffX, y0 + H);

    // カットオフ点（f=fc で 1/sqrt(2) ≈ 0.707）
    const cutoffAmp = 1 / Math.sqrt(2);
    const cutoffScaled = cutoffAmp * 0.92;
    const cutoffY = y0 + padTop + (innerHeight - cutoffScaled * innerHeight);
    noStroke();
    fill(255);
    circle(cutoffX, cutoffY, 6);

    // ラベル
    fill(255);
    textSize(11);
    textAlign(LEFT, TOP);
    text('HP Cutoff: ' + nf(clampedCutoff, 0, 0) + ' Hz', x0 + 8, y0 + 8);
  }

  window.drawUtils = {
    drawHand,
    drawFrequencyGraph,
    drawFilterGraph
  };
})();
