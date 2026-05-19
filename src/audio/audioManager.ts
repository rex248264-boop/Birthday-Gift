import { Howl } from 'howler';
import { pickFirstExisting, resolveBGM, resolveSFX, resolveVoice } from '@/engine/assetResolver';

class AudioManager {
  private bgm: Howl | null = null;
  private bgmKey: string | null = null;
  private currentVoice: Howl | null = null;
  private unlocked = false;

  unlock() {
    this.unlocked = true;
    // Trigger an empty sound to satisfy iOS Safari autoplay restriction.
    try {
      const ctx = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
      if (ctx) {
        const c = new ctx();
        if (c.state === 'suspended') void c.resume();
      }
    } catch {
      // ignore
    }
  }

  /**
   * 尝试播放本场 BGM。若找不到文件则保持当前曲目循环（跨幕延续）。
   * @returns 是否成功切换到新曲目
   */
  async playBGM(sceneId: string, hint?: string): Promise<boolean> {
    const key = hint || sceneId;
    if (this.bgmKey === key && this.bgm) return true;

    const candidates = resolveBGM(sceneId, hint);
    const url = await pickFirstExisting(candidates);
    if (!url) return false;

    if (this.bgm) {
      const old = this.bgm;
      old.fade(old.volume(), 0, 800);
      setTimeout(() => old.unload(), 850);
    }
    this.bgm = new Howl({ src: [url], loop: true, volume: 0, html5: true });
    this.bgmKey = key;
    this.bgm.play();
    this.bgm.fade(0, 0.6, 1200);
    return true;
  }

  stopBGM() {
    if (this.bgm) {
      this.bgm.fade(this.bgm.volume(), 0, 600);
      const old = this.bgm;
      setTimeout(() => old.unload(), 650);
      this.bgm = null;
      this.bgmKey = null;
    }
  }

  playSFX(hint: string, volume = 1) {
    if (!hint) return;
    const url = resolveSFX(hint);
    const h = new Howl({ src: [url], volume, html5: true });
    h.play();
    h.once('end', () => h.unload());
  }

  async playVoice(
    sceneId: string,
    frameId: string,
    maleLineIdx: number,
    hint?: string,
    cacheBust?: number,
  ) {
    this.stopVoice();
    const candidates = resolveVoice(sceneId, frameId, maleLineIdx, hint);
    const url = await pickFirstExisting(candidates);
    if (!url) return;
    const src = cacheBust ? `${url}?v=${cacheBust}` : url;
    this.currentVoice = new Howl({ src: [src], volume: 0.9, html5: true });
    this.currentVoice.play();
  }

  stopVoice() {
    if (this.currentVoice) {
      this.currentVoice.stop();
      this.currentVoice.unload();
      this.currentVoice = null;
    }
  }

  isUnlocked() {
    return this.unlocked;
  }
}

export const audio = new AudioManager();
