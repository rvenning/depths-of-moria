import { ctx2d } from './draw.ts';
/**
 * Original line-icon set. Every icon is a 24×24 SVG fragment drawn with `currentColor`.
 * Used by React (inline <svg>) and by Phaser (rasterised through an Image).
 */
const S = (inner: string) => inner;

export const ICONS: Record<string, string> = {
  // ---- weapons & gear
  sword: S('<path d="M5 19 L16 8 M14 5 L19 5 L19 10 L10 19 L5 19Z M7.5 16.5 L5 19 M4 17 L7 20"/>'),
  axe: S('<path d="M7 20 L17 4 M13 5 C18 4 21 7 20 11 C16 10 14 9 13 5Z"/>'),
  bow: S('<path d="M7 4 C16 8 16 16 7 20 M7 4 L7 20 M7 12 L20 12 M17 9 L20 12 L17 15"/>'),
  bow2: S('<path d="M6 4 C14 8 14 16 6 20 M6 4 L6 20 M6 9 L19 9 M6 15 L19 15 M16 7 L19 9 L16 11 M16 13 L19 15 L16 17"/>'),
  dagger: S('<path d="M5 19 L15 9 L17 7 L19 5 L19 5 L17 10 L11 16 M5 19 L9 15 M8 13 L12 17"/>'),
  staff: S('<path d="M6 20 L16 8 M16 8 m-3 -3 a3 3 0 1 0 5 0 a3 3 0 1 0 -5 0 M6 20 L5 22"/><circle cx="17" cy="6" r="2.4"/>'),
  mace: S('<path d="M5 20 L13 12"/><circle cx="16" cy="9" r="4"/><path d="M16 4 L16 6 M20 9 L18 9 M16 14 L16 12 M12 9 L14 9"/>'),
  spear: S('<path d="M5 20 L16 9 M14 4 L20 4 L20 10 Z"/>'),
  tool: S('<path d="M6 19 L14 11 M14 11 C12 7 14 4 18 4 L16 8 L20 8 C20 12 17 14 14 11"/>'),
  spade: S('<path d="M12 3 L12 14 M9 3 L15 3 M8 14 C8 20 16 20 16 14 Z"/>'),
  armour: S('<path d="M5 6 L9 4 L12 6 L15 4 L19 6 L18 12 C18 17 15 20 12 21 C9 20 6 17 6 12 Z M12 6 L12 21"/>'),
  shield: S('<path d="M12 3 L19 6 C19 13 17 18 12 21 C7 18 5 13 5 6 Z M12 8 L12 17 M8 12 L16 12"/>'),
  wall: S('<path d="M3 20 L3 10 L8 10 L8 6 L16 6 L16 10 L21 10 L21 20 Z M3 15 L21 15 M9 10 L9 15 M15 10 L15 15 M12 15 L12 20"/>'),
  bulwark: S('<path d="M4 20 L4 8 L8 8 L8 5 L12 5 L12 8 L16 8 L16 5 L20 5 L20 20 Z M8 20 L8 14 L16 14 L16 20"/>'),
  tome: S('<path d="M5 4 L17 4 C19 4 19 6 19 6 L19 20 L7 20 C5 20 5 18 5 18 Z M5 18 C5 16 7 16 7 16 L19 16 M9 8 L15 8 M9 11 L15 11"/>'),
  lantern: S('<path d="M9 3 L15 3 M12 3 L12 6 M8 6 L16 6 L17 18 L7 18 Z M8 18 L16 18 L15 21 L9 21 Z M12 9 C10 11 11 13 12 14 C13 13 14 11 12 9Z"/>'),
  quiver: S('<path d="M8 9 L14 5 L18 12 L12 17 Z M10 7 L8 3 M13 6 L12 2 M16 8 L17 4"/>'),
  ring: S('<circle cx="12" cy="14" r="6"/><path d="M9 6 L12 3 L15 6 L12 9 Z"/>'),
  charm: S('<path d="M12 3 L12 8 M9 8 L15 8 L16 15 C16 19 8 19 8 15 Z M10 12 L14 12"/>'),
  pendant: S('<path d="M7 3 C7 9 10 10 12 10 C14 10 17 9 17 3 M12 10 L12 12"/><path d="M12 12 L16 16 L12 21 L8 16 Z"/>'),
  crown: S('<path d="M4 18 L4 8 L9 12 L12 6 L15 12 L20 8 L20 18 Z M4 18 L20 18"/>'),
  torc: S('<path d="M6 8 C6 18 18 18 18 8 M5 8 L7 8 M17 8 L19 8"/><circle cx="12" cy="17" r="1.6"/>'),
  badge: S('<path d="M12 3 L19 6 L19 12 C19 16 16 19 12 21 C8 19 5 16 5 12 L5 6 Z M12 8 L13.4 11 L16.5 11.3 L14.2 13.4 L14.9 16.5 L12 14.8 L9.1 16.5 L9.8 13.4 L7.5 11.3 L10.6 11 Z"/>'),
  coin: S('<circle cx="12" cy="12" r="8"/><path d="M12 7 L12 17 M9.5 9.5 C9.5 8 14.5 8 14.5 10 C14.5 12 9.5 12 9.5 14 C9.5 16 14.5 16 14.5 14.5"/>'),
  fork: S('<path d="M8 3 L8 9 C8 12 12 12 12 9 L12 3 M10 3 L10 9 M10 12 L10 21 M16 3 L16 21"/>'),
  whistle: S('<path d="M4 10 L14 10 C18 10 20 13 18 16 C16 19 11 18 11 14 L4 14 Z M16 5 L18 3"/>'),
  quill: S('<path d="M20 4 C12 5 7 10 6 18 C13 17 19 12 20 4Z M6 18 L4 21 M10 14 L15 9"/>'),
  lens: S('<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5 L20 20"/>'),
  feather: S('<path d="M19 4 C11 5 6 9 5 16 C12 16 18 11 19 4Z M5 19 L5 16 M9 13 L14 8"/>'),

  // ---- skills
  crosshair: S('<circle cx="12" cy="12" r="7"/><path d="M12 2 L12 8 M12 16 L12 22 M2 12 L8 12 M16 12 L22 12"/>'),
  banner: S('<path d="M6 21 L6 3 M6 4 L19 4 L16 8 L19 12 L6 12"/>'),
  whirl: S('<path d="M12 4 A8 8 0 0 1 20 12 M12 20 A8 8 0 0 1 4 12 M20 12 L17 9 M4 12 L7 15 M9 9 C9 7 15 7 15 9 C15 12 9 12 9 15 C9 17 15 17 15 15"/>'),
  path: S('<path d="M4 20 C8 20 8 14 12 14 C16 14 16 8 20 8 M18 5 L21 8 L18 11 M4 20 m-1 0 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0"/>'),
  'heart-flame': S('<path d="M12 20 C5 15 4 10 7 8 C9 7 11 8 12 10 C13 8 15 7 17 8 C20 10 19 15 12 20Z M12 9 C10 11 11 12 12 13 C13 12 14 11 12 9Z"/>'),
  eye: S('<path d="M2 12 C6 6 18 6 22 12 C18 18 6 18 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  rain: S('<path d="M6 3 L4 9 M12 3 L10 9 M18 3 L16 9 M9 12 L7 18 M15 12 L13 18 M12 18 L11 21"/><path d="M4 9 L3 7 M10 9 L9 7 M16 9 L15 7"/>'),
  horn: S('<path d="M4 15 C4 9 10 8 14 8 L20 5 L20 17 L14 14 C10 14 8 15 6 18 Z"/>'),
  'heart-sword': S('<path d="M12 20 C5 15 4 10 7 8 C9 7 11 8 12 10 C13 8 15 7 17 8 C20 10 19 15 12 20Z M10 14 L14 10"/>'),
  ward: S('<path d="M12 3 L19 6 C19 13 17 18 12 21 C7 18 5 13 5 6 Z M12 7 L12 17 M8 11 L16 11"/>'),
  bread: S('<path d="M4 13 C4 8 20 8 20 13 C20 17 18 18 18 18 L6 18 C6 18 4 17 4 13Z M9 10 L10 13 M13 10 L14 13"/>'),
  hand: S('<path d="M8 21 C5 18 5 14 6 11 L6 7 M6 11 L6 6 M10 11 L10 4 M14 11 L14 5 M18 11 L18 7 M6 11 C6 14 8 15 10 15 L16 15 C19 15 20 12 18 11 M8 21 L16 21"/>'),
  sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12 M5 5 L7 7 M17 17 L19 19 M19 5 L17 7 M5 19 L7 17"/>'),
  'ward-flame': S('<path d="M12 3 L19 6 C19 13 17 18 12 21 C7 18 5 13 5 6 Z"/><path d="M12 8 C9 11 10 14 12 16 C14 14 15 11 12 8Z"/>'),
  lightning: S('<path d="M13 2 L5 13 L11 13 L9 22 L19 9 L13 9 Z"/>'),
  claw: S('<path d="M6 4 C8 10 8 16 6 20 M12 3 C14 9 14 15 12 20 M18 4 C20 10 20 16 18 20"/>'),
  fire: S('<path d="M12 21 C6 21 5 15 8 11 C9 13 10 13 11 12 C10 8 12 5 14 3 C14 7 18 9 18 14 C18 18 16 21 12 21Z"/>'),
  heal: S('<path d="M10 4 L14 4 L14 10 L20 10 L20 14 L14 14 L14 20 L10 20 L10 14 L4 14 L4 10 L10 10 Z"/>'),
  buff: S('<path d="M12 3 L12 18 M6 9 L12 3 L18 9 M7 21 L17 21"/>'),
  debuff: S('<path d="M12 21 L12 6 M6 15 L12 21 L18 15 M7 3 L17 3"/>'),

  // ---- statuses
  target: S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'),
  drop: S('<path d="M12 3 C7 10 6 12 6 15 C6 19 9 21 12 21 C15 21 18 19 18 15 C18 12 17 10 12 3Z"/>'),
  flame: S('<path d="M12 21 C6 21 5 15 8 11 C9 13 10 13 11 12 C10 8 12 5 14 3 C14 7 18 9 18 14 C18 18 16 21 12 21Z"/>'),
  blood: S('<path d="M12 3 C8 9 7 11 7 14 C7 18 10 21 12 21 C14 21 17 18 17 14 C17 11 16 9 12 3Z M10 15 C10 17 11 18 12 18"/>'),
  bolt: S('<path d="M13 2 L5 13 L11 13 L9 22 L19 9 L13 9 Z"/>'),
  snail: S('<path d="M4 18 L19 18 C21 18 21 15 19 15 M5 18 C3 18 3 13 7 13 L8 13 M10 15 C10 8 18 8 18 13 C18 15 15 15 15 13 C15 11 12 11 12 14 M7 13 L6 9 M9 13 L9 9"/>'),
  wing: S('<path d="M3 14 C8 6 14 6 21 10 C17 10 14 11 13 14 C16 14 18 15 18 15 C13 17 8 17 3 14Z"/>'),
  'broken-sword': S('<path d="M5 19 L11 13 M14 10 L19 5 L19 10 L15 14 M12 14 L14 12"/><path d="M12 12 L10 10 L12 8"/>'),
  'cracked-shield': S('<path d="M12 3 L19 6 C19 13 17 18 12 21 C7 18 5 13 5 6 Z M13 5 L10 10 L14 12 L11 18"/>'),
  leaf: S('<path d="M5 19 C5 10 11 5 20 4 C20 13 15 19 5 19Z M5 19 L13 11"/>'),
  'eye-closed': S('<path d="M3 12 C7 17 17 17 21 12 M6 15 L5 18 M12 17 L12 20 M18 15 L19 18"/>'),
  'eye-x': S('<path d="M2 12 C6 6 18 6 22 12 C18 18 6 18 2 12Z M9 9 L15 15 M15 9 L9 15"/>'),
  skull: S('<path d="M6 12 C6 6 8 4 12 4 C16 4 18 6 18 12 L16 14 L16 18 L8 18 L8 14 Z M9 11 L11 11 M13 11 L15 11 M10 18 L10 15 M14 18 L14 15"/>'),
  ghost: S('<path d="M6 20 L6 10 C6 5 9 3 12 3 C15 3 18 5 18 10 L18 20 L15 18 L12 20 L9 18 Z M10 10 L10 11 M14 10 L14 11"/>'),
  wave: S('<path d="M2 9 C5 5 8 5 12 9 C16 13 19 13 22 9 M2 16 C5 12 8 12 12 16 C16 20 19 20 22 16"/>'),
  seal: S('<circle cx="12" cy="12" r="8"/><path d="M6 18 L18 6"/>'),
  thorn: S('<path d="M5 20 C8 10 12 6 20 4 M9 14 L6 11 M12 10 L10 6 M15 8 L17 11"/>'),
  fury: S('<path d="M4 4 L9 10 L12 3 L15 10 L20 4 L18 14 C17 19 15 21 12 21 C9 21 7 19 6 14 Z"/>'),
  shatter: S('<path d="M12 3 L19 6 C19 13 17 18 12 21 C7 18 5 13 5 6 Z M12 3 L9 9 L14 11 L10 15 L13 21"/>'),

  // ---- resources
  ore: S('<path d="M4 17 L8 9 L13 8 L19 13 L16 19 L8 20 Z M8 9 L11 14 L19 13 M11 14 L8 20"/>'),
  cloth: S('<path d="M4 7 C8 4 10 9 14 6 C17 4 19 6 20 7 L20 17 C16 20 14 15 10 18 C7 20 5 18 4 17 Z M8 8 L8 16 M13 8 L13 16"/>'),
  essence: S('<path d="M12 2 L15 9 L22 12 L15 15 L12 22 L9 15 L2 12 L9 9 Z"/>'),
  renown: S('<path d="M12 3 L14.5 9 L21 9.5 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.5 L9.5 9 Z"/>'),
  shard: S('<path d="M12 2 L18 10 L12 22 L6 10 Z M6 10 L18 10"/>'),
  supplies: S('<path d="M8 8 L16 8 L17 20 L7 20 Z M10 8 L10 5 L14 5 L14 8 M9 13 L15 13"/>'),
  star: S('<path d="M12 3 L14.5 9 L21 9.5 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.5 L9.5 9 Z"/>'),

  // ---- ui
  menu: S('<path d="M4 7 L20 7 M4 12 L20 12 M4 17 L20 17"/>'),
  camp: S('<path d="M3 20 L12 5 L21 20 Z M12 20 L12 13 L9 20 M12 13 L15 20 M12 5 L12 3"/>'),
  map: S('<path d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z M9 4 L9 18 M15 6 L15 20"/>'),
  book: S('<path d="M4 5 C8 3 10 4 12 6 C14 4 16 3 20 5 L20 19 C16 17 14 18 12 20 C10 18 8 17 4 19 Z M12 6 L12 20"/>'),
  scroll: S('<path d="M7 4 L19 4 L19 17 C19 19 17 20 15 20 L5 20 C7 19 7 17 7 17 Z M7 4 C5 4 5 7 7 7 M10 9 L16 9 M10 12 L16 12"/>'),
  anvil: S('<path d="M3 8 L18 8 C18 11 15 11 14 12 L14 15 L17 17 L17 20 L7 20 L7 17 L10 15 L10 12 C8 12 5 11 3 8Z M18 8 L21 6"/>'),
  shrine: S('<path d="M3 20 L21 20 M5 20 L5 10 M19 20 L19 10 M3 10 L12 4 L21 10 Z M9 20 L9 12 M15 20 L15 12"/>'),
  hero: S('<circle cx="12" cy="8" r="4"/><path d="M4 21 C4 15 8 13 12 13 C16 13 20 15 20 21"/>'),
  party: S('<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20 C2 15 5 14 8 14 C11 14 13 16 14 17 C15 15 17 14 18 14 C21 14 22 16 22 20"/>'),
  gear: S('<circle cx="12" cy="12" r="3"/><path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12 M5 5 L7 7 M17 17 L19 19 M19 5 L17 7 M5 19 L7 17"/>'),
  play: S('<path d="M7 4 L19 12 L7 20 Z"/>'),
  pause: S('<path d="M7 4 L10 4 L10 20 L7 20 Z M14 4 L17 4 L17 20 L14 20 Z"/>'),
  fast: S('<path d="M4 5 L12 12 L4 19 Z M12 5 L20 12 L12 19 Z"/>'),
  fastest: S('<path d="M2 5 L8 12 L2 19 Z M8 5 L14 12 L8 19 Z M14 5 L20 12 L14 19 Z"/>'),
  log: S('<path d="M5 5 L19 5 M5 10 L19 10 M5 15 L14 15 M5 20 L11 20"/>'),
  lock: S('<path d="M6 11 L18 11 L18 21 L6 21 Z M8 11 L8 7 C8 3 16 3 16 7 L16 11"/>'),
  trash: S('<path d="M5 7 L19 7 M9 7 L9 4 L15 4 L15 7 M7 7 L8 21 L16 21 L17 7"/>'),
  check: S('<path d="M5 12 L10 17 L19 7"/>'),
  close: S('<path d="M6 6 L18 18 M18 6 L6 18"/>'),
  chevron: S('<path d="M9 5 L16 12 L9 19"/>'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11 L12 17 M12 7 L12 8"/>'),
  sound: S('<path d="M4 9 L8 9 L13 5 L13 19 L8 15 L4 15 Z M16 8 C18 10 18 14 16 16 M18 6 C21 9 21 15 18 18"/>'),
  mute: S('<path d="M4 9 L8 9 L13 5 L13 19 L8 15 L4 15 Z M16 9 L21 15 M21 9 L16 15"/>'),
  sword2: S('<path d="M4 20 L14 10 M12 4 L20 4 L20 12 L10 22 Z"/>'),
  skip: S('<path d="M5 5 L13 12 L5 19 Z M15 5 L18 5 L18 19 L15 19 Z"/>'),
  door: S('<path d="M5 21 L5 5 C5 3 7 3 7 3 L17 3 C19 3 19 5 19 5 L19 21 Z M15 12 L16 12 M3 21 L21 21"/>'),
  event: S('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5 C9.5 6 15 6 15 10 C15 13 12 12.5 12 15.5 M12 18.5 L12 19"/>'),
  rest: S('<path d="M5 20 L19 20 M7 20 C7 14 9 11 12 11 C15 11 17 14 17 20 M12 11 L12 6 M9 8 L12 6 L15 8"/>'),
  vault: S('<path d="M4 8 L20 8 L20 20 L4 20 Z M4 8 L6 4 L18 4 L20 8 M10 13 L14 13 L14 17 L10 17 Z"/>'),
  boss: S('<path d="M4 20 L4 10 L8 13 L12 6 L16 13 L20 10 L20 20 Z M8 17 L8 17.5 M16 17 L16 17.5"/>'),
  trial: S('<path d="M6 3 L18 3 L18 9 C18 13 14 15 12 15 C10 15 6 13 6 9 Z M12 15 L12 20 M8 21 L16 21 M6 5 L3 5 L3 8 C3 10 5 10 6 10 M18 5 L21 5 L21 8 C21 10 19 10 18 10"/>'),
  cd: S('<circle cx="12" cy="12" r="8"/><path d="M12 7 L12 12 L16 14"/>'),
  heart: S('<path d="M12 20 C5 15 4 10 7 8 C9 7 11 8 12 10 C13 8 15 7 17 8 C20 10 19 15 12 20Z"/>'),
  bond: S('<path d="M9 13 C6 13 4 11 4 9 C4 7 6 5 9 5 L12 5 M15 11 C18 11 20 13 20 15 C20 17 18 19 15 19 L12 19 M9 12 L15 12"/>'),
  codex: S('<path d="M5 4 L19 4 L19 20 L5 20 Z M8 8 L16 8 M8 12 L16 12 M8 16 L13 16"/>'),
  chest: S('<path d="M4 10 L20 10 L20 20 L4 20 Z M4 10 C4 5 20 5 20 10 M12 13 L12 16"/>'),
};

export function iconKey(k: string): string { return k in ICONS ? k : 'star'; }

export function iconSvgString(key: string, size = 24, color = 'currentColor', stroke = 1.7): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICONS[iconKey(key)]}</svg>`;
}

const imgCache = new Map<string, Promise<HTMLImageElement>>();
/** Rasterise an icon (used for Phaser textures). */
export function iconImage(key: string, size = 48, color = '#ffffff'): Promise<HTMLImageElement> {
  const id = `${key}|${size}|${color}`;
  let p = imgCache.get(id);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvgString(key, size, color, 1.9))}`;
    });
    imgCache.set(id, p);
    p.catch(() => { if (imgCache.get(id) === p) imgCache.delete(id); });   // a failed decode is retried next time, not remembered
  }
  return p;
}

