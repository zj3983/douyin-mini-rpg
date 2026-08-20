import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const manifestPath = resolve(projectRoot, 'art-source/h3-pilot/pilot.json')
const promptRoot = resolve(projectRoot, 'art-source/h3-pilot/prompts')
const clientPath = resolve(projectRoot, 'tools/generate-h3-action-videos.py')
const pythonCommand = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')

const expectedJobs = [
  {
    id: 'qinglan-idle',
    actor: 'qinglan',
    action: 'idle',
    reference: 'art-source/vertical-slice/qinglan/reference-chroma.png',
    prompt: 'art-source/h3-pilot/prompts/qinglan/idle.txt',
    seed: 3082001,
    video: 'qinglan/idle.mp4',
  },
  {
    id: 'qinglan-sword-ride',
    actor: 'qinglan',
    action: 'sword_ride',
    reference: 'art-source/vertical-slice/qinglan/reference-chroma.png',
    prompt: 'art-source/h3-pilot/prompts/qinglan/sword-ride.txt',
    seed: 3082002,
    video: 'qinglan/sword-ride.mp4',
  },
  {
    id: 'qinglan-hand-seal',
    actor: 'qinglan',
    action: 'hand_seal',
    reference: 'art-source/vertical-slice/qinglan/reference-chroma.png',
    prompt: 'art-source/h3-pilot/prompts/qinglan/hand-seal.txt',
    seed: 3082003,
    video: 'qinglan/hand-seal.mp4',
  },
  {
    id: 'qinglan-hurt',
    actor: 'qinglan',
    action: 'hurt',
    reference: 'art-source/vertical-slice/qinglan/reference-chroma.png',
    prompt: 'art-source/h3-pilot/prompts/qinglan/hurt.txt',
    seed: 3082004,
    video: 'qinglan/hurt.mp4',
  },
  {
    id: 'moss-wolf-idle',
    actor: 'moss-wolf',
    action: 'idle',
    reference: 'art-source/vertical-slice/moss-wolf/reference.png',
    prompt: 'art-source/h3-pilot/prompts/moss-wolf/idle.txt',
    seed: 3082005,
    video: 'moss-wolf/idle.mp4',
  },
  {
    id: 'moss-wolf-run',
    actor: 'moss-wolf',
    action: 'run',
    reference: 'art-source/vertical-slice/moss-wolf/reference.png',
    prompt: 'art-source/h3-pilot/prompts/moss-wolf/run.txt',
    seed: 3082006,
    video: 'moss-wolf/run.mp4',
  },
  {
    id: 'moss-wolf-bite-lunge',
    actor: 'moss-wolf',
    action: 'bite-lunge',
    reference: 'art-source/vertical-slice/moss-wolf/reference.png',
    prompt: 'art-source/h3-pilot/prompts/moss-wolf/bite-lunge.txt',
    seed: 3082007,
    video: 'moss-wolf/bite-lunge.mp4',
  },
  {
    id: 'moss-wolf-hurt',
    actor: 'moss-wolf',
    action: 'hurt',
    reference: 'art-source/vertical-slice/moss-wolf/reference.png',
    prompt: 'art-source/h3-pilot/prompts/moss-wolf/hurt.txt',
    seed: 3082008,
    video: 'moss-wolf/hurt.mp4',
  },
  {
    id: 'moss-wolf-death',
    actor: 'moss-wolf',
    action: 'death',
    reference: 'art-source/vertical-slice/moss-wolf/reference.png',
    prompt: 'art-source/h3-pilot/prompts/moss-wolf/death.txt',
    seed: 3082009,
    video: 'moss-wolf/death.mp4',
  },
]

const expectedOutputs = {
  qinglan: { hand_seal: 10, hurt: 6, idle: 8, sword_ride: 10 },
  'moss-wolf': { attack: 8, death: 8, hurt: 4, idle: 6, move: 8, telegraph: 4 },
}

const h3Sections = [
  'subject_definitions:',
  'summary:',
  'retention_analysis:',
  'detailed_description:',
  'overall_soundscape:',
  'non_diegetic_music:',
]

const commonPromptRequirements = [
  ['five-second continuous shot', /one continuous shot,\s*0\.00-5\.00s/i],
  ['locked side-view camera', /locked side-view camera/i],
  ['camera remains static', /no camera movement/i],
  ['plain background', /plain near-white background/i],
  ['subject stays in frame', /subject remains fully inside frame/i],
  ['scale and facing stay stable', /stable subject scale and facing/i],
  ['no edits or camera motion', /no cuts, zoom, pan, tilt, or shake/i],
  ['no dialogue', /no dialogue/i],
  ['no music', /no music/i],
  ['audio is discarded', /audio (?:is|will be) discarded downstream/i],
  [
    'only the referenced subject appears',
    /only referenced visual subject is <Subject 1>;\s*do not introduce any scenery, additional people, additional monsters, added weapons, or effects that obscure <Subject 1>/i,
  ],
  ['no scenery is introduced', /do not introduce any scenery/i],
  ['no people are introduced', /additional people/i],
  ['no monsters are introduced', /additional monsters/i],
  ['no weapons are introduced', /added weapons/i],
  ['no effects obscure the subject', /effects that obscure <Subject 1>/i],
]

