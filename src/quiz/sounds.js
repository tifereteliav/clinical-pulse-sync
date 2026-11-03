// צלילים קצרים שנוצרים בדפדפן (בלי קבצי שמע). פועלים רק אחרי לחיצה ראשונה על המסך.
let ctx = null;
let enabled = true;

export function setSoundEnabled(v) { enabled = v; }
export function isSoundEnabled() { return enabled; }

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* no audio */ }
}

function tone(freq, start, dur, type = 'sine', vol = 0.18) {
  if (!ctx || !enabled) return;
  try {
    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch (e) { /* ignore */ }
}

export const sfx = {
  tick: () => tone(880, 0, 0.08, 'square', 0.08),
  join: () => { tone(660, 0, 0.12, 'triangle', 0.12); tone(990, 0.08, 0.14, 'triangle', 0.12); },
  start: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.2, 'triangle', 0.16)),
  reveal: () => { tone(784, 0, 0.15, 'triangle'); tone(1175, 0.12, 0.35, 'triangle'); },
  timeUp: () => { tone(330, 0, 0.25, 'sawtooth', 0.1); tone(247, 0.2, 0.4, 'sawtooth', 0.1); },
  fanfare: () => [523, 659, 784, 659, 784, 1047, 1047].forEach((f, i) => tone(f, i * 0.16, 0.3, 'triangle', 0.18))
};
