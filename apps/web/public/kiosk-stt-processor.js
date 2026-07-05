// AudioWorklet that converts mic audio (Float32, context sample rate) into
// 16-bit little-endian PCM frames and posts them to the main thread, which
// streams them to Deepgram. Buffers to ~2048 samples so we send ~one message
// every ~40-85ms instead of one per 128-sample render quantum.
class KioskSttProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._frameSize = 2048;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channel = input[0];
      for (let i = 0; i < channel.length; i++) {
        this._buffer.push(channel[i]);
      }
      while (this._buffer.length >= this._frameSize) {
        const chunk = this._buffer.splice(0, this._frameSize);
        const pcm = new Int16Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('kiosk-stt-processor', KioskSttProcessor);
