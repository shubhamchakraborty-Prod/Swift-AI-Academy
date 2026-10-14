/**
 * Plays listening tasks. Order of preference:
 *   1. a recorded file (item.audio_url), when the content team has added one
 *   2. the device's own speech voice reading the transcript
 * Speech synthesis fails silently on some devices (voices not loaded yet, no English voice, Chrome stalling),
 * so this waits for voices, picks an English one explicitly, keeps a reference to the utterance (Chrome can
 * otherwise drop it mid-speech), nudges a stalled engine, and reports failure if nothing starts within 2.5 s.
 */

let current: SpeechSynthesisUtterance | null = null; // held so the browser cannot garbage-collect it mid-speech
let currentAudio: HTMLAudioElement | null = null;

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function voicesReady(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); synth.removeEventListener('voiceschanged', done); resolve(synth.getVoices()); };
    const timer = setTimeout(done, timeoutMs);
    synth.addEventListener('voiceschanged', done);
  });
}

/** Indian English first, then British, then any English voice; local voices beat network ones. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const rank = (v: SpeechSynthesisVoice) => (/en[-_]IN/i.test(v.lang) ? 0 : /en[-_]GB/i.test(v.lang) ? 1 : /en[-_]US/i.test(v.lang) ? 2 : 3) * 2 + (v.localService ? 0 : 1);
  return en.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export function stopAudio() {
  if (speechSupported() && (current || window.speechSynthesis.speaking)) window.speechSynthesis.cancel();
  currentAudio?.pause();
  current = null;
}

/** Resolves true when playback started, false when it could not (the screen then shows the text). */
export async function playListening(opts: { text: string; audioUrl?: string | null; onEnd: () => void }): Promise<boolean> {
  stopAudio();
  if (opts.audioUrl) {
    try {
      currentAudio = new Audio(opts.audioUrl);
      currentAudio.onended = opts.onEnd;
      await currentAudio.play();
      return true;
    } catch {
      /* fall through to the speech voice */
    }
  }
  if (!speechSupported()) return false;
  const synth = window.speechSynthesis;
  const voice = pickVoice(await voicesReady());
  if (!voice) return false;
  const u = new SpeechSynthesisUtterance(opts.text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.92;
  current = u;
  return new Promise((resolve) => {
    let started = false;
    u.onstart = () => { started = true; resolve(true); };
    u.onend = () => { current = null; opts.onEnd(); };
    u.onerror = () => { if (!started) resolve(false); opts.onEnd(); };
    synth.speak(u);
    // Chrome sometimes leaves the engine paused after cancel(); resume nudges it.
    setTimeout(() => { if (synth.paused) synth.resume(); }, 120);
    setTimeout(() => { if (!started) { synth.cancel(); resolve(false); } }, 2500);
  });
}