const actorPromptRequirements = {
  qinglan: [
    ['costume stays unchanged', /no costume change/i],
    ['face stays unchanged', /no face change/i],
    ['hand count stays stable', /no extra or missing hands/i],
    ['limb count cannot grow', /no extra limbs/i],
    ['limb count cannot shrink', /no missing limbs/i],
    ['sword count stays stable', /no extra swords/i],
    ['flying sword stays present', /flying sword is never removed/i],
    ['walking is forbidden', /no walking/i],
    ['running is forbidden', /no running/i],
    ['body lunges are forbidden', /no body lunge/i],
  ],
  'moss-wolf': [
    ['leg count is explicit', /exactly four legs/i],
    ['species silhouette is retained', /species silhouette/i],
    ['markings are retained', /markings/i],
    ['head is retained', /head shape/i],
    ['tail is retained', /tail shape/i],
    ['limbs stay attached', /no detached limbs/i],
    ['motion stays quadrupedal', /no bipedal motion/i],
    ['facing never reverses', /no direction reversal/i],
    ['leg count cannot drift', /no extra or missing legs/i],
    ['the wolf cannot exit frame', /no frame exit/i],
  ],
}

const actionPromptRequirements = {
  'qinglan-idle': [
    ['stable sword stance', /stable standing stance with both feet planted on the flying sword/i],
    ['breathing', /subtle breathing/i],
    ['hair and robe breeze motion', /long hair and robe hem move gently in a light breeze/i],
    ['loopable endpoints', /opening and ending poses? (?:nearly|closely) match/i],
    ['no forward travel', /no forward travel/i],
  ],
  'qinglan-sword-ride': [
    ['feet stay on sword', /feet stay planted on the flying sword throughout/i],
    ['balance motion', /subtle balance compensation/i],
    ['hair and robe trail backward', /long hair and robe fabric trail backward/i],
    ['no screen displacement', /<Subject 1> remains centered without screen-space displacement/i],
    ['no stepping', /no stepping/i],
  ],
  'qinglan-hand-seal': [
    ['hands rise', /both hands rise/i],
    ['readable seal', /fingers form a readable cultivation hand seal/i],
    ['seal holds', /holds? the seal steadily/i],
    ['arms recover', /arms (?:retract|return)/i],
    ['feet stay on sword', /feet never leave the flying sword/i],
    ['no forward drive', /no forward drive/i],
  ],
  'qinglan-hurt': [
    ['single backward recoil', /single upper-body recoil backward/i],
    ['secondary hair and sleeve motion', /sleeves and long hair follow through/i],
    ['balance recovery', /recovers? balance/i],
    ['no fall', /does not fall to the ground/i],
    ['no dash', /no dash/i],
  ],
  'moss-wolf-idle': [
    ['breathing', /subtle breathing/i],
    ['ear reaction', /ears react/i],
    ['tail balance', /tail counterbalances/i],
    ['paws stay grounded', /all four paws remain planted/i],
    ['loopable endpoints', /opening and ending poses? (?:nearly|closely) match/i],
  ],
  'moss-wolf-run': [
    ['full quadrupedal gait', /complete quadrupedal run cycle/i],
    ['coordinated leg phases', /foreleg and hind-leg phases remain coordinated/i],
    ['body stays centered', /<Subject 1> stays centered/i],
  ],
  'moss-wolf-bite-lunge': [
    ['crouched anticipation', /crouches? in anticipation/i],
    ['hind-leg push', /hind legs push off/i],
    ['forepaw reach', /forepaws reach forward/i],
    ['visible bite', /mouth opens, closes in a bite/i],
    ['recoil and recovery', /recoils? and recovers?/i],
    ['stays in frame', /does not leave the frame/i],
  ],
  'moss-wolf-hurt': [
    ['single lateral recoil', /single lateral recoil/i],
    ['paw bracing', /paws brace/i],
    ['stance recovery', /recovers? (?:the )?stance/i],
  ],
  'moss-wolf-death': [
    ['balance loss', /loses? balance/i],
    ['controlled fall', /controlled collapse/i],
    ['still final pose', /final still silhouette/i],
    ['body remains present', /body remains visible/i],
    ['body does not vanish', /does not disappear/i],
  ],
}

function resolveInside(root, candidate, label) {
  assert.equal(typeof candidate, 'string', `${label} is a string`)
  assert.ok(candidate.length > 0, `${label} is not empty`)
  assert.equal(isAbsolute(candidate), false, `${label} is relative`)

  const resolved = resolve(root, candidate)
  const fromRoot = relative(root, resolved)
  assert.ok(
    fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot),
    `${label} stays inside ${root}`,
  )
  return resolved
}

function resolveVideoInsideActor(root, actor, candidate, label) {
  assert.equal(typeof candidate, 'string', `${label} is a string`)
  const normalizedCandidate = candidate.replaceAll('\\', '/')
  const resolved = resolveInside(root, normalizedCandidate, label)
  assert.equal(dirname(resolved), resolve(root, actor), `${label} stays inside ${actor} actor directory`)
  assert.equal(resolved.endsWith('.mp4'), true, `${label} is an MP4 path`)
  return resolved
}

function sortedRecord(entries) {
  return Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)))
}

function assertSectionsInOrder(prompt, label) {
  const sectionLines = prompt.match(/^[a-z_]+:$/gm) ?? []
  assert.deepEqual(sectionLines, h3Sections, `${label} has the six Ref2V sections once and in order`)

  for (const section of h3Sections) {
    assert.equal(prompt.split(section).length - 1, 1, `${label} contains ${section} exactly once`)
  }
}

