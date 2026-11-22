import { mkdir, writeFile } from "node:fs/promises";

const rate = 44100;
const beatLength = 60 / 140;
const stepLength = beatLength / 2;
const chordLength = beatLength * 8;
const seconds = 180;
const samples = rate * seconds;
const buffer = Buffer.alloc(44 + samples * 4);
buffer.write("RIFF");
buffer.writeUInt32LE(buffer.length - 8, 4);
buffer.write("WAVEfmt ", 8);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(2, 22);
buffer.writeUInt32LE(rate, 24);
buffer.writeUInt32LE(rate * 4, 28);
buffer.writeUInt16LE(4, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(samples * 4, 40);
const chords = [
  [45, 48, 52, 55],
  [41, 45, 48, 52],
  [48, 52, 55, 59],
  [43, 47, 50, 57],
];
const frequency = (note) => 440 * 2 ** ((note - 69) / 12);
const tau = Math.PI * 2;
const sound = new Float32Array(samples * 2);
const motif = [0, 2, 1, 3, 2, 1, 3, 2];
const hookNotes = [72, 76, 79, 76, 74, 72, 69, 72, 72, 76, 81, 79, 76, 74, 72, 74];
function hook(time) {
  if (time < 0) return 0;
  const step = Math.floor(time / beatLength);
  const age = time % beatLength;
  const note = hookNotes[step % hookNotes.length];
  const phase = tau * frequency(note) * age;
  const envelope = Math.min(1, age / 0.015) * Math.exp(-age * 5.5);
  return (
    (Math.sin(phase) + 0.3 * Math.sin(phase * 2) + 0.12 * Math.sin(phase * 3)) * envelope * 0.075
  );
}
let seed = 197;
let previousNoise = 0;
let peak = 0;
function pad(chord, time) {
  let value = 0;
  for (const note of chord) {
    const phase = tau * frequency(note + 12) * time;
    value +=
      (Math.sin(phase) + 0.35 * Math.sin(phase * 1.003) + 0.12 * Math.sin(phase * 2)) * 0.012;
  }
  return value;
}
function arp(time) {
  if (time < 0) return 0;
  const step = Math.floor(time / stepLength);
  const chord = chords[Math.floor(time / chordLength) % 4];
  const age = time % stepLength;
  const phase = tau * frequency(chord[motif[step % 8]] + 12) * age;
  const envelope = Math.min(1, age / 0.008) * Math.exp(-age * 15);
  return (
    (Math.sin(phase) +
      0.42 * Math.sin(phase * 2) +
      0.18 * Math.sin(phase * 3) +
      0.08 * Math.sin(phase * 4)) *
    envelope *
    0.065
  );
}
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  const beat = t % beatLength;
  const bar = Math.floor(t / (beatLength * 4));
  const chordIndex = Math.floor(t / chordLength) % 4;
  const blend = Math.min(1, (t % chordLength) / stepLength);
  const harmony =
    pad(chords[chordIndex], t) * blend + pad(chords[(chordIndex + 3) % 4], t) * (1 - blend);
  const sidechain = 0.74 + 0.26 * (1 - Math.exp(-beat * 12));
  const groove = 0.7 + 0.3 * Math.min(1, t / (beatLength * 4));
  const breakdown = bar % 16 === 15 ? 0.82 : 1;
  const kick =
    Math.sin(tau * (50 * beat + 4.5 * (1 - Math.exp(-beat * 26)))) * Math.exp(-beat * 18) * 0.24;
  const bassAge = (t + stepLength) % beatLength;
  const bassPhase = tau * frequency(chords[chordIndex][0] - 12) * bassAge;
  const bass =
    (Math.sin(bassPhase) + 0.23 * Math.sin(bassPhase * 2) + 0.1 * Math.sin(bassPhase * 3)) *
    Math.min(1, bassAge * 110) *
    Math.exp(-bassAge * 4.5) *
    0.12;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const noise = seed / 2147483648 - 1;
  const highNoise = (noise - previousNoise) * 0.5;
  previousNoise = noise;
  const hatAge = t % (stepLength / 2);
  const hat =
    highNoise * Math.exp(-hatAge * 110) * 0.04 * (Math.floor(t / (stepLength / 2)) % 2 ? 0.45 : 1);
  const openHatAge = (t + stepLength) % beatLength;
  const openHat = highNoise * Math.exp(-openHatAge * 24) * 0.025;
  const snareAge = (t + beatLength) % (beatLength * 2);
  const snare =
    (highNoise * 0.8 + Math.sin(tau * 185 * snareAge) * 0.2) * Math.exp(-snareAge * 28) * 0.115;
  const fillAge = t % (stepLength / 2);
  const fill =
    bar % 8 === 7 && t % (beatLength * 4) > beatLength * 3
      ? highNoise * Math.exp(-fillAge * 65) * 0.04
      : 0;
  const clap =
    highNoise *
    (Math.exp(-snareAge * 36) +
      (snareAge > 0.018 ? Math.exp(-(snareAge - 0.018) * 50) * 0.45 : 0)) *
    0.045;
  const drums = (kick + hat + openHat + snare + clap + fill) * groove * breakdown;
  const synth = harmony * sidechain + bass * groove * sidechain;
  const lead = arp(t) * 0.6 + hook(t) * (bar % 8 < 6 ? 1 : 0.65);
  const envelope = Math.min(1, t / 1.5, (seconds - t) / 3);
  const left = Math.tanh((synth + drums + lead + arp(t - stepLength * 1.5) * 0.3) * 1.4) * envelope;
  const right =
    Math.tanh(
      (synth +
        drums +
        lead * 0.85 +
        hook(t - beatLength * 0.75) * 0.2 +
        arp(t - stepLength) * 0.25) *
        1.4,
    ) * envelope;
  sound[i * 2] = left;
  sound[i * 2 + 1] = right;
  peak = Math.max(peak, Math.abs(left), Math.abs(right));
}
const gain = 0.48 / peak;
for (let i = 0; i < sound.length; i++)
  buffer.writeInt16LE(Math.round(sound[i] * gain * 32767), 44 + i * 2);
await mkdir("videos/keepcv/public/audio", { recursive: true });
await writeFile("videos/keepcv/public/audio/score-pop.wav", buffer);
await import("./soundtrack.mjs");
