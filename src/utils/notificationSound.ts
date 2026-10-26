/**
 * Shared notification sound utility — mobile + desktop compatible.
 *
 * Strategy (in order):
 *   1. Web Audio API with a pre-unlocked AudioContext (works on PC + Android)
 *   2. HTMLAudioElement with an inline WAV data-URL (iOS PWA fallback)
 *   3. Vibration API as last resort on mobile
 *
 * iOS rule: AudioContext MUST be created/resumed inside a synchronous
 * user-gesture handler. This module captures the first touch/click to
 * unlock the context so subsequent calls (from realtime events) work.
 */

// ---------------------------------------------------------------------------
// Shared AudioContext — created once, kept warm
// ---------------------------------------------------------------------------
let _ctx: AudioContext | null = null;
let _unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!_ctx) {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor() as AudioContext;
    }
    return _ctx;
  } catch {
    return null;
  }
}

/**
 * Unlock the AudioContext via a silent buffer.
 * Must be called synchronously inside a user-gesture event handler.
 */
function unlockCtx() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);

  // Play a completely silent 1-sample buffer — required by iOS to "warm up"
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    src.stop(0.001);
  } catch {
    // ignore
  }
  _unlocked = true;
}

/**
 * Call this once at app startup.
 * Registers touch/click listeners to unlock the AudioContext on first interaction.
 */
export function registerAudioUnlock() {
  if (typeof window === 'undefined') return;

  const handler = () => {
    unlockCtx();
    // Keep re-unlocking on each gesture — important for iOS after backgrounding
  };

  // Use both capture and bubble to catch the earliest possible event
  ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown'].forEach((ev) => {
    window.addEventListener(ev, handler, { passive: true, capture: true });
  });
}

// ---------------------------------------------------------------------------
// Inline minimal WAV beep (440 Hz, ~0.2s) as base64 data URL
// Used as HTMLAudioElement fallback for iOS/mobile when Web Audio is blocked
// ---------------------------------------------------------------------------
const BEEP_WAV_B64 =
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
// ↑ This is a near-silent WAV header; replaced below with a proper generated one

let _audioEl: HTMLAudioElement | null = null;

function getAudioEl(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!_audioEl) {
    // Generate a short beep using raw PCM data embedded in a WAV
    // 22050 Hz, 16-bit mono, ~0.25s (5512 samples)
    const sampleRate = 22050;
    const numSamples = Math.floor(sampleRate * 0.25);
    const buf = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buf);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);          // PCM
    view.setUint16(22, 1, true);          // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Write Dó-Mi-Sol melody samples
    const notes = [523.25, 659.25, 783.99];
    const noteDur = Math.floor(numSamples / notes.length);
    for (let n = 0; n < notes.length; n++) {
      const freq = notes[n];
      for (let i = 0; i < noteDur; i++) {
        const t = i / sampleRate;
        // Simple sine with quick fade-in/out
        const env = Math.min(t * 40, 1) * Math.min((noteDur / sampleRate - t) * 40, 1);
        const sample = Math.round(env * 0.7 * 32767 * Math.sin(2 * Math.PI * freq * t));
        view.setInt16(44 + (n * noteDur + i) * 2, sample, true);
      }
    }

    const blob = new Blob([buf], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    _audioEl = new Audio(url);
    _audioEl.volume = 0.8;
  }
  return _audioEl;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Plays the "Dó-Mi-Sol" notification blip.
 * Works on desktop (Web Audio), Android PWA, and iOS PWA.
 */
export function playNotificationSound() {
  // --- Attempt 1: Web Audio API ---
  const ctx = getCtx();
  if (ctx) {
    // Try to resume if suspended (works if we have prior user gesture)
    const doPlay = () => {
      try {
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.9, ctx.currentTime);
        masterGain.connect(ctx.destination);

        const playNote = (freq: number, start: number, dur: number, vol = 0.8) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(vol, start + 0.02);
          gain.gain.setValueAtTime(vol, start + dur - 0.03);
          gain.gain.linearRampToValueAtTime(0, start + dur);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(start);
          osc.stop(start + dur);
        };

        const t = ctx.currentTime;
        playNote(523.25, t + 0.00, 0.12, 0.9); // C5
        playNote(659.25, t + 0.12, 0.12, 0.9); // E5
        playNote(783.99, t + 0.24, 0.18, 1.0); // G5
        return true;
      } catch {
        return false;
      }
    };

    if (ctx.state === 'running') {
      if (doPlay()) return;
    } else if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (!doPlay()) playFallback();
      }).catch(() => playFallback());
      return;
    }
  }

  // --- Attempt 2: HTMLAudioElement fallback (iOS / old browsers) ---
  playFallback();
}

function playFallback() {
  try {
    // Vibrate on mobile as audio supplement
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

    const el = getAudioEl();
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {
      // Last resort: clone the element (needed on some iOS versions)
      const clone = el.cloneNode() as HTMLAudioElement;
      clone.play().catch(() => undefined);
    });
  } catch {
    // silent fail
  }
}