function getPromptSection(prompt, section) {
  const index = h3Sections.indexOf(section)
  const start = prompt.indexOf(section) + section.length
  const next = h3Sections[index + 1]
  const end = next === undefined ? prompt.length : prompt.indexOf(next)
  return prompt.slice(start, end).trim()
}

function assertPromptRequirements(prompt, requirements, label) {
  for (const [requirement, pattern] of requirements) {
    assert.match(prompt, pattern, `${label}: ${requirement}`)
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assertNoAffirmativeInPlaceMovement(prompt, label) {
  const subject = String.raw`(?:<Subject 1>|The subject)`
  const negationOrFuture = String.raw`(?:(does not|do not|will not|never|cannot|can't)\s+|will\s+)?`
  const pathVerb = String.raw`(?:travels?|traveled|travelled|traveling|moves?|moved|moving|slides?|slid|sliding|walks?|walked|walking|runs?|ran|running)`
  const boundaryVerb = String.raw`(?:exits?|exited|exiting|leaves?|left|leaving|crosses?|crossed|crossing)`
  const destination = String.raw`(?:screen|frame|image)`
  const movementPatterns = [
    new RegExp(
      `${subject}\\s+${negationOrFuture}${pathVerb}\\b[^.!?\\r\\n]*?\\b(?:across|through|out\\s+of|outside)\\s+(?:the\\s+)?${destination}\\b`,
      'gi',
    ),
    new RegExp(
      `${subject}\\s+${negationOrFuture}${boundaryVerb}\\b[^.!?\\r\\n]*?(?:the\\s+)?${destination}\\b`,
      'gi',
    ),
  ]
  const affirmativeMovements = movementPatterns.flatMap((pattern) =>
    [...prompt.matchAll(pattern)]
      .filter((match) => match[1] === undefined)
      .map(([movement]) => movement),
  )

  assert.deepEqual(
    affirmativeMovements,
    [],
    `${label} has no affirmative travel, screen-crossing, or frame-exit motion`,
  )
}

function projectRelativePath(path) {
  return relative(projectRoot, path).split(sep).join('/')
}

function createClientFixture(t, bridgeUrl, mutateManifest = () => {}) {
  const fixtureRoot = mkdtempSync(resolve(projectRoot, '.h3-action-client-test-'))
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }))

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.bridgeUrl = bridgeUrl
  mutateManifest(manifest)

  const fixtureManifestPath = resolve(fixtureRoot, 'pilot.json')
  const runRoot = resolve(fixtureRoot, 'run')
  writeFileSync(fixtureManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  return {
    manifest,
    manifestArg: projectRelativePath(fixtureManifestPath),
    runRoot,
    runRootArg: projectRelativePath(runRoot),
  }
}

function sendJson(response, statusCode, value) {
  const body = Buffer.from(JSON.stringify(value))
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': body.length,
  })
  response.end(body)
}

async function readRequestBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function startFakeBridge(t, options = {}) {
  const state = {
    downloads: [],
    events: [],
    healthRequests: 0,
    posts: [],
    statusAttempts: new Map(),
    statusRequests: [],
  }
  let baseUrl = ''

  const server = createServer((request, response) => {
    const handleRequest = async () => {
      const requestUrl = new URL(request.url, baseUrl)
      const path = requestUrl.pathname

      if (request.method === 'GET' && path === '/health') {
        state.healthRequests += 1
        state.events.push('health')
        sendJson(response, 200, {
          status: options.healthStatus ?? 'ready',
          version: 'fake-h3-bridge/1',
        })
        return
      }

      if (request.method === 'POST' && path === '/v1/video/generations') {
        const body = await readRequestBody(request)
        const payload = JSON.parse(body)
        state.posts.push(payload)
        const taskId = options.taskIdForPost?.(state.posts.length, payload) ?? `task-${state.posts.length}`
        state.events.push(`post:${taskId}`)
        sendJson(response, 200, { task_id: taskId })
        return
      }

      const statusPrefix = '/v1/video/generations/'
      if (request.method === 'GET' && path.startsWith(statusPrefix)) {
        const taskId = decodeURIComponent(path.slice(statusPrefix.length))
        const attempt = state.statusAttempts.get(taskId) ?? 0
        state.statusAttempts.set(taskId, attempt + 1)
        state.statusRequests.push(taskId)
        state.events.push(`status:${taskId}:${attempt}`)

        const status = options.statusFor?.({ attempt, baseUrl, taskId })
          ?? (attempt === 0
            ? { status: 'processing' }
            : {
                status: 'completed',
                url: `${baseUrl}/files/${encodeURIComponent(taskId)}.mp4`,
                metadata: { source: 'fake-bridge' },
              })
        sendJson(response, 200, status)
        return
      }

      const downloadPrefix = '/files/'
      if (request.method === 'GET' && path.startsWith(downloadPrefix)) {
        const taskId = decodeURIComponent(path.slice(downloadPrefix.length, -'.mp4'.length))
        const body = options.videoBytes ?? Buffer.from('fake mp4 bytes')
        state.downloads.push(taskId)
        state.events.push(`download:${taskId}`)
        response.writeHead(200, {
          'Content-Type': options.videoContentType ?? 'video/mp4',
          'Content-Length': body.length,
        })
        response.end(body)
        return
      }

      sendJson(response, 404, { error: 'not found' })
    }

    handleRequest().catch((error) => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: error.message })
      } else {
        response.destroy(error)
      }
    })
  })

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  baseUrl = `http://127.0.0.1:${address.port}`

  t.after(async () => {
    await new Promise((resolvePromise) => server.close(resolvePromise))
  })

  return { baseUrl, state }
}

