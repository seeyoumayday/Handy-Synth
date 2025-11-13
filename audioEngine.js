// audioEngine.js
// WebAudio ベースのシンプルな単音シンセ管理

(function(){
  let audioCtx = null;
  let osc = null;
  let gainNode = null;
  let filterNode = null;
  let active = false;

  async function ensureStarted() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  osc = audioCtx.createOscillator();
  // Timbre強化のため sawtooth に変更（ローパスで明確な効果が出る）
  osc.type = 'sawtooth';
      osc.frequency.value = 220;

      // filter (lowpass) を用意
  filterNode = audioCtx.createBiquadFilter();
  filterNode.type = 'lowpass';
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
  }

  function isReady(){
    return !!audioCtx && !!osc && !!gainNode && !!filterNode;
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

  function setFilterCutoff(freq, rampSec = 0.05){
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

  function noteOn(targetGain = 0.18, rampSec = 0.08){
    if (!isReady()) return;
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

  function setFilterQ(q){
    if (!isReady()) return;
    const clamped = Math.max(0.001, Math.min(q, 50));
    filterNode.Q.value = clamped;
  }

  window.audioEngine = {
    ensureStarted,
    isReady,
    isActive,
    rampToFrequency,
    noteOn,
    noteOff,
    setFilterCutoff,
    setFilterQ,
  };
})();
