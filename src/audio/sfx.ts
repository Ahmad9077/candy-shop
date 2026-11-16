// Small synthesized sounds, so feedback needs no extra files. All soft: no buzzer anywhere.
import { audioContext } from './context'

type Tone = { freq: number; at: number; length: number; type?: OscillatorType; gain?: number; slide?: number }

let enabled = true

export function setSfxEnabled(value: boolean): void {
  enabled = value
}

function play(tones: Tone[]): void {
  const context = audioContext()
  if (!enabled || !context || context.state === 'closed') return
  try {
    const now = context.currentTime
    for (const tone of tones) {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = tone.type ?? 'sine'
      const start = now + tone.at
      osc.frequency.setValueAtTime(tone.freq, start)
      if (tone.slide) osc.frequency.exponentialRampToValueAtTime(tone.freq * tone.slide, start + tone.length)
      const peak = tone.gain ?? 0.16
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.length)
      osc.connect(gain).connect(context.destination)
      osc.start(start)
      osc.stop(start + tone.length + 0.05)
    }
  } catch {
    // Sound is a nicety.
  }
}

export const sfx = {
  /** The shop door: a two-note chime. */
  door: () =>
    play([
      { freq: 1318.5, at: 0, length: 0.6, gain: 0.09 },
      { freq: 1046.5, at: 0.22, length: 0.9, gain: 0.08 },
      { freq: 2637, at: 0, length: 0.25, gain: 0.015 },
    ]),
  /** The brass counter bell. */
  bell: () =>
    play([
      { freq: 2093, at: 0, length: 1.1, gain: 0.08 },
      { freq: 2793, at: 0, length: 0.7, gain: 0.03 },
      { freq: 4186, at: 0, length: 0.25, gain: 0.015 },
    ]),
  /** A coin landing. */
  coin: (index = 0) =>
    play([
      { freq: 1975 + index * 40, at: 0, length: 0.09, gain: 0.06, type: 'square' },
      { freq: 2637 + index * 40, at: 0.06, length: 0.22, gain: 0.05 },
    ]),
  /** Two coins leaving the board: soft and low, falling (never a buzzer). */
  lose: () =>
    play([
      { freq: 392, at: 0, length: 0.32, type: 'sine', gain: 0.06, slide: 0.7 },
      { freq: 330, at: 0.16, length: 0.4, type: 'sine', gain: 0.05, slide: 0.7 },
    ]),
  /** Something new appears in the shop. */
  sparkle: () =>
    play([
      { freq: 1568, at: 0, length: 0.25, gain: 0.05 },
      { freq: 2093, at: 0.07, length: 0.25, gain: 0.05 },
      { freq: 2637, at: 0.14, length: 0.3, gain: 0.05 },
      { freq: 3136, at: 0.21, length: 0.45, gain: 0.04 },
    ]),
  /** A box sliding along the counter. */
  slide: () => play([{ freq: 220, at: 0, length: 0.28, type: 'triangle', gain: 0.07, slide: 0.6 }]),
  /** The phone rings: a delivery. */
  phone: () =>
    play([
      { freq: 1318.5, at: 0, length: 0.09, gain: 0.07, type: 'square' },
      { freq: 1568, at: 0.1, length: 0.09, gain: 0.07, type: 'square' },
      { freq: 1318.5, at: 0.2, length: 0.09, gain: 0.07, type: 'square' },
      { freq: 1568, at: 0.3, length: 0.09, gain: 0.07, type: 'square' },
      { freq: 1318.5, at: 0.7, length: 0.09, gain: 0.07, type: 'square' },
      { freq: 1568, at: 0.8, length: 0.09, gain: 0.07, type: 'square' },
    ]),
  /** A sticker slapped on a bag. */
  slap: () => play([{ freq: 180, at: 0, length: 0.08, type: 'triangle', gain: 0.14, slide: 0.6 }]),
  /** A happy customer. */
  happy: () =>
    play([
      { freq: 784, at: 0, length: 0.12, gain: 0.07 },
      { freq: 1175, at: 0.1, length: 0.18, gain: 0.07 },
    ]),
  /** A puzzled customer: a soft rising "hm?". */
  puzzled: () => play([{ freq: 330, at: 0, length: 0.3, type: 'triangle', gain: 0.07, slide: 1.35 }]),
  /** A soft drop for each candy; it rises a little with the count. */
  plip: (count = 1) => {
    const base = 520 * Math.pow(2, Math.min(10, Math.max(0, count - 1)) / 14)
    play([
      { freq: base * 1.5, at: 0, length: 0.11, gain: 0.12, slide: 0.66 },
      { freq: base * 2, at: 0.015, length: 0.07, gain: 0.04, type: 'triangle' },
    ])
  },
  /** A small chime for a right answer. */
  chime: () =>
    play([
      { freq: 1046.5, at: 0, length: 0.5, gain: 0.1 },
      { freq: 1318.5, at: 0.08, length: 0.55, gain: 0.08 },
      { freq: 1568, at: 0.16, length: 0.7, gain: 0.07 },
      { freq: 2093, at: 0.16, length: 0.4, gain: 0.025 },
    ]),
  /** A soft wooden "tok" for a miss. */
  tok: () =>
    play([
      { freq: 300, at: 0, length: 0.09, type: 'triangle', gain: 0.16, slide: 0.8 },
      { freq: 600, at: 0, length: 0.04, type: 'sine', gain: 0.05 },
    ]),
  /** The box lid opening or closing. */
  lid: () => play([{ freq: 340, at: 0, length: 0.16, type: 'sine', gain: 0.07, slide: 1.6 }]),
  hop: () => play([{ freq: 380, at: 0, length: 0.2, type: 'sine', gain: 0.09, slide: 2 }]),
  pop: () => play([{ freq: 880, at: 0, length: 0.12, gain: 0.08, slide: 1.4 }]),
  star: () =>
    play([
      { freq: 1047, at: 0, length: 0.14, gain: 0.1 },
      { freq: 1568, at: 0.07, length: 0.22, gain: 0.08 },
    ]),
  fanfare: () =>
    play([
      { freq: 523, at: 0, length: 0.18, gain: 0.12 },
      { freq: 659, at: 0.15, length: 0.18, gain: 0.12 },
      { freq: 784, at: 0.3, length: 0.18, gain: 0.12 },
      { freq: 1047, at: 0.45, length: 0.6, gain: 0.12 },
    ]),
}
