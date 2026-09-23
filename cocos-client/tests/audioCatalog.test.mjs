import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve('assets/Data/audio-catalog.json')
const resourcePath = resolve('assets/resources/Data/audio-catalog.json')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function wavInfo(path) {
  const buffer = readFileSync(path)
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF')
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE')
  assert.equal(buffer.toString('ascii', 12, 16), 'fmt ')
  const channels = buffer.readUInt16LE(22)
  const sampleRate = buffer.readUInt32LE(24)
  const bitsPerSample = buffer.readUInt16LE(34)
  const dataOffset = buffer.indexOf(Buffer.from('data'))
  assert.notEqual(dataOffset, -1)
  const dataBytes = buffer.readUInt32LE(dataOffset + 4)
  return {
    channels,
    sampleRate,
    bitsPerSample,
    durationSeconds: dataBytes / (sampleRate * channels * (bitsPerSample / 8)),
  }
}

function audioAsset(entry) {
  const wavPath = resolve('assets/resources', `${entry.resource}.wav`)
  if (existsSync(wavPath)) return { path: wavPath, format: 'wav' }
  const mp3Path = resolve('assets/resources', `${entry.resource}.mp3`)
  if (existsSync(mp3Path)) return { path: mp3Path, format: 'mp3' }
  return null
}

test('source and resource audio catalogs stay identical', () => {
  assert.equal(existsSync(sourcePath), true)
  assert.equal(existsSync(resourcePath), true)
  assert.deepEqual(readJson(resourcePath), readJson(sourcePath))
})

test('cultivation audio catalog covers bgm and combat feedback cues', () => {
  const catalog = readJson(sourcePath)

  assert.deepEqual(Object.keys(catalog.bgm).sort(), ['mist-bamboo'])
  for (const key of ['hand-seal', 'sword-launch', 'sword-return', 'light-hit', 'boss-break']) {
    assert.ok(catalog.cues[key], `missing cue ${key}`)
  }

  for (const entry of [...Object.values(catalog.bgm), ...Object.values(catalog.cues)]) {
    assert.equal(typeof entry.title, 'string')
    assert.equal(entry.title.length > 1, true)
    assert.equal(typeof entry.description, 'string')
    assert.equal(entry.description.includes('修仙') || entry.description.includes('飞剑') || entry.description.includes('法诀'), true)
    assert.match(entry.resource, /^Assets\/Audio\/.+$/)
    const asset = audioAsset(entry)
    assert.ok(asset, `${entry.resource} should exist as a supported audio asset`)
    assert.equal(existsSync(`${asset.path}.meta`), true, `${asset.path}.meta should exist`)
    if (asset.format === 'wav') {
      const info = wavInfo(asset.path)
      assert.equal(info.channels, 1)
      assert.equal(info.sampleRate, 44100)
      assert.equal(info.bitsPerSample, 16)
      assert.ok(info.durationSeconds >= entry.minDurationSeconds, `${entry.resource} should meet min duration`)
    } else {
      const buffer = readFileSync(asset.path)
      const hasId3 = buffer.toString('ascii', 0, 3) === 'ID3'
      const hasFrameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0
      assert.equal(hasId3 || hasFrameSync, true, `${entry.resource} should be a valid MP3 stream`)
      assert.ok(entry.durationSeconds >= entry.minDurationSeconds, `${entry.resource} should meet min duration`)
    }
  }
})
