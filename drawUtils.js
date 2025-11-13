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

  window.drawUtils = {
    drawHand,
    drawFrequencyGraph
  };
})();
