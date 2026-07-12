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
  symlinkSync,
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
    ['nested/a-equal.bin', Buffer.alloc(65, 0x61)],
    ['nested/notes.txt', Buffer.from('build-note\n'.repeat(3))],
    ['nested/raw.dat', Buffer.from(Array(64).fill(0x42))],
    ['nested/z-equal.bin', Buffer.alloc(65, 0x7a)],
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

test('sorts largest files by bytes then POSIX relative path and honors largestCount', (t) => {
  const { root } = createFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const report = reportBuildSize(root, { largestCount: 5 })

  assert.deepEqual(report.largestFiles, [
    { path: 'main.js', bytes: 232 },
    { path: 'assets/config.json', bytes: 128 },
    { path: 'nested/a-equal.bin', bytes: 65 },
    { path: 'nested/z-equal.bin', bytes: 65 },
    { path: 'assets/hero.png', bytes: 64 },
  ])
})

test('rejects nested directory junctions instead of silently omitting their files', (t) => {
  const { root } = createFixture()
  const targetRoot = mkdtempSync(join(tmpdir(), 'cocos-build-link-target-'))
  writeFileSync(join(targetRoot, 'linked.js'), 'export const linked = true\n')
  t.after(() => rmSync(root, { recursive: true, force: true }))
  t.after(() => rmSync(targetRoot, { recursive: true, force: true }))

  try {
    symlinkSync(targetRoot, join(root, 'linked-assets'), 'junction')
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('junction creation is not permitted in this environment')
      return
    }
    throw error
  }

  assert.throws(() => reportBuildSize(root), /Symbolic link not allowed: linked-assets/)

  const result = spawnSync(process.execPath, [reportScript, root], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Symbolic link not allowed: linked-assets/)
  assert.equal(result.stdout, '')
})

test('CLI exits with an absolute error when the build root is missing', () => {
  const missingRoot = resolve(tmpdir(), `missing-cocos-build-${process.pid}-${Date.now()}`)
  const result = spawnSync(process.execPath, [reportScript, missingRoot], { encoding: 'utf8' })

  assert.equal(result.status, 1)
  assert.match(result.stderr, new RegExp(`Build root not found: ${missingRoot.replaceAll('\\', '\\\\')}`))
  assert.equal(result.stdout, '')
})

test('CLI prints usage and exits 2 when the build root argument is omitted', () => {
  const result = spawnSync(process.execPath, [reportScript], { encoding: 'utf8', cwd: clientRoot })

  assert.equal(result.status, 2)
  assert.equal(result.stderr, 'Usage: node tools/report-web-build-size.mjs <build-root>\n')
  assert.equal(result.stdout, '')
})

test('CLI still runs when launched through a junction script path', (t) => {
  const { root, files } = createFixture()
  const linkRoot = mkdtempSync(join(tmpdir(), 'cocos-build-script-link-'))
  const toolsLink = join(linkRoot, 'linked-tools')
  t.after(() => rmSync(root, { recursive: true, force: true }))
  t.after(() => rmSync(linkRoot, { recursive: true, force: true }))

  try {
    symlinkSync(resolve(clientRoot, 'tools'), toolsLink, 'junction')
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('junction creation is not permitted in this environment')
      return
    }
    throw error
  }

  const linkedScript = join(toolsLink, 'report-web-build-size.mjs')
  const result = spawnSync(process.execPath, [linkedScript, root], { encoding: 'utf8' })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /^\{/)
  assert.equal(JSON.parse(result.stdout).fileCount, files.size)
  assert.equal(result.stderr, '')
})

test('package exposes the repeatable web build size command', () => {
  const packageJson = JSON.parse(readFileSync(resolve(clientRoot, 'package.json'), 'utf8'))

  assert.equal(packageJson.scripts['report:size'], 'node tools/report-web-build-size.mjs build/web-mobile')
})
