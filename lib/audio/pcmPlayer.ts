/**
 * Low-latency PCM16 audio player using Web Audio API.
 * Accepts base64-encoded PCM16 chunks (24kHz, mono, 16-bit signed LE)
 * and schedules them for gapless sequential playback.
 */
export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private nextStartTime = 0;
  private scheduledCount = 0;
  private _playing = false;

  /** Called when the last queued chunk finishes playing. */
  onPlaybackEnd?: () => void;

  /**
   * Initialize or resume the AudioContext. Must be called from a user-gesture
   * context on the first invocation (browser autoplay policy).
   */
  async init(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 24000 });
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.nextStartTime = this.ctx.currentTime;
    this._playing = false;
    this.scheduledCount = 0;
  }

  /**
   * Decode a base64-encoded PCM16 chunk and schedule it for playback.
   * Chunks are played back-to-back with no gap.
   */
  enqueue(base64Chunk: string): void {
    if (!this.ctx || !this.gainNode) return;

    try {
      const raw = atob(base64Chunk);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
      }

      // Convert Int16LE → Float32 [-1, 1]
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const buffer = this.ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);

      // Schedule gapless: each chunk starts where the previous one ends
      const startAt = Math.max(this.nextStartTime, this.ctx.currentTime);
      source.start(startAt);
      this.nextStartTime = startAt + buffer.duration;
      this._playing = true;
      this.scheduledCount++;

      source.onended = () => {
        this.scheduledCount--;
        if (this.scheduledCount <= 0) {
          this._playing = false;
          this.scheduledCount = 0;
          this.onPlaybackEnd?.();
        }
      };
    } catch (err) {
      console.warn("[PcmPlayer] Failed to enqueue audio chunk:", err);
    }
  }

  /**
   * Immediately stop all audio playback (barge-in support).
   * Disconnects the gain node to silence everything, then reconnects.
   */
  flush(): void {
    if (!this.ctx || !this.gainNode) return;
    this.gainNode.disconnect();
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
    this.nextStartTime = this.ctx.currentTime;
    this._playing = false;
    this.scheduledCount = 0;
  }

  /** Set playback volume (0.0 = muted, 1.0 = full). */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /** Whether audio is currently being played back. */
  get playing(): boolean {
    return this._playing;
  }

  /** Clean up the AudioContext entirely. */
  async destroy(): Promise<void> {
    this.flush();
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}
