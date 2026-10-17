// Pixel-art spell and impact effects: every effect is a handful of small procedurally drawn frames
// (native pixels, shown at the stage zoom), played as a one-shot animation on an Image.
import Phaser from 'phaser';

import { drawers, mk, type FxKind } from '../art/pixel/fxFrames.ts';
export type { FxKind };
export { FX_KINDS, previewFrames } from '../art/pixel/fxFrames.ts';

interface Clip { frames: string[]; fps: number; blend: 'add' | 'normal'; w: number; h: number }
const clips = new Map<FxKind, Clip>();

/** register every effect as Phaser textures (call once from the scene's create) */
export function registerVfx(scene: Phaser.Scene): void {
  for (const [kind, d] of Object.entries(drawers) as [FxKind, (typeof drawers)[FxKind]][]) {
    if (clips.has(kind)) { if (scene.textures.exists(clips.get(kind)!.frames[0])) continue; }
    const frames: string[] = [];
    mk(d.w, d.h, d.draw, d.n).forEach((cv, i) => { const key = `fx:${kind}:${i}`; if (!scene.textures.exists(key)) scene.textures.addCanvas(key, cv); frames.push(key); });
    clips.set(kind, { frames, fps: d.fps, blend: d.blend, w: d.w, h: d.h });
  }
}

export interface PlayFx { tint?: number; scale?: number; flipX?: boolean; angle?: number; depth?: number; speed?: number; anchorBottom?: boolean }
/** play an effect once at (x, y); resolves when it has finished */
export function playVfx(scene: Phaser.Scene, kind: FxKind, x: number, y: number, o: PlayFx = {}): Promise<void> {
  const clip = clips.get(kind);
  if (!clip) return Promise.resolve();
  const img = scene.add.image(x, y, clip.frames[0]).setScale((o.scale ?? 1) * 2).setDepth(o.depth ?? 9450);
  if (o.anchorBottom) img.setOrigin(0.5, 1);
  if (o.tint !== undefined) img.setTint(o.tint);
  if (clip.blend === 'add') img.setBlendMode(Phaser.BlendModes.ADD);
  if (o.flipX) img.setFlipX(true);
  if (o.angle) img.setAngle(o.angle);
  return new Promise((res) => {
    let i = 0;
    const step = (): void => {
      i++;
      if (i >= clip.frames.length || !img.scene) { img.destroy(); res(); return; }
      img.setTexture(clip.frames[i]);
      scene.time.delayedCall(1000 / clip.fps / (o.speed ?? 1), step);
    };
    scene.time.delayedCall(1000 / clip.fps / (o.speed ?? 1), step);
  });
}