function runClient(args, { cwd = dirname(projectRoot) } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonCommand, [clientPath, ...args], {
      cwd,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
      windowsHide: true,
    })
    const stdout = []
    const stderr = []
    let settled = false
    const timer = setTimeout(() => {
      child.kill()
      if (!settled) {
        settled = true
        reject(new Error(`H3 client timed out; stdout=${Buffer.concat(stdout)} stderr=${Buffer.concat(stderr)}`))
      }
    }, 20_000)

    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.once('error', (error) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(error)
      }
    })
    child.once('close', (code, signal) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        resolvePromise({
          code,
          signal,
          stderr: Buffer.concat(stderr).toString('utf8'),
          stdout: Buffer.concat(stdout).toString('utf8'),
        })
      }
    })
  })
}

function clientArgs(fixture, jobIds, extra = []) {
  const jobs = jobIds.flatMap((jobId) => ['--job', jobId])
  return [
    '--manifest', fixture.manifestArg,
    '--run-root', fixture.runRootArg,
    ...jobs,
    '--poll-seconds', '0',
    '--timeout-seconds', '2',
    ...extra,
  ]
}

function expectedGenerationPayload(manifest, job) {
  const referenceBytes = readFileSync(resolve(projectRoot, job.reference))
  return {
    model: manifest.model,
    prompt: readFileSync(resolve(projectRoot, job.prompt), 'utf8'),
    width: manifest.width,
    height: manifest.height,
    duration: manifest.duration,
    n: 1,
    seed: job.seed,
    reference_images: [`data:image/png;base64,${referenceBytes.toString('base64')}`],
  }
}

function stateEntry(job, status, taskId, overrides = {}) {
  return {
    id: job.id,
    taskId,
    status,
    seed: job.seed,
    video: `videos/${job.video}`,
    startedAt: '2026-08-20T00:00:00Z',
    completedAt: status === 'completed' ? '2026-08-20T00:01:00Z' : null,
    error: null,
    ...overrides,
  }
}

function writeJobsState(runRoot, entries) {
  mkdirSync(runRoot, { recursive: true })
  writeFileSync(
    resolve(runRoot, 'jobs.json'),
    `${JSON.stringify({ version: 1, jobs: entries }, null, 2)}\n`,
    'utf8',
  )
}

function readJobsState(runRoot) {
  return JSON.parse(readFileSync(resolve(runRoot, 'jobs.json'), 'utf8'))
}

function findPartFiles(root) {
  if (!existsSync(root)) {
    return []
  }

  const matches = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) {
      matches.push(...findPartFiles(path))
    } else if (entry.name.endsWith('.part')) {
      matches.push(path)
    }
  }
  return matches
}

function assertNoPrivatePayload(result, stateText = '') {
  const publicText = `${result.stdout}\n${result.stderr}\n${stateText}`
  assert.equal(publicText.includes('data:image/'), false, 'data URIs never appear in output or state')
  assert.equal(publicText.includes(';base64,'), false, 'base64 payloads never appear in output or state')
}

test('video path validation treats slash and backslash as actor directory separators', () => {
  assert.doesNotThrow(() => resolveVideoInsideActor(projectRoot, 'qinglan', 'qinglan/idle.mp4', 'slash video'))
  assert.doesNotThrow(() => resolveVideoInsideActor(projectRoot, 'qinglan', String.raw`qinglan\idle.mp4`, 'backslash video'))
})

test('video path validation rejects traversal through slash and backslash separators', () => {
  assert.throws(
    () => resolveVideoInsideActor(projectRoot, 'qinglan', 'qinglan/../outside.mp4', 'slash traversal'),
    /actor directory/,
  )
  assert.throws(
    () => resolveVideoInsideActor(projectRoot, 'qinglan', String.raw`qinglan/..\outside.mp4`, 'backslash traversal'),
    /actor directory/,
  )
})

test('in-place movement guard scopes motion and negation to the referenced subject', () => {
  assert.doesNotThrow(() =>
    assertNoAffirmativeInPlaceMovement(
      'The long hair moves backward while the body stays fixed in place.',
      'secondary hair motion',
    ),
  )
  assert.throws(
    () =>
      assertNoAffirmativeInPlaceMovement(
        'With no camera movement, <Subject 1> travels forward across the screen.',
        'camera negation does not excuse subject travel',
      ),
    /affirmative travel/,
  )
  assert.throws(
    () =>
      assertNoAffirmativeInPlaceMovement(
        '<Subject 1> moves through the frame while staying centered.',
        'centered claim does not excuse subject travel',
      ),
    /affirmative travel/,
  )
  assert.doesNotThrow(() =>
    assertNoAffirmativeInPlaceMovement(
      '<Subject 1> does not travel across the screen.',
      'subject travel is explicitly negated',
    ),
  )
})

for (const [label, prompt] of [
  ['direct frame exit', '<Subject 1> exits the frame.'],
  ['direct screen crossing', 'The subject crosses the screen.'],
  ['future screen travel', 'The subject will move across the screen.'],
]) {
  test(`in-place movement guard rejects ${label}`, () => {
    assert.throws(
      () => assertNoAffirmativeInPlaceMovement(prompt, label),
      /affirmative travel/,
    )
  })
}

