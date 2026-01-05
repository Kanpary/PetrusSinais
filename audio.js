/* audio.js
   AudioManager handles deferred audio context creation and simple play helpers.
   Tombstones: removed setupAudio() and playSound() from app.js
   // removed function setupAudio() {}
   // removed function playSound() {}
*/
export class AudioManager {
  constructor() {
    this.audioCtx = null;
  }

  async _loadSound(url) {
    if (!this.audioCtx) return null;
    try {
      const resp = await fetch(url);
      const ab = await resp.arrayBuffer();
      return await this.audioCtx.decodeAudioData(ab);
    } catch (e) {
      return null;
    }
  }

  setupDeferredAudio() {
    window.addEventListener('touchstart', async () => {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      // preload common sounds if available
      this.scanBuffer = await this._loadSound('scan-hum.mp3');
      this.successBuffer = await this._loadSound('success-chime.mp3');
    }, { once: true });
  }

  playOnce(urlOrBuffer) {
    if (!this.audioCtx) return null;
    const buffer = (typeof urlOrBuffer === 'string') ? (urlOrBuffer.endsWith('.mp3') ? this.successBuffer : null) : urlOrBuffer;
    // if buffer not preloaded, try loading on demand
    const play = async () => {
      let buf = buffer;
      if (!buf && typeof urlOrBuffer === 'string') {
        buf = await this._loadSound(urlOrBuffer);
      }
      if (!buf) return null;
      const src = this.audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(this.audioCtx.destination);
      src.start(0);
      return src;
    };
    play();
    return null;
  }

  playLoop(url) {
    if (!this.audioCtx || !this.scanBuffer) return null;
    const src = this.audioCtx.createBufferSource();
    src.buffer = this.scanBuffer;
    src.loop = true;
    src.connect(this.audioCtx.destination);
    src.start(0);
    return {
      stop: () => { try { src.stop(); } catch(e){} }
    };
  }
}