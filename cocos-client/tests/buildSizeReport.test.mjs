import test from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { isCompressibleText, reportBuildSize } from '../tools/report-web-build-size.mjs'

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const reportScript = resolve(clientRoot, 'tools/report-web-build-size.mjs')

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'cocos-build-size-'))
  const files = new Map([
    ['assets/config.json', Buffer.from('{"level":1,"name":"void-trial"}\n'.repeat(4))],
    ['assets/hero.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array(60).fill(0x7f)])],
    ['main.js', Buffer.from('export const stage = "void";\n'.repeat(8))],
    ['nested/notes.txt', Buffer.from('build-note\n'.repeat(3))],
    ['nested/raw.dat', Buffer.from(Array(64).fill(0x42))],
  ])

  for (const [path, contents] of files) {
    const absolutePath = join(root, path)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, contents)
  }

  return { root, files }
}

function snapshot(root) {
  const entries = []

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) {
        visit(absolutePath)
      } else {
        const stats = statSync(absolutePath)
        entries.push({
          path: relative(root, absolutePath).replaceAll('\\', '/'),
          contents: readFileSync(absolutePath).toString('hex'),
          mtimeMs: stats.mtimeMs,
          mode: stats.mode,
        })
      }
    }
  }

  visit(root)
  return entries.sort((left, right) => left.path.localeCompare(right.path))
}

test('reports recursive build totals, image bytes, text bytes, and gzip estimates without modifying files', (t) => {
  const { root, files } = createFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const before = snapshot(root)

  const report = reportBuildSize(root)
  const textPaths = ['assets/config.json', 'main.js', 'nested/notes.txt']

  assert.equal(report.fileCount, files.size)
  assert.equal(report.totalBytes, [...files.values()].reduce((total, contents) => total + contents.length, 0))
  assert.equal(report.imageBytes, files.get('assets/hero.png').length)
  assert.equal(report.textBytes, textPaths.reduce((total, path) => total + files.get(path).length, 0))
  assert.equal(
    report.estimatedGzipTextBytes,
    textPaths.reduce((total, path) => total + gzipSync(files.get(path)).length, 0),
  )
  assert.deepEqual(snapshot(root), before)
})

test('recognizes only build formats eligible for gzip estimation', () => {
  for (const path of ['app.js', 'data.JSON', 'style.css', 'icon.svg', 'readme.txt', 'layout.xml', 'game.wasm']) {
    assert.equal(isCompressibleText(path), true, path)
  }
  for (const path of ['hero.png', 'sound.mp3', 'raw.dat', 'archive.gz']) {
    assert.equal(isCompressibleText(path), false, path)
  }
})

test('sorts largest files by bytes then relative path and honors largestCount', (t) => {
  const { root } = createFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const report = reportBuildSize(root, { largestCount: 3 })

  assert.deepEqual(report.largestFiles, [
    { path: 'main.js', bytes: 232 },
    { path: 'assets/config.json', bytes: 128 },
    { path: 'assets/hero.png', bytes: 64 },
  ])
})

test('CLI exits with an absolute error when the build root is missing', () => {
  const missingRoot = resolve(tmpdir(), `missing-cocos-build-${process.pid}-${Date.now()}`)
  const result = spawnSync(process.execPath, [reportScript, missingRoot], { encoding: 'utf8' })

  assert.equal(result.status, 1)
  assert.match(result.stderr, new RegExp(`Build root not found: ${missingRoot.replaceAll('\\', '\\\\')}`))
  assert.equal(result.stdout, '')
})

test('package exposes the repeatable web build size command', () => {
  const packageJson = JSON.parse(readFileSync(resolve(clientRoot, 'package.json'), 'utf8'))

  assert.equal(packageJson.scripts['report:size'], 'node tools/report-web-build-size.mjs build/web-mobile')
})
