// audioEngine.js
// WebAudio ベースのシンプルな単音シンセ管理

(function(){
  let audioCtx = null;
  let osc = null;
  let gainNode = null;
  let active = false;

  async function ensureStarted() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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
  }

  function isReady(){
    return !!audioCtx && !!osc && !!gainNode;
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

  window.audioEngine = {
    ensureStarted,
    isReady,
    isActive,
    rampToFrequency,
    noteOn,
    noteOff,
  };
})();
