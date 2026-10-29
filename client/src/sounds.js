// Small synthesized sound effects: no audio files to download or license.
const SOUND_KEY = 'jka-sound';
let context = null;
let enabled = (() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } })();

export const soundEnabled = () => enabled;
export function setSoundEnabled(value) {
  enabled = value;
  try { localStorage.setItem(SOUND_KEY, value ? 'on' : 'off'); } catch { /* The choice still applies to this page. */ }
}

// Browsers only allow audio after a user gesture, so the context is created on the first one.
export function unlockAudio() {
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume();
  } catch { context = null; }
}

function tone(frequency, start, duration, volume, type) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

const ready = () => enabled && context && context.state === 'running';

// Rising C-E-G-C arpeggio with a soft octave sparkle on top.
export function playCorrect() {
  if (!ready()) return;
  const now = context.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
    const start = now + i * 0.075;
    tone(frequency, start, i === 3 ? 0.6 : 0.3, 0.2, 'triangle');
    tone(frequency * 2, start, 0.25, 0.05, 'sine');
  });
}

// Short, quiet pop when someone else gets it right.
export function playOtherCorrect() {
  if (!ready()) return;
  const now = context.currentTime;
  tone(880, now, 0.12, 0.08, 'sine');
  tone(1320, now + 0.05, 0.12, 0.05, 'sine');
}