for (const [label, prompt] of [
  ['negated future screen travel', 'The subject will not move across the screen.'],
  ['never exits frame', 'The subject never exits the frame.'],
]) {
  test(`in-place movement guard allows ${label}`, () => {
    assert.doesNotThrow(() => assertNoAffirmativeInPlaceMovement(prompt, label))
  })
}

test('H3 animation pilot manifest locks reproducible jobs and runtime outputs', () => {
  const pilot = JSON.parse(readFileSync(manifestPath, 'utf8'))

  assert.equal(pilot.version, 1)
  assert.equal(pilot.bridgeUrl, 'http://127.0.0.1:8900')
  assert.equal(pilot.model, 'minimax-h3-ref2v-local')
  assert.deepEqual([pilot.width, pilot.height, pilot.duration, pilot.fps], [768, 1344, 5, 24])
  assert.equal(pilot.jobs.length, 9)

  assert.deepEqual(
    pilot.jobs.map(({ outputs, ...job }) => job),
    expectedJobs,
  )

  assert.equal(new Set(pilot.jobs.map(({ id }) => id)).size, pilot.jobs.length, 'job ids are unique')
  assert.equal(new Set(pilot.jobs.map(({ seed }) => seed)).size, pilot.jobs.length, 'seeds are unique')
  assert.ok(pilot.jobs.every(({ seed }) => Number.isInteger(seed)), 'seeds are fixed integers')
  assert.equal(new Set(pilot.jobs.map(({ video }) => video)).size, pilot.jobs.length, 'video paths are unique')

  const outputsByActor = {}
  for (const job of pilot.jobs) {
    const referencePath = resolveInside(projectRoot, job.reference, `${job.id} reference`)
    assert.ok(existsSync(referencePath), `${job.id} reference exists`)

    const promptPath = resolveInside(projectRoot, job.prompt, `${job.id} prompt`)
    resolveInside(promptRoot, relative(promptRoot, promptPath), `${job.id} prompt relative path`)

    resolveVideoInsideActor(projectRoot, job.actor, job.video, `${job.id} video`)

    assert.ok(Array.isArray(job.outputs) && job.outputs.length > 0, `${job.id} has outputs`)
    outputsByActor[job.actor] ??= {}
    for (const output of job.outputs) {
      assert.equal(outputsByActor[job.actor][output.action], undefined, `${job.actor}/${output.action} is produced once`)
      outputsByActor[job.actor][output.action] = output.samples.length

      assert.ok(output.samples.length > 0, `${job.id}/${output.action} has samples`)
      for (const [index, sample] of output.samples.entries()) {
        assert.ok(Number.isFinite(sample), `${job.id}/${output.action} sample ${index} is finite`)
        assert.ok(sample >= 0 && sample < pilot.duration, `${job.id}/${output.action} sample ${index} is in [0, 5)`)
        if (index > 0) {
          assert.ok(sample > output.samples[index - 1], `${job.id}/${output.action} samples strictly increase`)
        }
      }
    }
  }

  assert.deepEqual(
    sortedRecord(Object.entries(outputsByActor.qinglan)),
    expectedOutputs.qinglan,
  )
  assert.deepEqual(
    sortedRecord(Object.entries(outputsByActor['moss-wolf'])),
    expectedOutputs['moss-wolf'],
  )

  const biteLunge = pilot.jobs.find(({ id }) => id === 'moss-wolf-bite-lunge')
  assert.deepEqual(biteLunge.outputs.map(({ action }) => action), ['telegraph', 'attack'])
  const telegraph = biteLunge.outputs[0].samples
  const attack = biteLunge.outputs[1].samples
  assert.ok(telegraph.at(-1) < attack[0], 'bite-lunge telegraph samples precede attack samples')
})

test('H3 animation pilot prompts are complete Ref2V single-shot action contracts', () => {
  const pilot = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const expectedPromptPaths = expectedJobs.map(({ prompt }) => prompt)
  const manifestPromptPaths = pilot.jobs.map(({ prompt }) => prompt)

  assert.deepEqual(manifestPromptPaths, expectedPromptPaths, 'manifest prompt paths match the nine pilot jobs')
  assert.equal(new Set(manifestPromptPaths).size, expectedPromptPaths.length, 'manifest prompt paths are unique')

  const promptPaths = pilot.jobs.map((job) => ({
    job,
    path: resolveInside(projectRoot, job.prompt, `${job.id} prompt`),
  }))
  const missingPromptPaths = promptPaths
    .filter(({ path }) => !existsSync(path))
    .map(({ job }) => job.prompt)
  assert.deepEqual(missingPromptPaths, [], `missing H3 prompt files:\n${missingPromptPaths.join('\n')}`)

  for (const { job, path } of promptPaths) {
    resolveInside(promptRoot, relative(promptRoot, path), `${job.id} prompt relative path`)
    const prompt = readFileSync(path, 'utf8')

    assert.ok(prompt.trim().length > 0, `${job.id} prompt is not empty`)
    assertSectionsInOrder(prompt, job.id)
    for (const section of h3Sections) {
      assert.ok(getPromptSection(prompt, section).length > 0, `${job.id} ${section} is not empty`)
    }

    const shotLabels = [...prompt.matchAll(/\[Shot\s+\d+\]/gi)].map(([match]) => match.toLowerCase())
    assert.deepEqual(shotLabels, ['[shot 1]'], `${job.id} contains exactly one [Shot 1]`)
    assert.match(prompt, /\[Shot 1\][^\r\n]*0\.00-5\.00s/i, `${job.id} [Shot 1] spans 0.00-5.00s`)

    const subjectDefinitions = getPromptSection(prompt, 'subject_definitions:')
    const retentionAnalysis = getPromptSection(prompt, 'retention_analysis:')
    const definedLabels = new Set(
      [...subjectDefinitions.matchAll(/^<(?:Subject|Picture|Video|Audio)\s+\d+>/gm)].map(([label]) => label),
    )
    const referencedLabels = new Set(
      [...prompt.matchAll(/<(?:Subject|Picture|Video|Audio)\s+\d+>/g)].map(([label]) => label),
    )
    assert.deepEqual([...definedLabels], ['<Subject 1>'], `${job.id} defines only <Subject 1>`)
    assert.deepEqual([...referencedLabels], ['<Subject 1>'], `${job.id} has no unresolved or extra reference labels`)
    assert.match(
      prompt.slice(prompt.indexOf('summary:')),
      /<Subject 1>/,
      `${job.id} uses <Subject 1> after defining it`,
    )
    assert.match(
      retentionAnalysis,
      /<Subject 1>[^\r\n]*fully_preserved[^\r\n]*identity/i,
      `${job.id} marks subject identity fully_preserved`,
    )

    assertPromptRequirements(prompt, commonPromptRequirements, job.id)
    assertPromptRequirements(prompt, actorPromptRequirements[job.actor], job.id)
    assertPromptRequirements(prompt, actionPromptRequirements[job.id], job.id)
  }
})