// ------------------------------------------------------------------ pixel icons
/** icons are boiled down to ICON_PX x ICON_PX native pixels and shown at an integer zoom */
export const ICON_PX = 16;
const MASK_ZOOM = 12;
const pixCanvases = new Map<string, HTMLCanvasElement>();
const pixUrls = new Map<string, string>();
let pixReady: Promise<void> | null = null;

async function rasterise(key: string): Promise<HTMLCanvasElement> {
  const svg = iconSvgString(key, 96, '#ffffff', 2.5);
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error(`icon ${key}`)); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; setTimeout(() => rej(new Error(`icon ${key} timed out`)), 5000); });
  const cv = document.createElement('canvas'); cv.width = ICON_PX; cv.height = ICON_PX;
  const c = ctx2d(cv, { willReadFrequently: true });
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(img, 1, 1, ICON_PX - 2, ICON_PX - 2);
  const d = c.getImageData(0, 0, ICON_PX, ICON_PX);
  for (let i = 0; i < d.data.length; i += 4) { const on = d.data[i + 3] >= 84; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = on ? 255 : 0; }
  c.putImageData(d, 0, 0);
  return cv;
}

/** rasterise every icon once (call before the first render; the UI falls back to the vector icon until then) */
export function preloadPixelIcons(): Promise<void> {
  pixReady ??= Promise.all(Object.keys(ICONS).map(async (k) => { try { pixCanvases.set(k, await rasterise(k)); } catch { /* keep the vector fallback */ } })).then(() => {
    if (pixCanvases.size === 0) pixReady = null;                           // every icon failed (a transient decode problem): allow a later retry instead of remembering the failure
  });
  return pixReady;
}
/** a white-on-transparent pixel icon as a data URL, for CSS masks (undefined until preloaded) */
export function pixelIconUrl(key: string): string | undefined {
  const k = iconKey(key);
  const hit = pixUrls.get(k); if (hit) return hit;
  const cv = pixCanvases.get(k); if (!cv) return undefined;
  // Safari ignores image-rendering on CSS masks and smooths a 16px mask up to a retina size (a blurry top bar on iPad). Handing it the pixels pre-enlarged by a
  // whole number (12x divides into 1:1 pixel blocks at 1x, 2x, 3x and 4x device pixel ratios, for 16 and 32 CSS px icons) leaves nothing to smooth.
  const big = document.createElement('canvas'); big.width = big.height = ICON_PX * MASK_ZOOM;
  const bx = ctx2d(big); bx.imageSmoothingEnabled = false; bx.drawImage(cv, 0, 0, big.width, big.height);
  const u = big.toDataURL('image/png'); pixUrls.set(k, u); return u;
}
/** a coloured pixel icon with a dark outline, as an image (for Phaser textures) */
export async function pixelIconImage(key: string, color: string): Promise<HTMLImageElement> {
  await preloadPixelIcons();
  const src = pixCanvases.get(iconKey(key)) ?? await rasterise(iconKey(key));
  const n = ICON_PX + 2, cv = document.createElement('canvas'); cv.width = n; cv.height = n;
  const c = ctx2d(cv);
  const tint = (col: string): HTMLCanvasElement => { const t = document.createElement('canvas'); t.width = ICON_PX; t.height = ICON_PX; const x = ctx2d(t); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, ICON_PX, ICON_PX); return t; };
  const dark = tint('#0b0714'), lit = tint(color);
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) c.drawImage(dark, dx, dy);
  c.drawImage(lit, 1, 1);
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error(`status icon ${key}`)); img.src = cv.toDataURL('image/png'); });
  return img;
}
