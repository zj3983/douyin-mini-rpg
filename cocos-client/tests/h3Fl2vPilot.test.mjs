import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const clientPath = resolve(projectRoot, 'tools/generate-h3-action-videos.py')
const pilotPath = resolve(projectRoot, 'art-source/h3-pilot/pilot.json')
const pythonCommand = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')

function projectRelative(path) {
  return relative(projectRoot, path).split(sep).join('/')
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function makeFixture(t, bridgeUrl, { model = 'minimax-h3-fl2v-local', jobs } = {}) {
  const root = mkdtempSync(resolve(projectRoot, '.h3-fl2v-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const promptPath = resolve(root, 'prompt.txt')
  const referencePath = resolve(root, 'reference.png')
  const manifestPath = resolve(root, 'pilot.json')
  const runRoot = resolve(root, 'run')
  writeFileSync(promptPath, 'first prompt bytes\n', 'utf8')
  writeFileSync(referencePath, Buffer.from('fake png reference bytes'))
  const manifest = {
    version: 1,
    bridgeUrl,
    model,
    width: 768,
    height: 1344,
    duration: 5,
    fps: 24,
    jobs: jobs ?? [
      {
        id: 'first-frame-job',
        actor: 'qinglan',
        action: 'hurt',
        conditioning: 'first-frame',
        reference: projectRelative(referencePath),
        prompt: projectRelative(promptPath),
        seed: 42,
        video: 'qinglan/hurt.mp4',
        outputs: [{ action: 'hurt', samples: [0.2] }],
      },
    ],
  }
  writeJson(manifestPath, manifest)
  return { manifest, manifestPath, promptPath, referencePath, root, runRoot }
}

function runClient(fixture, extra = []) {
  const args = [
    clientPath,
    '--manifest', projectRelative(fixture.manifestPath),
    '--run-root', projectRelative(fixture.runRoot),
    '--poll-seconds', '0.01',
    '--timeout-seconds', '2',
    ...extra,
  ]
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonCommand, args, {
      cwd: dirname(projectRoot),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      windowsHide: true,
    })
    const stdout = []
    const stderr = []
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('H3 FL2V test client timed out'))
    }, 20_000)
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      resolvePromise({
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      })
    })
  })
}

function sendJson(response, value) {
  const body = Buffer.from(JSON.stringify(value))
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': body.length,
  })
  response.end(body)
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function startBridge(t, { onPost } = {}) {
  const state = { downloads: 0, health: 0, polls: 0, posts: [] }
  let baseUrl = ''
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, baseUrl)
    if (request.method === 'GET' && url.pathname === '/health') {
      state.health += 1
      sendJson(response, { status: 'ready', version: 'fl2v-test' })
      return
    }
    if (request.method === 'POST' && url.pathname === '/v1/video/generations') {
      const payload = JSON.parse(await readBody(request))
      state.posts.push(payload)
      onPost?.(payload)
      sendJson(response, { task_id: `task-${state.posts.length}` })
      return
    }
    if (request.method === 'GET' && url.pathname.startsWith('/v1/video/generations/')) {
      state.polls += 1
      sendJson(response, {
        status: 'completed',
        url: `${baseUrl}/files/result.mp4`,
        metadata: { source: 'test' },
      })
      return
    }
    if (request.method === 'GET' && url.pathname === '/files/result.mp4') {
      state.downloads += 1
      const body = Buffer.from('fake mp4')
      response.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': body.length,
      })
      response.end(body)
      return
    }
    response.writeHead(404)
    response.end()
  })
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  baseUrl = `http://127.0.0.1:${address.port}`
  t.after(() => new Promise((resolvePromise) => server.close(resolvePromise)))
  return { baseUrl, state }
}

function readFingerprint(fixture) {
  const state = JSON.parse(readFileSync(resolve(fixture.runRoot, 'jobs.json'), 'utf8'))
  assert.equal(state.jobs.length, 1)
  assert.match(state.jobs[0].requestFingerprint, /^[a-f0-9]{64}$/)
  return state.jobs[0].requestFingerprint
}

async function generateFingerprint(t, mutate = () => {}) {
  const bridge = await startBridge(t)
  const fixture = makeFixture(t, bridge.baseUrl)
  mutate(fixture)
  writeJson(fixture.manifestPath, fixture.manifest)
  const result = await runClient(fixture)
  assert.equal(result.code, 0, result.stderr)
  return readFingerprint(fixture)
}

