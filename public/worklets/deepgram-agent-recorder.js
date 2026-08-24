class DeepgramAgentRecorder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetSampleRate = Number(options?.processorOptions?.targetSampleRate || 16000);
    this.frameMs = Number(options?.processorOptions?.frameMs || 40);
    this.targetFrameSamples = Math.max(320, Math.floor(this.targetSampleRate * this.frameMs / 1000));
    this.buffer = [];
    this.sourceRemainder = new Float32Array(0);
  }

  downsample(input) {
    if (sampleRate === this.targetSampleRate) return input;

    const combined = new Float32Array(this.sourceRemainder.length + input.length);
    combined.set(this.sourceRemainder, 0);
    combined.set(input, this.sourceRemainder.length);

    const ratio = sampleRate / this.targetSampleRate;
    const outputLength = Math.floor(combined.length / ratio);
    const output = new Float32Array(outputLength);

    for (let index = 0; index < outputLength; index += 1) {
      const start = Math.floor(index * ratio);
      const end = Math.min(Math.floor((index + 1) * ratio), combined.length);
      let sum = 0;
      let count = 0;
      for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
        sum += combined[sourceIndex];
        count += 1;
      }
      output[index] = count ? sum / count : 0;
    }

    const consumed = Math.floor(outputLength * ratio);
    this.sourceRemainder = combined.slice(consumed);
    return output;
  }

  appendSamples(samples) {
    for (let index = 0; index < samples.length; index += 1) {
      this.buffer.push(samples[index]);
    }

    while (this.buffer.length >= this.targetFrameSamples) {
      const frame = this.buffer.splice(0, this.targetFrameSamples);
      const pcm = new Int16Array(frame.length);
      let squareSum = 0;
      for (let index = 0; index < frame.length; index += 1) {
        const value = Math.max(-1, Math.min(1, frame[index]));
        squareSum += value * value;
        pcm[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
      }
      const level = Math.min(1, Math.sqrt(squareSum / frame.length) * 3.2);
      this.port.postMessage({ type: "audio", audio: pcm.buffer, level }, [pcm.buffer]);
    }
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;
    this.appendSamples(this.downsample(input));
    return true;
  }
}

registerProcessor("deepgram-agent-recorder", DeepgramAgentRecorder);
