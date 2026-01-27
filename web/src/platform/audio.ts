/**
 * Empire: Wargame of the Century
 * Web Audio System
 */

// Sound effect IDs
export enum SoundId {
  CLICK = 0,
  MOVE = 1,
  ATTACK = 2,
  DESTROY = 3,
  PRODUCE = 4,
  VICTORY = 5,
  DEFEAT = 6,
  ERROR = 7,
}

// Sound file mappings (would map to converted audio files)
const SOUND_FILES: Record<SoundId, string> = {
  [SoundId.CLICK]: 'click.mp3',
  [SoundId.MOVE]: 'move.mp3',
  [SoundId.ATTACK]: 'attack.mp3',
  [SoundId.DESTROY]: 'destroy.mp3',
  [SoundId.PRODUCE]: 'produce.mp3',
  [SoundId.VICTORY]: 'victory.mp3',
  [SoundId.DEFEAT]: 'defeat.mp3',
  [SoundId.ERROR]: 'error.mp3',
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<SoundId, AudioBuffer> = new Map();
  private enabled: boolean = true;
  private loaded: boolean = false;

  /**
   * Initialize audio context.
   * Must be called after user interaction (browser requirement).
   */
  async init(): Promise<void> {
    if (this.ctx) return;

    try {
      this.ctx = new AudioContext();
      await this.loadSounds();
      this.loaded = true;
    } catch (e) {
      console.warn('Audio initialization failed:', e);
    }
  }

  /**
   * Load all sound effects.
   */
  private async loadSounds(): Promise<void> {
    if (!this.ctx) return;

    // In production, would load actual sound files
    // For now, generate simple tones
    for (const id of Object.values(SoundId).filter(v => typeof v === 'number') as SoundId[]) {
      const buffer = this.generateTone(id);
      if (buffer) {
        this.buffers.set(id, buffer);
      }
    }
  }

  /**
   * Generate a simple tone for a sound effect.
   */
  private generateTone(id: SoundId): AudioBuffer | null {
    if (!this.ctx) return null;

    const sampleRate = this.ctx.sampleRate;
    const duration = 0.1;
    const buffer = this.ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Different frequencies/patterns for different sounds
    const params = this.getSoundParams(id);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * params.decay);
      data[i] = Math.sin(2 * Math.PI * params.freq * t) * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * Get parameters for different sound effects.
   */
  private getSoundParams(id: SoundId): { freq: number; decay: number } {
    switch (id) {
      case SoundId.CLICK:
        return { freq: 1000, decay: 30 };
      case SoundId.MOVE:
        return { freq: 400, decay: 20 };
      case SoundId.ATTACK:
        return { freq: 200, decay: 10 };
      case SoundId.DESTROY:
        return { freq: 100, decay: 5 };
      case SoundId.PRODUCE:
        return { freq: 800, decay: 15 };
      case SoundId.VICTORY:
        return { freq: 600, decay: 8 };
      case SoundId.DEFEAT:
        return { freq: 150, decay: 3 };
      case SoundId.ERROR:
        return { freq: 200, decay: 25 };
      default:
        return { freq: 440, decay: 20 };
    }
  }

  /**
   * Play a sound effect.
   */
  play(id: SoundId): void {
    if (!this.enabled || !this.ctx || !this.loaded) return;

    const buffer = this.buffers.get(id);
    if (!buffer) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start();
    } catch (e) {
      console.warn('Error playing sound:', e);
    }
  }

  /**
   * Toggle sound on/off.
   */
  toggle(enabled?: boolean): boolean {
    if (enabled !== undefined) {
      this.enabled = enabled;
    } else {
      this.enabled = !this.enabled;
    }
    return this.enabled;
  }

  /**
   * Check if sound is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Resume audio context (needed after page interaction).
   */
  resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }
}
