import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const sampleRate = 44100
const root = resolve(import.meta.dirname, '..')

const catalog = {
  bgm: {
    'mist-bamboo': {
      title: '雾竹清修',
      description: '修仙世界地图背景音，风声、箫音和古琴拨弦铺底。',
      resource: 'Assets/Audio/Bgm/mist-bamboo',
      minDurationSeconds: 8,
      loop: true,
      volume: 0.42,
    },
  },
  cues: {
    'hand-seal': {
      title: '掐诀灵息',
      description: '法诀起手的短促灵气聚拢声。',
      resource: 'Assets/Audio/Cues/hand-seal',
      minDurationSeconds: 0.32,
      volume: 0.78,
    },
    'sword-launch': {
      title: '飞剑破空',
      description: '飞剑出鞘后穿空的清亮剑鸣。',
      resource: 'Assets/Audio/Cues/sword-launch',
      minDurationSeconds: 0.4,
      volume: 0.88,
    },
    'sword-return': {
      title: '飞剑回旋',
      description: '飞剑回身绕行的轻微剑风。',
      resource: 'Assets/Audio/Cues/sword-return',
      minDurationSeconds: 0.34,
      volume: 0.7,
    },
    'light-hit': {
      title: '剑气命中',
      description: '飞剑命中怪物时的短促灵气爆点。',
      resource: 'Assets/Audio/Cues/light-hit',
      minDurationSeconds: 0.22,
      volume: 0.72,
    },
    'boss-break': {
      title: 'Boss 护体破碎',
      description: '修仙 Boss 护体灵光破碎时的厚重冲击声。',
      resource: 'Assets/Audio/Cues/boss-break',
      minDurationSeconds: 0.75,
      volume: 0.92,
    },
    'pursuit-warning': {
      title: '雾皇追猎',
      description: '修仙副本追猎者逼近时的低沉竹磬与逆风警示。',
      resource: 'Assets/Audio/Cues/pursuit-warning',
      minDurationSeconds: 0.72,
      volume: 0.86,
    },
    'extraction-start': {
      title: '撤离阵启',
      description: '修仙撤离法阵开始聚拢灵气的玉磬回响。',
      resource: 'Assets/Audio/Cues/extraction-start',
      minDurationSeconds: 0.58,
      volume: 0.74,
    },
    'extraction-complete': {
      title: '撤离功成',
      description: '修仙传送完成时清亮上扬的灵光和弦。',
      resource: 'Assets/Audio/Cues/extraction-complete',
      minDurationSeconds: 0.9,
      volume: 0.82,
    },
  },
}

const metaByResource = {
  'Assets/Audio/Bgm/mist-bamboo': 'e90d43ed-7668-4378-9769-56f357395f21',
  'Assets/Audio/Cues/hand-seal': 'd71a1a58-e28b-4140-967e-c32a29ce7bd3',
  'Assets/Audio/Cues/sword-launch': '540033df-8b60-4e33-b2e0-c851fd4497a5',
  'Assets/Audio/Cues/sword-return': 'a03333ee-7f1e-4025-a7fc-8fead5ac4236',
  'Assets/Audio/Cues/light-hit': '1a2b8bb4-1d64-428d-a6cc-cdfb96a0a0e3',
  'Assets/Audio/Cues/boss-break': '785b610e-7cf7-4054-ab77-edfead1708e9',
  'Assets/Audio/Cues/pursuit-warning': 'af92d07c-6f91-49f2-b64f-2c9e28923b61',
  'Assets/Audio/Cues/extraction-start': 'b5a10755-7dd6-4fa3-8bb0-8ad9a1eed37d',
  'Assets/Audio/Cues/extraction-complete': 'd8dfc2d5-7983-4efc-9573-82786d6b6ec1',
}

function clamp(value, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function smoothNoise(seed) {
  let state = seed >>> 0
  let current = 0
  let next = 0
  return (t) => {
    const step = Math.floor(t * 18)
    const local = t * 18 - step
    if (step !== smoothNoise.lastStep) {
      smoothNoise.lastStep = step
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      current = next
      next = (state / 0x100000000) * 2 - 1
    }
    const fade = local * local * (3 - 2 * local)
    return current + (next - current) * fade
  }
}
smoothNoise.lastStep = -1

function envelope(t, duration, attack = 0.02, release = 0.12) {
  if (t < attack) return t / attack
  if (t > duration - release) return Math.max(0, (duration - t) / release)
  return 1
}

function pluck(t, freq, start, gain, decay = 2.8) {
  const age = t - start
  if (age < 0) return 0
  const env = Math.exp(-age * decay) * envelope(age, 2, 0.006, 0.4)
  return gain * env * (
    Math.sin(Math.PI * 2 * freq * age)
    + 0.38 * Math.sin(Math.PI * 2 * freq * 2.01 * age)
    + 0.18 * Math.sin(Math.PI * 2 * freq * 3.02 * age)
  )
}

function sweep(t, startFreq, endFreq, duration, gain) {
  const ratio = Math.min(1, Math.max(0, t / duration))
  const freq = startFreq + (endFreq - startFreq) * ratio
  return gain * envelope(t, duration, 0.01, 0.08) * Math.sin(Math.PI * 2 * freq * t)
}

function synth(duration, render) {
  const length = Math.ceil(duration * sampleRate)
  const samples = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    const t = index / sampleRate
    samples[index] = clamp(render(t, duration))
  }
  return samples
}

function writeWav(path, samples) {
  mkdirSync(dirname(path), { recursive: true })
  const dataBytes = samples.length * 2
  const buffer = Buffer.alloc(44 + dataBytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(clamp(samples[index]) * 32767), 44 + index * 2)
  }
  writeFileSync(path, buffer)
}

