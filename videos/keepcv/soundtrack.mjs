import { readFile, writeFile } from "node:fs/promises";
import { audioCues } from "./audio-cues.mjs";

const rate = 44100;
const source = await readFile("videos/keepcv/public/audio/score-pop.wav");
const tau = Math.PI * 2;
for (const [cut, seconds] of [
  ["short", 90],
  ["long", 180],
]) {
  const mix = new Float32Array(seconds * rate * 2);
  const cues = audioCues(cut);
  const duck = new Float32Array(seconds * rate).fill(1);
  for (const cue of cues) {
    const length =
      cue.type === "swish"
        ? 0.3
        : cue.type === "confirm"
          ? 0.45
          : cue.type === "chime"
            ? 0.25
            : 0.09;
    const offset = Math.round(cue.at * rate);
    let seed = offset + 197;
    let lastNoise = 0;
    for (let i = 0; i < length * rate && offset + i < seconds * rate; i++) {
      const t = i / rate;
      const p = t / length;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      const highNoise = (noise - lastNoise) * 0.5;
      lastNoise = noise;
      const attack = Math.min(1, t / 0.004);
      let value;
      if (cue.type === "swish") value = highNoise * Math.sin(Math.PI * p) ** 2 * 0.075;
      else if (cue.type === "key")
        value =
          (highNoise * 0.7 + Math.sin(tau * 1100 * t) * 0.3) * Math.exp(-t * 95) * attack * 0.09;
      else if (cue.type === "click")
        value = (Math.sin(tau * 1400 * t) + highNoise * 0.5) * Math.exp(-t * 90) * attack * 0.09;
      else if (cue.type === "pop")
        value = Math.sin(tau * (600 * t - 1800 * t * t)) * Math.exp(-t * 48) * attack * 0.1;
      else {
        const upper = cue.type === "confirm" ? 1318.51 : 1046.5;
        value =
          (Math.sin(tau * 1046.5 * t) +
            Math.sin(tau * upper * t) * 0.6 +
            Math.sin(tau * 1567.98 * t) * 0.3) *
          Math.exp(-t * 11) *
          attack *
          0.06;
      }
      value *= cue.strength;
      const pan = cue.type === "swish" ? p * 0.6 + 0.2 : 0.5;
      mix[(offset + i) * 2] += value * (1 - pan) * 1.4;
      mix[(offset + i) * 2 + 1] += value * pan * 1.4;
      duck[offset + i] = Math.min(duck[offset + i], 1 - Math.sin(Math.PI * p) * 0.15);
    }
  }
  const effects = new Float32Array(mix);
  let peak = 0;
  for (let i = 0; i < mix.length; i++) {
    const t = i / 2 / rate;
    const fade = Math.max(0, Math.min(1, t / 0.45, (seconds - t) / 2));
    mix[i] =
      ((source.readInt16LE(44 + i * 2) / 32768) * 0.85 * duck[Math.floor(i / 2)] + mix[i]) * fade;
    peak = Math.max(peak, Math.abs(mix[i]));
  }
  const output = Buffer.alloc(44 + mix.length * 2);
  source.copy(output, 0, 0, 44);
  output.writeUInt32LE(output.length - 8, 4);
  output.writeUInt32LE(mix.length * 2, 40);
  const gain = Math.min(1.4, 0.65 / peak);
  for (let i = 0; i < mix.length; i++)
    output.writeInt16LE(Math.round(mix[i] * gain * 32767), 44 + i * 2);
  await writeFile(`videos/keepcv/public/audio/mix-${cut}.wav`, output);
  for (let i = 0; i < effects.length; i++)
    output.writeInt16LE(Math.round(effects[i] * gain * 32767), 44 + i * 2);
  await writeFile(`videos/keepcv/public/audio/effects-${cut}.wav`, output);
  await writeFile(`.keepcv-promo/qa/audio-cues-${cut}.json`, JSON.stringify(cues, null, 2));
}
