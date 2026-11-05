#!/usr/bin/env node
// Original instrumental music bed for the bottleneck explainer (15s).
// Everything is synthesized here from plain math (no samples), so it is
// original and comes out identical every time.
//
//   node audio/make-bottleneck-bed.mjs   →   audio/bottleneck-bed.wav
//
// Music: C major, 96 BPM, one chord per bar (2.5s):
//   Am7 → Fmaj7 → Cmaj7 → G6 → Fmaj7 → Cmaj9
// Warm pad + soft bass from the start, light plucked arpeggio once the
// steps begin (~3.75s), soft chimes when each step lands (4s, 6s, 8s) and
// when the end card arrives (12s). Fades in and out.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const DURATION = 15;
const BAR = 2.5; // seconds (96 BPM, 4/4)
const EIGHTH = BAR / 8;
const GAIN = 1.0; // master level, set so the bed sits around -20 LUFS (quiet under visuals)
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bottleneck-bed.wav');

const N = SR * DURATION;
const padL = new Float64Array(N), padR = new Float64Array(N);
const sendL = new Float64Array(N), sendR = new Float64Array(N); // goes through the echo

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const TAU = Math.PI * 2;

// [bass, pad notes...] per bar
const CHORDS = [
  [45, 57, 60, 64, 67], // Am7
  [41, 53, 57, 60, 64], // Fmaj7
  [48, 55, 59, 60, 64], // Cmaj7
  [43, 55, 59, 62, 64], // G6
  [41, 53, 57, 60, 64], // Fmaj7
  [36, 55, 59, 62, 64], // Cmaj9 (end card)
];

// ---- Pad and bass: chords crossfade smoothly into each other ----
const XF = 0.7; // crossfade seconds
CHORDS.forEach(([bass, ...notes], b) => {
  const start = b * BAR;
  const end = b === CHORDS.length - 1 ? DURATION + XF : (b + 1) * BAR;
  const s0 = Math.max(0, Math.floor((start - (b ? XF / 2 : 0)) * SR));
  const s1 = Math.min(N, Math.ceil((end + XF / 2) * SR));
  for (let i = s0; i < s1; i++) {
    const t = i / SR;
    const w = smooth((t - start + XF / 2) / XF) * smooth((end + XF / 2 - t) / XF);
    if (w <= 0) continue;
    let l = 0, r = 0;
    notes.forEach((m, k) => {
      const f = freq(m);
      // Two slightly detuned voices per note, panned apart, for warmth.
      for (const [cents, pan] of [[-4, -0.35], [4, 0.35]]) {
        const fd = f * 2 ** (cents / 1200);
        const v = Math.sin(TAU * fd * t + k) + 0.25 * Math.sin(TAU * 2 * fd * t) + 0.08 * Math.sin(TAU * 3 * fd * t);
        l += v * (0.5 - pan / 2);
        r += v * (0.5 + pan / 2);
      }
    });
    const fb = freq(bass);
    const bv = Math.sin(TAU * fb * t) + 0.2 * Math.sin(TAU * 2 * fb * t);
    // Slow, gentle swell inside each bar so the pad breathes.
    const breathe = 0.85 + 0.15 * Math.sin(TAU * (t / BAR) - Math.PI / 2);
    padL[i] += w * (0.045 * l * breathe + 0.11 * bv);
    padR[i] += w * (0.045 * r * breathe + 0.11 * bv);
  }
});