function writeAudioMeta(path, uuid) {
  writeFileSync(`${path}.meta`, `${JSON.stringify({
    ver: '1.0.6',
    importer: 'audio-clip',
    imported: true,
    uuid,
    files: ['.json'],
    subMetas: {},
    userData: {
      downloadMode: 0,
    },
  }, null, 2)}\n`)
}

function writeJsonMeta(path, uuid) {
  writeFileSync(`${path}.meta`, `${JSON.stringify({
    ver: '2.0.1',
    importer: 'json',
    imported: true,
    uuid,
    files: ['.json'],
    subMetas: {},
    userData: {},
  }, null, 2)}\n`)
}

function renderBgm() {
  const noise = smoothNoise(20260714)
  const notes = [146.83, 164.81, 196, 220, 246.94, 293.66]
  return synth(10.5, (t, duration) => {
    const wind = 0.08 * noise(t) + 0.03 * noise(t * 0.37 + 3)
    const drone = 0.08 * Math.sin(Math.PI * 2 * 73.42 * t) + 0.04 * Math.sin(Math.PI * 2 * 110 * t)
    const flute = 0.16 * envelope(t % 4.6, 4.6, 0.55, 1.4)
      * Math.sin(Math.PI * 2 * (392 + Math.sin(t * 2.1) * 4) * t)
    let strings = 0
    for (let index = 0; index < 12; index += 1) {
      strings += pluck(t, notes[index % notes.length], index * 0.82 + 0.18, 0.12, 2.4)
    }
    return (wind + drone + flute + strings) * envelope(t, duration, 1.1, 1.5)
  })
}

const renders = {
  'Assets/Audio/Bgm/mist-bamboo': renderBgm,
  'Assets/Audio/Cues/hand-seal': () => synth(0.46, (t, duration) => {
    const pulse = Math.sin(Math.PI * 2 * 540 * t) * 0.25 + Math.sin(Math.PI * 2 * 810 * t) * 0.16
    return (pulse + sweep(t, 220, 680, duration, 0.32)) * envelope(t, duration, 0.018, 0.18)
  }),
  'Assets/Audio/Cues/sword-launch': () => synth(0.52, (t, duration) => {
    const blade = sweep(t, 780, 1760, duration, 0.45)
    const air = Math.sin(Math.PI * 2 * (980 + 220 * Math.sin(t * 38)) * t) * 0.16
    return (blade + air) * envelope(t, duration, 0.006, 0.2)
  }),
  'Assets/Audio/Cues/sword-return': () => synth(0.42, (t, duration) => {
    const blade = sweep(t, 1220, 560, duration, 0.34)
    const tail = Math.sin(Math.PI * 2 * 440 * t) * 0.13
    return (blade + tail) * envelope(t, duration, 0.01, 0.16)
  }),
  'Assets/Audio/Cues/light-hit': () => synth(0.28, (t, duration) => {
    const snap = Math.sin(Math.PI * 2 * 1380 * t) * Math.exp(-t * 18) * 0.55
    const body = Math.sin(Math.PI * 2 * 190 * t) * Math.exp(-t * 8) * 0.24
    return (snap + body) * envelope(t, duration, 0.004, 0.1)
  }),
  'Assets/Audio/Cues/boss-break': () => synth(0.92, (t, duration) => {
    const low = Math.sin(Math.PI * 2 * 82 * t) * Math.exp(-t * 1.9) * 0.42
    const crack = Math.sin(Math.PI * 2 * (320 + 90 * Math.sin(t * 26)) * t) * Math.exp(-t * 4.2) * 0.25
    const shimmer = sweep(t, 540, 1280, duration, 0.18)
    return (low + crack + shimmer) * envelope(t, duration, 0.012, 0.28)
  }),
  'Assets/Audio/Cues/pursuit-warning': () => synth(0.86, (t, duration) => {
    const bell = Math.sin(Math.PI * 2 * 118 * t) * Math.exp(-t * 2.3) * 0.38
    const bamboo = Math.sin(Math.PI * 2 * 690 * t) * Math.exp(-t * 13) * 0.24
    const wind = sweep(t, 180, 520, duration, 0.2)
    return (bell + bamboo + wind) * envelope(t, duration, 0.008, 0.24)
  }),
  'Assets/Audio/Cues/extraction-start': () => synth(0.68, (t, duration) => {
    const pulse = Math.sin(Math.PI * 2 * 294 * t) * (0.16 + 0.1 * Math.sin(Math.PI * 2 * 5 * t))
    const chime = sweep(t, 440, 880, duration, 0.28)
    return (pulse + chime) * envelope(t, duration, 0.02, 0.2)
  }),
  'Assets/Audio/Cues/extraction-complete': () => synth(1.08, (t, duration) => {
    const notes = [392, 493.88, 587.33]
    const chord = notes.reduce((sum, note, index) => sum + pluck(t, note, index * 0.08, 0.2, 2.5), 0)
    const lift = sweep(t, 660, 1320, duration, 0.18)
    return (chord + lift) * envelope(t, duration, 0.012, 0.34)
  }),
}

for (const [resource, render] of Object.entries(renders)) {
  const wavPath = resolve(root, 'assets/resources', `${resource}.wav`)
  writeWav(wavPath, render())
  writeAudioMeta(wavPath, metaByResource[resource])
}

for (const path of [
  resolve(root, 'assets/Data/audio-catalog.json'),
  resolve(root, 'assets/resources/Data/audio-catalog.json'),
]) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`)
}
writeJsonMeta(resolve(root, 'assets/Data/audio-catalog.json'), '69fa7337-306c-4ab3-933d-51cbbfefc3c3')
writeJsonMeta(resolve(root, 'assets/resources/Data/audio-catalog.json'), '4c264310-4de3-4fbd-84c8-bda41ee3b1c4')
