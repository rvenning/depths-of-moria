import type { HeroId } from '../content/schema.ts';

/** each hero's voice: a pitch and pace for the browser's speech synthesis (the actual timbre is whatever the device offers) */
const VOICES: Record<HeroId | 'narr', { pitch: number; rate: number }> = {
  narr: { pitch: 0.85, rate: 0.9 }, aragorn: { pitch: 0.7, rate: 0.95 }, gimli: { pitch: 0.55, rate: 1.05 }, frodo: { pitch: 1.35, rate: 1.0 },
  legolas: { pitch: 1.15, rate: 1.1 }, boromir: { pitch: 0.6, rate: 0.95 }, sam: { pitch: 1.2, rate: 1.05 }, gandalf: { pitch: 0.65, rate: 0.85 },
};

export const voiceAvailable = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;
export function speak(who: HeroId | 'narr', text: string): void {
  if (!voiceAvailable()) return;
  const synth = window.speechSynthesis; synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[“”"]/g, ''));
  const v = VOICES[who]; u.pitch = v.pitch; u.rate = v.rate; u.volume = 0.9;
  const en = synth.getVoices().filter((x) => x.lang.startsWith('en'));
  if (en.length) u.voice = en[Object.keys(VOICES).indexOf(who) % en.length];
  synth.speak(u);
}
export function stopSpeaking(): void { if (voiceAvailable()) window.speechSynthesis.cancel(); }