// One-pole low-pass on the pad bus to keep it soft.
function lowpass(buf, cutoff) {
  const a = 1 - Math.exp((-TAU * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) { y += a * (buf[i] - y); buf[i] = y; }
}
lowpass(padL, 1600);
lowpass(padR, 1600);

// ---- Plucked arpeggio (starts with the steps) ----
function pluck(t0, midi, amp, pan) {
  const f = freq(midi);
  const s0 = Math.floor(t0 * SR), s1 = Math.min(N, s0 + Math.floor(1.4 * SR));
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 4.5);
    const v = Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 9) + 0.08 * Math.sin(TAU * 3 * f * t) * Math.exp(-t * 14);
    sendL[i] += v * env * amp * (0.5 - pan / 2);
    sendR[i] += v * env * amp * (0.5 + pan / 2);
  }
}
const PATTERN = [0, 2, 1, 3, 2, 1, 3, 2]; // index into the chord's pad notes
const ARP_START = 3.75, ARP_END = 14.4;
for (let n = 0; n * EIGHTH < DURATION; n++) {
  const t = n * EIGHTH;
  if (t < ARP_START || t > ARP_END) continue;
  const bar = Math.min(CHORDS.length - 1, Math.floor(t / BAR));
  const notes = CHORDS[bar].slice(1);
  const midi = notes[PATTERN[n % 8] % notes.length] + 12;
  const accent = n % 4 === 0 ? 1 : n % 2 === 0 ? 0.8 : 0.65;
  const ramp = smooth((t - ARP_START) / 1.2); // eases in
  pluck(t, midi, 0.07 * accent * ramp, n % 2 ? 0.3 : -0.3);
}

// ---- Chimes when each step lands and when the end card arrives ----
function chime(t0, midi, amp) {
  const f = freq(midi);
  const partials = [[1, 1, 2.2], [2, 0.45, 3.2], [2.76, 0.28, 4.5], [5.4, 0.1, 7]];
  const s0 = Math.floor(t0 * SR), s1 = Math.min(N, s0 + Math.floor(3 * SR));
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    let v = 0;
    for (const [ratio, a, decay] of partials) v += a * Math.sin(TAU * f * ratio * t) * Math.exp(-t * decay);
    v *= Math.min(1, t / 0.003) * amp;
    sendL[i] += v * 0.55;
    sendR[i] += v * 0.45;
  }
}
chime(4.05, 88, 0.05); // step 1 (E6)
chime(6.05, 91, 0.05); // step 2 (G6)
chime(8.05, 95, 0.05); // step 3 (B6)
chime(11.75, 84, 0.06); // end card (C6)
chime(11.75, 91, 0.04); //           (G6)

// ---- Stereo echo on the pluck/chime bus for a sense of space ----
function echo(inL, inR, timeL, timeR, feedback, wet) {
  const dL = Math.floor(timeL * SR), dR = Math.floor(timeR * SR);
  const outL = new Float64Array(N), outR = new Float64Array(N);
  let lpL = 0, lpR = 0;
  for (let i = 0; i < N; i++) {
    const tapL = i >= dL ? outL[i - dL] : 0;
    const tapR = i >= dR ? outR[i - dR] : 0;
    lpL += 0.35 * (tapR - lpL); // ping-pong, darkened each repeat
    lpR += 0.35 * (tapL - lpR);
    outL[i] = inL[i] + feedback * lpL;
    outR[i] = inR[i] + feedback * lpR;
  }
  for (let i = 0; i < N; i++) {
    inL[i] = inL[i] * (1 - wet) + outL[i] * wet;
    inR[i] = inR[i] * (1 - wet) + outR[i] * wet;
  }
}
echo(sendL, sendR, EIGHTH * 3, EIGHTH * 2, 0.42, 0.45);

// ---- Mix, fade in/out, gentle limiting ----
const L = new Float64Array(N), R = new Float64Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = smooth(t / 0.8) * smooth((DURATION - t) / 1.6);
  L[i] = Math.tanh((padL[i] + sendL[i]) * GAIN * fade * 1.5) / 1.5;
  R[i] = Math.tanh((padR[i] + sendR[i]) * GAIN * fade * 1.5) / 1.5;
}

// ---- Write 16-bit stereo WAV ----
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
fs.writeFileSync(OUT, Buffer.concat([header, data]));
console.log(`Music → ${path.relative(process.cwd(), OUT)} (${DURATION}s)`);