test('loop and bite prompt phases align with manifest sampling boundaries', () => {
  const pilot = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const loopContracts = [
    { jobId: 'qinglan-idle', outputAction: 'idle', sampledPhase: 'pose' },
    { jobId: 'qinglan-sword-ride', outputAction: 'sword_ride', sampledPhase: 'balance pose' },
    { jobId: 'moss-wolf-idle', outputAction: 'idle', sampledPhase: 'stance' },
    { jobId: 'moss-wolf-run', outputAction: 'move' },
  ]

  for (const { jobId, outputAction, sampledPhase } of loopContracts) {
    const job = pilot.jobs.find(({ id }) => id === jobId)
    assert.ok(job, `${jobId} exists in the manifest`)
    const output = job.outputs.find(({ action }) => action === outputAction)
    assert.ok(output, `${jobId} has ${outputAction} samples`)

    const finalSample = output.samples.at(-1)
    assert.ok(Number.isFinite(finalSample), `${jobId} has a finite final sample`)
    const finalSampleText = finalSample.toFixed(2)
    const escapedFinalSample = escapeRegExp(finalSampleText)
    const prompt = readFileSync(resolveInside(projectRoot, job.prompt, `${jobId} prompt`), 'utf8')

    if (sampledPhase !== undefined) {
      const firstSample = output.samples[0]
      assert.ok(Number.isFinite(firstSample), `${jobId} has a finite first sample`)
      const firstSampleText = firstSample.toFixed(2)
      const escapedFirstSample = escapeRegExp(firstSampleText)
      const escapedSampledPhase = escapeRegExp(sampledPhase)
      assert.match(
        prompt,
        new RegExp(
          `At ${escapedFirstSample}s,[^.!?\\r\\n]*opening sampled ${escapedSampledPhase}[^.!?\\r\\n]*(?:same|matching) sampled ${escapedSampledPhase}[^.!?\\r\\n]*(?:is )?(?:restored|matched) (?:at|by) ${escapedFinalSample}s`,
          'i',
        ),
        `${jobId} binds first sample ${firstSampleText}s to matching final sample ${finalSampleText}s`,
      )
    }

    const restoredOpeningPhase = new RegExp(
      `(?:opening sampled (?:pose|balance pose|stance|gait phase)[^.!?\\r\\n]*(?:is restored|returns?)[^.!?\\r\\n]*${escapedFinalSample}s|${escapedFinalSample}s[^.!?\\r\\n]*(?:is restored|returns?)[^.!?\\r\\n]*opening sampled (?:pose|balance pose|stance|gait phase))`,
      'i',
    )

    assert.match(
      prompt,
      restoredOpeningPhase,
      `${jobId} restores its opening sampled phase by manifest sample ${finalSampleText}s`,
    )
    assert.match(
      prompt,
      new RegExp(`From ${escapedFinalSample}-5\\.00s,[^\\r\\n]*(?:continues?|continuing|next|seamless)`, 'i'),
      `${jobId} continues looping naturally after manifest sample ${finalSampleText}s`,
    )
    assertNoAffirmativeInPlaceMovement(prompt, jobId)
  }

  const biteJob = pilot.jobs.find(({ id }) => id === 'moss-wolf-bite-lunge')
  assert.ok(biteJob, 'moss-wolf-bite-lunge exists in the manifest')
  const telegraph = biteJob.outputs.find(({ action }) => action === 'telegraph')
  const attack = biteJob.outputs.find(({ action }) => action === 'attack')
  assert.ok(telegraph && attack, 'bite-lunge has telegraph and attack samples')

  const telegraphEnd = telegraph.samples.at(-1)
  const attackStart = attack.samples[0]
  const telegraphEndText = telegraphEnd.toFixed(2)
  const attackStartText = attackStart.toFixed(2)
  const bitePrompt = readFileSync(resolveInside(projectRoot, biteJob.prompt, 'moss-wolf-bite-lunge prompt'), 'utf8')

  assert.match(
    bitePrompt,
    new RegExp(`pure anticipation holds through the telegraph end at ${escapeRegExp(telegraphEndText)}s`, 'i'),
    `bite-lunge remains pure anticipation through telegraph sample ${telegraphEndText}s`,
  )
  const pushStartMatch = bitePrompt.match(/At (\d+\.\d{2})s, the hind-leg push begins after the telegraph end/i)
  assert.ok(pushStartMatch, 'bite-lunge declares a two-decimal hind-leg push start after telegraph end')
  const pushStart = Number(pushStartMatch[1])
  assert.ok(pushStart > telegraphEnd, 'bite-lunge push starts after the final telegraph sample')
  assert.ok(pushStart <= attackStart, 'bite-lunge push starts no later than the first attack sample')
  assert.match(
    bitePrompt,
    new RegExp(`By the attack start at ${escapeRegExp(attackStartText)}s,[^.!?\\r\\n]*already[^.!?\\r\\n]*push`, 'i'),
    `bite-lunge is already pushing by attack sample ${attackStartText}s`,
  )
})

