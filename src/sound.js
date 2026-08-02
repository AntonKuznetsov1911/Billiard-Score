let audioCtx = null;

// Two short percussive ticks (a sharp high click, then a lower settle click)
// approximate a real light-switch toggle without needing an audio asset.
export function playSwitchClick() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const ctx = audioCtx;
    const now = ctx.currentTime;

    const tick = (time, freq, gainPeak, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(gainPeak, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + dur + 0.01);
    };

    tick(now, 2200, 0.18, 0.03);
    tick(now + 0.045, 1300, 0.12, 0.05);
  } catch (e) {
    // Web Audio unavailable — silently skip, this is a cosmetic touch
  }
}