test('FL2V submits exact first-frame and first-last payloads', async (t) => {
  let statePath
  const bridge = await startBridge(t, {
    onPost() {
      const state = JSON.parse(readFileSync(statePath, 'utf8'))
      assert.match(state.jobs.at(-1).requestFingerprint, /^[a-f0-9]{64}$/)
    },
  })
  const fixture = makeFixture(t, bridge.baseUrl)
  statePath = resolve(fixture.runRoot, 'jobs.json')
  const reference = projectRelative(fixture.referencePath)
  const prompt = projectRelative(fixture.promptPath)
  fixture.manifest.jobs = [
    { ...fixture.manifest.jobs[0], id: 'first-frame-job', conditioning: 'first-frame' },
    {
      ...fixture.manifest.jobs[0],
      id: 'first-last-job',
      action: 'idle',
      conditioning: 'first-last',
      seed: 43,
      video: 'qinglan/idle.mp4',
      reference,
      prompt,
    },
  ]
  writeJson(fixture.manifestPath, fixture.manifest)

  const result = await runClient(fixture)
  assert.equal(result.code, 0, result.stderr)
  assert.equal(bridge.state.posts.length, 2)
  const dataUrl = `data:image/png;base64,${readFileSync(fixture.referencePath).toString('base64')}`
  const common = {
    model: 'minimax-h3-fl2v-local',
    prompt: readFileSync(fixture.promptPath, 'utf8'),
    width: 768,
    height: 1344,
    duration: 5,
    n: 1,
  }
  assert.deepEqual(bridge.state.posts[0], { ...common, seed: 42, image: dataUrl })
  assert.deepEqual(bridge.state.posts[1], {
    ...common,
    seed: 43,
    image: dataUrl,
    last_image: dataUrl,
  })
  for (const payload of bridge.state.posts) {
    assert.equal(Object.hasOwn(payload, 'reference_images'), false)
  }
})

test('Ref2V reference conditioning remains compatible', async (t) => {
  const bridge = await startBridge(t)
  const fixture = makeFixture(t, bridge.baseUrl, { model: 'minimax-h3-ref2v-local' })
  fixture.manifest.jobs[0].conditioning = 'reference'
  writeJson(fixture.manifestPath, fixture.manifest)
  const result = await runClient(fixture)
  assert.equal(result.code, 0, result.stderr)
  assert.equal(bridge.state.posts.length, 1)
  assert.deepEqual(Object.keys(bridge.state.posts[0]).sort(), [
    'duration', 'height', 'model', 'n', 'prompt', 'reference_images', 'seed', 'width',
  ])
  assert.equal(bridge.state.posts[0].reference_images.length, 1)
  assert.equal(Object.hasOwn(bridge.state.posts[0], 'image'), false)
  assert.equal(Object.hasOwn(bridge.state.posts[0], 'last_image'), false)
})

test('rejects invalid model and conditioning combinations before submission', async (t) => {
  const combinations = [
    ['minimax-h3-fl2v-local', 'reference'],
    ['minimax-h3-ref2v-local', 'first-frame'],
    ['minimax-h3-ref2v-local', 'first-last'],
    ['unknown-h3-model', 'first-frame'],
  ]
  for (const [model, conditioning] of combinations) {
    await t.test(`${model} with ${conditioning}`, async (t) => {
      const bridge = await startBridge(t)
      const fixture = makeFixture(t, bridge.baseUrl, { model })
      fixture.manifest.jobs[0].conditioning = conditioning
      writeJson(fixture.manifestPath, fixture.manifest)
      const result = await runClient(fixture)
      assert.notEqual(result.code, 0)
      assert.match(result.stderr, /model|conditioning/i)
      assert.equal(bridge.state.posts.length, 0)
      assert.equal(bridge.state.polls, 0)
      assert.equal(bridge.state.downloads, 0)
    })
  }
})

test('request fingerprint is stable and covers generation-significant input', async (t) => {
  const base = await generateFingerprint(t)
  const same = await generateFingerprint(t)
  assert.equal(base, same)

  const changed = {
    prompt: await generateFingerprint(t, ({ promptPath }) => writeFileSync(promptPath, 'changed prompt\n')),
    reference: await generateFingerprint(t, ({ referencePath }) => writeFileSync(referencePath, 'changed png bytes')),
    model: await generateFingerprint(t, ({ manifest }) => {
      manifest.model = 'minimax-h3-ref2v-local'
      manifest.jobs[0].conditioning = 'reference'
    }),
    conditioning: await generateFingerprint(t, ({ manifest }) => {
      manifest.jobs[0].conditioning = 'first-last'
    }),
    seed: await generateFingerprint(t, ({ manifest }) => { manifest.jobs[0].seed += 1 }),
    dimensions: await generateFingerprint(t, ({ manifest }) => { manifest.width += 1 }),
  }
  for (const [field, fingerprint] of Object.entries(changed)) {
    assert.notEqual(fingerprint, base, `${field} changes the request fingerprint`)
  }
})