test('H3 action client honors the bridge, resume, state, and secrecy contracts', { timeout: 120_000 }, async (t) => {
  await t.test('refuses a non-ready bridge before submitting', async (t) => {
    const bridge = await startFakeBridge(t, { healthStatus: 'starting' })
    const fixture = createClientFixture(t, bridge.baseUrl)
    const result = await runClient(clientArgs(fixture, ['qinglan-idle']))

    assert.notEqual(result.code, 0)
    assert.equal(bridge.state.healthRequests, 1)
    assert.equal(bridge.state.posts.length, 0)
    assertNoPrivatePayload(result)
  })

  await t.test('submits exact Ref2V payloads sequentially and downloads completed MP4s', async (t) => {
    const videoBytes = Buffer.from('sequential fake mp4')
    const bridge = await startFakeBridge(t, { videoBytes })
    const fixture = createClientFixture(t, bridge.baseUrl)
    const selectedJobs = fixture.manifest.jobs.slice(0, 2)
    const result = await runClient(clientArgs(fixture, selectedJobs.map(({ id }) => id)))

    assert.equal(result.code, 0, result.stderr)
    assert.equal(bridge.state.posts.length, 2)
    for (const [index, job] of selectedJobs.entries()) {
      assert.deepEqual(bridge.state.posts[index], expectedGenerationPayload(fixture.manifest, job))
      assert.deepEqual(
        readFileSync(resolve(fixture.runRoot, 'videos', job.video)),
        videoBytes,
      )
    }
    assert.deepEqual(bridge.state.events, [
      'health',
      'post:task-1',
      'status:task-1:0',
      'status:task-1:1',
      'download:task-1',
      'post:task-2',
      'status:task-2:0',
      'status:task-2:1',
      'download:task-2',
    ])

    const stateText = readFileSync(resolve(fixture.runRoot, 'jobs.json'), 'utf8')
    const state = JSON.parse(stateText)
    assert.deepEqual(state.jobs.map(({ id, status }) => ({ id, status })), [
      { id: selectedJobs[0].id, status: 'completed' },
      { id: selectedJobs[1].id, status: 'completed' },
    ])
    for (const [index, entry] of state.jobs.entries()) {
      assert.equal(entry.taskId, `task-${index + 1}`)
      assert.equal(entry.seed, selectedJobs[index].seed)
      assert.equal(entry.video, `videos/${selectedJobs[index].video}`)
      assert.equal(typeof entry.startedAt, 'string')
      assert.equal(typeof entry.completedAt, 'string')
      assert.equal(entry.error, null)
      assert.equal('prompt' in entry, false)
      assert.equal('reference' in entry, false)
    }
    assertNoPrivatePayload(result, stateText)
    assert.deepEqual(findPartFiles(fixture.runRoot), [])
  })

  await t.test('resumes a processing task without another POST', async (t) => {
    const bridge = await startFakeBridge(t)
    const fixture = createClientFixture(t, bridge.baseUrl)
    const job = fixture.manifest.jobs[0]
    writeJobsState(fixture.runRoot, [stateEntry(job, 'processing', 'resume-task')])

    const result = await runClient(clientArgs(fixture, [job.id]))

    assert.equal(result.code, 0, result.stderr)
    assert.equal(bridge.state.posts.length, 0)
    assert.deepEqual(bridge.state.statusRequests, ['resume-task', 'resume-task'])
    assert.deepEqual(bridge.state.downloads, ['resume-task'])
    const stateText = readFileSync(resolve(fixture.runRoot, 'jobs.json'), 'utf8')
    const [entry] = JSON.parse(stateText).jobs
    assert.equal(entry.taskId, 'resume-task')
    assert.equal(entry.status, 'completed')
    assertNoPrivatePayload(result, stateText)
    assert.deepEqual(findPartFiles(fixture.runRoot), [])
  })

  await t.test('skips a completed task when its non-empty MP4 exists', async (t) => {
    const bridge = await startFakeBridge(t)
    const fixture = createClientFixture(t, bridge.baseUrl)
    const job = fixture.manifest.jobs[0]
    const target = resolve(fixture.runRoot, 'videos', job.video)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, Buffer.from('existing mp4'))
    writeJobsState(fixture.runRoot, [stateEntry(job, 'completed', 'completed-task')])

    const result = await runClient(clientArgs(fixture, [job.id]))

    assert.equal(result.code, 0, result.stderr)
    assert.equal(bridge.state.posts.length, 0)
    assert.deepEqual(bridge.state.statusRequests, [])
    assert.deepEqual(bridge.state.downloads, [])
    assert.deepEqual(readFileSync(target), Buffer.from('existing mp4'))
    assertNoPrivatePayload(result, readFileSync(resolve(fixture.runRoot, 'jobs.json'), 'utf8'))
    assert.deepEqual(findPartFiles(fixture.runRoot), [])
  })

  await t.test('re-downloads a missing completed MP4 with the same task id', async (t) => {
    const videoBytes = Buffer.from('re-downloaded mp4')
    const bridge = await startFakeBridge(t, {
      videoBytes,
      statusFor: ({ baseUrl, taskId }) => ({
        status: 'completed',
        url: `${baseUrl}/files/${encodeURIComponent(taskId)}.mp4`,
        metadata: { resumed: true },
      }),
    })
    const fixture = createClientFixture(t, bridge.baseUrl)
    const job = fixture.manifest.jobs[0]
    writeJobsState(fixture.runRoot, [stateEntry(job, 'completed', 'download-task')])

    const result = await runClient(clientArgs(fixture, [job.id]))

    assert.equal(result.code, 0, result.stderr)
    assert.equal(bridge.state.posts.length, 0)
    assert.deepEqual(bridge.state.statusRequests, ['download-task'])
    assert.deepEqual(bridge.state.downloads, ['download-task'])
    assert.deepEqual(readFileSync(resolve(fixture.runRoot, 'videos', job.video)), videoBytes)
    assertNoPrivatePayload(result, readFileSync(resolve(fixture.runRoot, 'jobs.json'), 'utf8'))
    assert.deepEqual(findPartFiles(fixture.runRoot), [])
  })

  await t.test('returns nonzero and safely retains a failed task', async (t) => {
    const bridge = await startFakeBridge(t, {
      statusFor: () => ({
        status: 'failed',
        error: 'backend rejected data:image/png;base64,DO-NOT-LEAK',
      }),
    })
    const fixture = createClientFixture(t, bridge.baseUrl)
    const job = fixture.manifest.jobs[0]

    const result = await runClient(clientArgs(fixture, [job.id]))

    assert.notEqual(result.code, 0)
    assert.equal(bridge.state.posts.length, 1)
    const stateText = readFileSync(resolve(fixture.runRoot, 'jobs.json'), 'utf8')
    const state = JSON.parse(stateText)
    assert.equal(state.jobs.length, 1)
    assert.equal(state.jobs[0].id, job.id)
    assert.equal(state.jobs[0].taskId, 'task-1')
    assert.equal(state.jobs[0].status, 'failed')
    assert.equal(typeof state.jobs[0].error, 'string')
    assert.equal(state.jobs[0].error.includes('data:image/'), false)
    assertNoPrivatePayload(result, stateText)
    assert.deepEqual(findPartFiles(fixture.runRoot), [])
  })

  await t.test('validates selections and unsafe manifest paths before POST', async (t) => {
    const bridge = await startFakeBridge(t)
    const invalidCases = [
      ['duplicate job id', (manifest) => { manifest.jobs[1].id = manifest.jobs[0].id }],
      ['unsafe job id', (manifest) => { manifest.jobs[0].id = '../unsafe' }],
      ['missing reference', (manifest) => { manifest.jobs[0].reference = 'art-source/h3-pilot/missing.png' }],
      ['missing prompt', (manifest) => { manifest.jobs[0].prompt = 'art-source/h3-pilot/missing.txt' }],
      ['escaping reference', (manifest) => { manifest.jobs[0].reference = '../outside.png' }],
      ['unsafe video', (manifest) => { manifest.jobs[0].video = '../outside.mp4' }],
    ]

    for (const [label, mutateManifest] of invalidCases) {
      const fixture = createClientFixture(t, bridge.baseUrl, mutateManifest)
      const result = await runClient(clientArgs(fixture, []))
      assert.notEqual(result.code, 0, label)
      assertNoPrivatePayload(result)
    }

    const validFixture = createClientFixture(t, bridge.baseUrl)
    const unknownJob = await runClient(clientArgs(validFixture, ['not-a-pilot-job']))
    assert.notEqual(unknownJob.code, 0)
    assertNoPrivatePayload(unknownJob)

    const outsideRun = projectRelativePath(resolve(projectRoot, '..', 'outside-h3-run'))
    const outsideResult = await runClient([
      '--manifest', validFixture.manifestArg,
      '--run-root', outsideRun,
      '--job', 'qinglan-idle',
    ])
    assert.notEqual(outsideResult.code, 0)
    assertNoPrivatePayload(outsideResult)
    assert.equal(bridge.state.posts.length, 0)
  })

  await t.test('dry-run validates all nine jobs without state or submissions', async (t) => {
    const bridge = await startFakeBridge(t)
    const fixture = createClientFixture(t, bridge.baseUrl)
    const result = await runClient(clientArgs(fixture, [], ['--dry-run']))

    assert.equal(result.code, 0, result.stderr)
    assert.equal(bridge.state.healthRequests, 1)
    assert.equal(bridge.state.posts.length, 0)
    assert.deepEqual(bridge.state.statusRequests, [])
    assert.match(result.stdout, /selected jobs=9/i)
    assert.match(result.stdout, /submissions=0/i)
    assert.equal(existsSync(resolve(fixture.runRoot, 'jobs.json')), false)
    assertNoPrivatePayload(result)
    assert.deepEqual(findPartFiles(fixture.runRoot), [])
  })
})
