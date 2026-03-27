// Generate notification sounds using Web Audio API — no external files needed

let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playHandoverRequestSound(volume: number = 0.5) {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;

    // Two-tone alert: ascending chime (urgent but not jarring)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587, now); // D5
    osc1.frequency.setValueAtTime(784, now + 0.15); // G5

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(784, now + 0.15); // G5
    osc2.frequency.setValueAtTime(988, now + 0.3); // B5

    gain.gain.setValueAtTime(volume * 0.4, now);
    gain.gain.setValueAtTime(volume * 0.5, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.3);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn("Could not play handover sound:", e);
  }
}

export function playNewMessageSound(volume: number = 0.3) {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;

    // Soft single pop (subtle, non-intrusive)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.1);

    gain.gain.setValueAtTime(volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (e) {
    console.warn("Could not play message sound:", e);
  }
}

export function playTestSound(type: "handover" | "message", volume: number) {
  if (type === "handover") {
    playHandoverRequestSound(volume);
  } else {
    playNewMessageSound(volume);
  }
}

// Load preferences from localStorage
export interface SoundPreferences {
  handoverRequestEnabled: boolean;
  handoverRequestVolume: number;
  newMessageEnabled: boolean;
  newMessageVolume: number;
}

const STORAGE_KEY = "totaldash_sound_prefs";

export function getSoundPreferences(): SoundPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    handoverRequestEnabled: true,
    handoverRequestVolume: 0.5,
    newMessageEnabled: true,
    newMessageVolume: 0.3,
  };
}

export function saveSoundPreferences(prefs: SoundPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