test('stale resumed task fails closed before poll, download, or submit', async (t) => {
  const bridge = await startBridge(t)
  const fixture = makeFixture(t, bridge.baseUrl)
  const first = await runClient(fixture)
  assert.equal(first.code, 0, first.stderr)
  const counts = {
    downloads: bridge.state.downloads,
    polls: bridge.state.polls,
    posts: bridge.state.posts.length,
  }
  writeFileSync(fixture.promptPath, 'stale changed prompt bytes\n', 'utf8')

  const stale = await runClient(fixture)
  assert.notEqual(stale.code, 0)
  assert.match(stale.stderr, /stale task|fingerprint|generation request changed/i)
  assert.equal(bridge.state.posts.length, counts.posts)
  assert.equal(bridge.state.polls, counts.polls)
  assert.equal(bridge.state.downloads, counts.downloads)
  assert.doesNotMatch(`${stale.stdout}\n${stale.stderr}`, new RegExp(fixture.root.replaceAll('\\', '\\\\'), 'i'))
})

test('dry-run validates FL2V jobs without a generation POST', async (t) => {
  const bridge = await startBridge(t)
  const fixture = makeFixture(t, bridge.baseUrl)
  const result = await runClient(fixture, ['--dry-run'])
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /selected jobs=1 submissions=0 dry-run=true/i)
  assert.equal(bridge.state.posts.length, 0)
  assert.equal(bridge.state.polls, 0)
  assert.equal(bridge.state.downloads, 0)
})

test('rejects unsafe prompt and reference paths', async (t) => {
  for (const field of ['prompt', 'reference']) {
    await t.test(field, async (t) => {
      const bridge = await startBridge(t)
      const fixture = makeFixture(t, bridge.baseUrl)
      fixture.manifest.jobs[0][field] = '../outside.png'
      writeJson(fixture.manifestPath, fixture.manifest)
      const result = await runClient(fixture)
      assert.notEqual(result.code, 0)
      assert.match(result.stderr, /path|inside|parent|reference|prompt/i)
      assert.equal(bridge.state.posts.length, 0)
    })
  }
})

test('pilot manifest and prompts lock FL2V conditioning and actor identity', () => {
  const pilot = JSON.parse(readFileSync(pilotPath, 'utf8'))
  assert.equal(pilot.model, 'minimax-h3-fl2v-local')
  const firstLast = new Set([
    'qinglan-idle',
    'qinglan-sword-ride',
    'moss-wolf-idle',
    'moss-wolf-run',
  ])
  assert.equal(pilot.jobs.length, 9)
  for (const job of pilot.jobs) {
    assert.equal(job.conditioning, firstLast.has(job.id) ? 'first-last' : 'first-frame')
    assert.equal(
      job.reference,
      job.actor === 'qinglan'
        ? 'art-source/h3-pilot/references/qinglan-h3.png'
        : 'art-source/h3-pilot/references/moss-wolf-h3.png',
    )
    const prompt = readFileSync(resolve(projectRoot, job.prompt), 'utf8')
    assert.match(prompt, /exact supplied first frame|exact first-frame/i)
    if (job.actor === 'qinglan') {
      assert.match(prompt, /adult Chinese MAN/)
      assert.match(prompt, /masculine face and (?:masculine )?body/i)
      assert.match(prompt, /same gender/i)
      assert.match(prompt, /never feminize|never change (?:the )?gender/i)
      assert.match(prompt, /exact first-frame face and costume/i)
    } else {
      assert.match(prompt, /same species/i)
      assert.match(prompt, /same .*silhouette/i)
      assert.match(prompt, /four complete legs/i)
      assert.match(prompt, /no extra or missing (?:legs|limbs)/i)
    }
    if (firstLast.has(job.id)) {
      assert.match(prompt, /return(?:s)? to the exact supplied final pose/i)
      assert.match(prompt, /natural motion/i)
    }
  }
})
