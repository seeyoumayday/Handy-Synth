// audioEngine.js
// WebAudio ベースのシンプルな単音シンセ管理

(function(){
  let audioCtx = null;
  let osc = null;
  let gainNode = null;
  let filterNode = null; // ハイパスフィルタ
  let active = false;
   let running = false; // ユーザーが再生状態にあるか（Stop Audio対応）

  async function ensureStarted() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  osc = audioCtx.createOscillator();
  // Timbre強化のため sawtooth に変更（ローパスで明確な効果が出る）
  osc.type = 'sawtooth';
      osc.frequency.value = 220;

      // filter (highpass) を用意（ローカット）
      filterNode = audioCtx.createBiquadFilter();
      filterNode.type = 'highpass';
  filterNode.frequency.value = 1000;
  filterNode.Q.value = (window.CONFIG && window.CONFIG.FILTER_Q) ? window.CONFIG.FILTER_Q : 0.9;

      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;

      // 接続: osc -> filter -> gain -> destination
      osc.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
    }

    try {
      await audioCtx.resume();
    } catch (e) {
      console.warn('AudioContext resume failed:', e);
    }
     // ensureStarted では running は変更しない（startAudioでtrueにする）
  }

  function isReady(){
    return !!audioCtx && !!osc && !!gainNode && !!filterNode;
  }

   function isRunning(){
     return running;
   }

  function isActive(){
    return !!active;
  }

  function rampToFrequency(targetFreq, rampSec = 0.06){
    if (!isReady()) return;
    const now = audioCtx.currentTime;
    try {
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(osc.frequency.value, now);
      osc.frequency.linearRampToValueAtTime(targetFreq, now + rampSec);
    } catch (e) {
      // Fallback for Safari 等
      osc.frequency.setTargetAtTime(targetFreq, now, rampSec);
    }
  }

  function setHighpassCutoff(freq, rampSec = 0.05){
    if (!isReady()) return;
    const now = audioCtx.currentTime;
    try {
      filterNode.frequency.cancelScheduledValues(now);
      filterNode.frequency.setValueAtTime(filterNode.frequency.value, now);
      filterNode.frequency.linearRampToValueAtTime(freq, now + rampSec);
    } catch (e) {
      filterNode.frequency.setTargetAtTime(freq, now, rampSec);
    }
  }

  // 互換: 以前のAPI名が残っている場合に備え
  const setFilterCutoff = setHighpassCutoff;

  function noteOn(targetGain = 0.18, rampSec = 0.08){
    if (!isReady()) return;
     if (!running) return; // 停止中は発音しない
    if (active) return;
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(targetGain, now + rampSec);
    active = true;
  }

  function noteOff(rampSec = 0.12){
    if (!isReady()) return;
    if (!active) return;
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + rampSec);
    active = false;
  }

   function startAudio(){
     running = true;
     if (!isReady()) {
       // 初回セットアップ
       return ensureStarted();
     }
     // 既存Contextがsuspendedならresume
     if (audioCtx.state === 'suspended') {
       audioCtx.resume();
     }
   }

   function stopAudio(){
     if (!isReady()) return;
     running = false;
     // ゲインをフェードアウト
     noteOff(0.15);
     // 少し後に suspend（フェード完了後を目安）
     const delayMs = 180;
     setTimeout(() => {
       if (audioCtx && audioCtx.state === 'running' && !running) {
         audioCtx.suspend().catch(e => console.warn('AudioContext suspend failed', e));
       }
     }, delayMs);
   }

  function setFilterQ(q){
    if (!isReady()) return;
    const clamped = Math.max(0.001, Math.min(q, 50));
    filterNode.Q.value = clamped;
  }

  window.audioEngine = {
    ensureStarted,
    isReady,
    isActive,
     isRunning,
    rampToFrequency,
    noteOn,
    noteOff,
    setFilterCutoff,      // 互換API（内部はHPF）
    setHighpassCutoff,
    setFilterQ,
     startAudio,
     stopAudio,
  };
})();
