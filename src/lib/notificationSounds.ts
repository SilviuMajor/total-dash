// Generate notification sounds using Web Audio API — no external files needed

let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Sound option definitions
export interface SoundOption {
  id: string;
  name: string;
  play: (volume: number) => void;
}

function playChimeSound(volume: number) {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587, now);
    osc1.frequency.setValueAtTime(784, now + 0.15);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(784, now + 0.15);
    osc2.frequency.setValueAtTime(988, now + 0.3);
    gain.gain.setValueAtTime(volume * 0.4, now);
    gain.gain.setValueAtTime(volume * 0.5, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
    osc1.start(now); osc1.stop(now + 0.3);
    osc2.start(now + 0.15); osc2.stop(now + 0.6);
  } catch (e) { console.warn("Sound error:", e); }
}

function playBellSound(volume: number) {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    gain.gain.setValueAtTime(volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.5);
  } catch (e) { console.warn("Sound error:", e); }
}

function playTripleBeepSound(volume: number) {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(800, now + i * 0.15);
      gain.gain.setValueAtTime(volume * 0.15, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + i * 0.15); osc.stop(now + i * 0.15 + 0.1);
    }
  } catch (e) { console.warn("Sound error:", e); }
}

function playSoftPopSound(volume: number) {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.1);
    gain.gain.setValueAtTime(volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.15);
  } catch (e) { console.warn("Sound error:", e); }
}

function playDropSound(volume: number) {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
    gain.gain.setValueAtTime(volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.25);
  } catch (e) { console.warn("Sound error:", e); }
}

function playDoublePopSound(volume: number) {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(i === 0 ? 700 : 900, now + i * 0.12);
      gain.gain.setValueAtTime(volume * 0.25, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.1);
    }
  } catch (e) { console.warn("Sound error:", e); }
}

export const HANDOVER_SOUNDS: SoundOption[] = [
  { id: "chime", name: "Chime", play: playChimeSound },
  { id: "bell", name: "Bell", play: playBellSound },
  { id: "triple-beep", name: "Triple Beep", play: playTripleBeepSound },
];

export const MESSAGE_SOUNDS: SoundOption[] = [
  { id: "pop", name: "Pop", play: playSoftPopSound },
  { id: "drop", name: "Drop", play: playDropSound },
  { id: "double-pop", name: "Double Pop", play: playDoublePopSound },
];

export function playHandoverRequestSound(volume: number = 0.5, soundId?: string) {
  const id = soundId || getSoundPreferences().handoverRequestSound;
  const sound = HANDOVER_SOUNDS.find(s => s.id === id) || HANDOVER_SOUNDS[0];
  sound.play(volume);
}

export function playNewMessageSound(volume: number = 0.3, soundId?: string) {
  const id = soundId || getSoundPreferences().newMessageSound;
  const sound = MESSAGE_SOUNDS.find(s => s.id === id) || MESSAGE_SOUNDS[0];
  sound.play(volume);
}

export function playTestSound(type: "handover" | "message", volume: number, soundId?: string) {
  if (type === "handover") playHandoverRequestSound(volume, soundId);
  else playNewMessageSound(volume, soundId);
}

// Load preferences from localStorage
export interface SoundPreferences {
  handoverRequestEnabled: boolean;
  handoverRequestVolume: number;
  handoverRequestSound: string;
  newMessageEnabled: boolean;
  newMessageVolume: number;
  newMessageSound: string;
  myDepartmentsOnly: boolean;
  browserNotifications: boolean;
}

const STORAGE_KEY = "totaldash_sound_prefs";

export function getSoundPreferences(): SoundPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        handoverRequestEnabled: parsed.handoverRequestEnabled !== false,
        handoverRequestVolume: parsed.handoverRequestVolume ?? 0.5,
        handoverRequestSound: parsed.handoverRequestSound || "triple-beep",
        newMessageEnabled: parsed.newMessageEnabled !== false,
        newMessageVolume: parsed.newMessageVolume ?? 0.3,
        newMessageSound: parsed.newMessageSound || "double-pop",
        myDepartmentsOnly: parsed.myDepartmentsOnly || false,
        browserNotifications: parsed.browserNotifications || false,
      };
    }
  } catch {}
  return {
    handoverRequestEnabled: true,
    handoverRequestVolume: 0.5,
    handoverRequestSound: "chime",
    newMessageEnabled: true,
    newMessageVolume: 0.3,
    newMessageSound: "pop",
    myDepartmentsOnly: false,
    browserNotifications: false,
  };
}

export function saveSoundPreferences(prefs: SoundPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendBrowserNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.hasFocus()) return; // Don't notify if tab is focused
  
  new Notification(title, {
    body,
    icon: "/favicon.ico",
    tag: "totaldash-" + Date.now(),
  });
}
