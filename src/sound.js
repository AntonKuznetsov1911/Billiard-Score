let audioCtx = null;
let clickBuffer = null;

function getCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// A short burst of filtered noise reads as a mechanical "click" far more
// convincingly than a pure tone/oscillator — that's what made the first
// version sound like a digital beep instead of a switch.
function getClickBuffer(ctx) {
  if (clickBuffer && clickBuffer.sampleRate === ctx.sampleRate) return clickBuffer;
  const duration = 0.05;
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  clickBuffer = buffer;
  return buffer;
}

// Two overlapping noise "ticks" — a sharp high one (the switch engaging)
// immediately followed by a slightly lower, softer one (the mechanism
// settling) — approximate a real toggle-switch click.
export function playSwitchClick() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const tick = (time, filterFreq, q, gainPeak, dur) => {
      const src = ctx.createBufferSource();
      src.buffer = getClickBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = filterFreq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(gainPeak, time + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(time);
      src.stop(time + dur + 0.01);
    };

    tick(now, 3400, 1.4, 0.9, 0.014);
    tick(now + 0.05, 1500, 1.1, 0.5, 0.024);
  } catch (e) {
    // Web Audio unavailable — silently skip, this is a cosmetic touch
  }
}
