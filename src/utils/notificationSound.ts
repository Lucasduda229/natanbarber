/**
 * Notification sound utility — works on mobile PWA (iOS/Android) and desktop.
 * 
 * Uses HTMLAudioElement with an inline base64 WAV as primary method (most reliable on mobile),
 * with Web Audio API as fallback, plus device vibration as supplement.
 */

// Short Dó-Mi-Sol beep pre-encoded as base64 WAV (22050Hz, mono, 16-bit, ~0.45s)
// Generated offline so no network request is needed
const WAV_BASE64 = (() => {
  const sampleRate = 22050;
  const notes = [
    { freq: 523.25, dur: 0.12 }, // C5
    { freq: 659.25, dur: 0.12 }, // E5
    { freq: 783.99, dur: 0.18 }, // G5
  ];
  const totalSamples = Math.floor(sampleRate * notes.reduce((a, n) => a + n.dur, 0));

  const buf = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };

  w(0, 'RIFF'); view.setUint32(4, 36 + totalSamples * 2, true);
  w(8, 'WAVE'); w(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, 'data'); view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  let time = 0;
  for (const note of notes) {
    const n = Math.floor(sampleRate * note.dur);
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.min(t * 60, 1) * Math.min((note.dur - t) * 60, 1);
      const s = Math.round(env * 0.75 * 32767 * Math.sin(2 * Math.PI * note.freq * t));
      view.setInt16(offset, s, true);
      offset += 2;
    }
    time += note.dur;
  }

  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
})();

/** Cached Audio element (reused across calls for performance) */
let _audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!_audio) {
    _audio = new Audio(WAV_BASE64);
    _audio.volume = 0.85;
  }
  return _audio;
}

/** Vibrate the device (supplement to audio on mobile) */
function vibrate() {
  try {
    if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
  } catch { /* ignore */ }
}

/**
 * Plays the Dó-Mi-Sol notification blip.
 * Primary: HTMLAudioElement (works on iOS PWA, Android, desktop)
 * Fallback: Web Audio API
 */
export function playNotificationSound() {
  // Supplement with vibration on mobile
  vibrate();

  // Primary: HTMLAudioElement — most reliable on iOS/Android PWA
  const audio = getAudio();
  if (audio) {
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // If autoplay blocked, try Web Audio API fallback
        playWebAudio();
      });
    }
    return;
  }

  // Fallback: Web Audio API
  playWebAudio();
}

function playWebAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor() as AudioContext;

    const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    resume.then(() => {
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      const note = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.9, start + 0.02);
        g.gain.setValueAtTime(0.9, start + dur - 0.03);
        g.gain.linearRampToValueAtTime(0, start + dur);
        osc.connect(g); g.connect(master);
        osc.start(start); osc.stop(start + dur);
      };

      const t = ctx.currentTime;
      note(523.25, t,        0.12);
      note(659.25, t + 0.12, 0.12);
      note(783.99, t + 0.24, 0.18);

      setTimeout(() => ctx.close().catch(() => undefined), 700);
    }).catch(() => undefined);
  } catch { /* ignore */ }
}

/**
 * Call once at app startup to pre-load the audio element.
 * On iOS, the Audio element must be "touched" during a user gesture
 * to be allowed to play later without one.
 */
export function registerAudioUnlock() {
  if (typeof window === 'undefined') return;

  const unlock = () => {
    const audio = getAudio();
    if (!audio) return;

    // Play at volume 0 to unlock the element for future autoplay
    const prev = audio.volume;
    audio.volume = 0;
    audio.play()
      .then(() => { audio.pause(); audio.currentTime = 0; audio.volume = prev; })
      .catch(() => { audio.volume = prev; });
  };

  const events = ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown'];
  const handler = () => {
    unlock();
    // Keep the listener so re-unlock happens after backgrounding on iOS
  };
  events.forEach(e => window.addEventListener(e, handler, { passive: true, capture: true }));
}
