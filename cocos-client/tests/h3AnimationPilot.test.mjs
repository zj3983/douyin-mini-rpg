import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const projectRoot = resolve('.')
const manifestPath = resolve(projectRoot, 'art-source/h3-pilot/pilot.json')
const promptRoot = resolve(projectRoot, 'art-source/h3-pilot/prompts')

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

function sortedRecord(entries) {
  return Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)))
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

    resolveInside(projectRoot, job.video, `${job.id} video`)
    assert.match(job.video, new RegExp(`^${job.actor}/[^/]+\\.mp4$`), `${job.id} video is in its actor directory`)

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
