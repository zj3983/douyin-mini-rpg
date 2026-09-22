# Combat Graybox (M1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the stage-one "青苔丘陵" combat layer as a data-driven vertical-slice core with placeholder (graybox) visuals: full-screen tap movement, wolf/moth enemy state machines, three boss skills with a phase two, an auto-targeting curved flying sword, and a seeded 90-second headless simulation that clears the stage.

**Architecture:** New authoritative battle core in `cocos-client/assets/Scripts/Core/Battle/` as pure TypeScript with zero Cocos imports (spec §10). Node 24 strips TS types natively, so tests import the `.ts` core directly — **no hand-maintained `tools/*.mjs` mirror is created for the new core** (spec §10.1 权威实现). A single self-contained `GrayboxBattleController` Cocos component binds the core to `Graphics`-drawn placeholders; no scene-file surgery beyond attaching one component to one node.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node.js 24 test runner (`node --test tests/*.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-07-14-combat-vertical-slice-design.md` — this plan covers milestone **M1 战斗灰盒** only (spec §14). Out of scope (later milestones): final sprite art (M2), artifact quality-tier mutations + hit-stop/camera/object pools (M3), audio + final waves (M4), device testing + deployment (M5), plus platform-compliance launch items (健康游戏忠告启动页、适龄提示、抽卡概率公示、侧边栏复访、小游戏备案).

**Existing code to reuse (do not modify):**
- `assets/Scripts/Core/MovementRuntime.ts` — reference for substepped movement (`MAX_MOVEMENT_FRAME_DELTA = 0.25`, `MAX_MOVEMENT_SUBSTEP = 1/60`). The new `PlayerMotor` reimplements this pattern with full-screen bounds; the old module stays untouched for the old battle line.
- `tests/playableBattle.test.mjs` — pattern for source-contract tests (`readFileSync` + `assert.match`) reused for the graybox controller test.
- Old battle files (`BattleRuntime.ts`, `PortraitBattleBootstrap.ts`, etc.) remain for reference; the new core lives in a new `Core/Battle/` directory and never imports from the old core.

**Conventions:**
- Pure functions mutating plain state objects, interfaces exported, no classes in Core, no `enum`/`namespace` (Node type-stripping requires erasable syntax only).
- Test files: `tests/<name>.test.mjs`, `import test from 'node:test'`, `import assert from 'node:assert/strict'`, run from the `cocos-client/` working directory.
- Commit after every task. Commit message style (from `git log`): `feat: ...`, `test: ...`, lowercase, no scope.
- All combat randomness flows through a seeded RNG (spec §13.2 determinism).
- Do not weaken any test assertion to make it pass. If a simulation/timing test fails, tune `StageOneConfig.ts` numbers or the test's bot policy only.

---

## Task 1: Verify direct TypeScript imports in tests

The new core must be the single authoritative implementation (spec §10.1). Node 24 runs `.ts` via type stripping, so tests import core `.ts` files directly. Prove the pipeline before building on it.

**Files:**
- Create: `cocos-client/tests/tsImportSmoke.test.mjs`

- [ ] **Step 1: Write the smoke test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createStageFlow, recordOrdinaryDefeat } from '../assets/Scripts/Core/StageFlowRuntime.ts'

test('tests import TypeScript core modules directly without a mirror', () => {
  const flow = createStageFlow(2, 0)
  assert.equal(flow.phase, 'clearing')
  recordOrdinaryDefeat(flow)
  assert.equal(flow.ordinaryDefeats, 1)
})
```

- [ ] **Step 2: Run it**

Run: `cd cocos-client && node --test tests/tsImportSmoke.test.mjs`
Expected: PASS (Node 24 strips types; if it fails, the Node version is wrong — stop and fix the toolchain, do not create a mirror).

- [ ] **Step 3: Commit**

```bash
git add cocos-client/tests/tsImportSmoke.test.mjs
git commit -m "test: import core typescript directly in node tests"
```

---

## Task 2: Seeded random generator

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Battle/Random.ts`
- Test: `cocos-client/tests/combatRandom.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'

test('same seed produces the same sequence', () => {
  const a = createSeededRandom(42)
  const b = createSeededRandom(42)
  assert.deepEqual([a.next(), a.next(), a.next()], [b.next(), b.next(), b.next()])
})

test('range, int and pick stay inside their domains', () => {
  const random = createSeededRandom(7)
  for (let index = 0; index < 200; index += 1) {
    const value = random.range(-2, 3)
    assert.equal(value >= -2 && value < 3, true)
    const rolled = random.int(1, 4)
    assert.equal(Number.isInteger(rolled) && rolled >= 1 && rolled <= 4, true)
    assert.equal(['a', 'b'].includes(random.pick(['a', 'b'])), true)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cocos-client && node --test tests/combatRandom.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `Random.ts`**

```ts
export interface SeededRandom {
  readonly seed: number
  next(): number
  range(min: number, max: number): number
  int(minInclusive: number, maxInclusive: number): number
  pick<T>(items: readonly T[]): T
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = (Math.floor(seed) >>> 0) || 1
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    seed,
    next,
    range(min: number, max: number) {
      return min + (max - min) * next()
    },
    int(minInclusive: number, maxInclusive: number) {
      return Math.floor(next() * (maxInclusive - minInclusive + 1)) + minInclusive
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)]
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cocos-client && node --test tests/combatRandom.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Battle/Random.ts cocos-client/tests/combatRandom.test.mjs
git commit -m "feat: add seeded random for deterministic combat"
```

---

## Task 3: Battle geometry primitives

Fan (boss sweep), ring-band-with-gap (boss roar), bezier helpers and segment-distance (sword path) hit shapes, per spec §7 and §8.1.

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Battle/Geometry.ts`
- Test: `cocos-client/tests/combatGeometry.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  angleDiff,
  clampVecToBounds,
  distancePointToSegment,
  pointInFan,
  pointInRingBand,
  vecNormalize,
} from '../assets/Scripts/Core/Battle/Geometry.ts'

test('clampVecToBounds confines targets to the safe battle area', () => {
  const bounds = { minX: -330, maxX: 330, minY: -420, maxY: 460 }
  assert.deepEqual(clampVecToBounds({ x: 999, y: -999 }, bounds), { x: 330, y: -420 })
})

test('angleDiff wraps into [-PI, PI]', () => {
  assert.ok(Math.abs(angleDiff(Math.PI - 0.1, -Math.PI + 0.1) + 0.2) < 1e-9)
})

test('vecNormalize of a zero vector falls back to unit-x', () => {
  assert.deepEqual(vecNormalize({ x: 0, y: 0 }), { x: 1, y: 0 })
})

test('distancePointToSegment measures perpendicular distance and clamps ends', () => {
  assert.equal(distancePointToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5)
  assert.equal(distancePointToSegment({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5)
})

test('pointInFan respects radius and half angle', () => {
  const fan = { origin: { x: 0, y: 0 }, directionRadians: 0, radius: 100, halfAngleRadians: Math.PI / 4 }
  assert.equal(pointInFan({ x: 80, y: 0 }, fan), true)
  assert.equal(pointInFan({ x: 60, y: 60 }, fan), false)
  assert.equal(pointInFan({ x: 140, y: 0 }, fan), false)
})

test('pointInRingBand hits the band but never the safe gap', () => {
  const ring = { center: { x: 0, y: 0 }, innerRadius: 90, outerRadius: 110, gapCenterRadians: 0, gapHalfAngleRadians: 0.5 }
  assert.equal(pointInRingBand({ x: 0, y: 100 }, ring), true)
  assert.equal(pointInRingBand({ x: 100, y: 0 }, ring), false)
  assert.equal(pointInRingBand({ x: 0, y: 50 }, ring), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cocos-client && node --test tests/combatGeometry.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `Geometry.ts`**

```ts
export interface Vec2 {
  x: number
  y: number
}

export interface BattleBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function vecSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function vecScale(a: Vec2, scalar: number): Vec2 {
  return { x: a.x * scalar, y: a.y * scalar }
}

export function vecDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function vecNormalize(a: Vec2): Vec2 {
  const length = Math.hypot(a.x, a.y)
  if (length === 0 || !Number.isFinite(length)) return { x: 1, y: 0 }
  return { x: a.x / length, y: a.y / length }
}

export function vecAngle(a: Vec2): number {
  return Math.atan2(a.y, a.x)
}

export function angleDiff(a: number, b: number): number {
  let diff = a - b
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return diff
}

export function isFiniteVec(a: Vec2): boolean {
  return Number.isFinite(a.x) && Number.isFinite(a.y)
}

export function clampVecToBounds(point: Vec2, bounds: BattleBounds): Vec2 {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  }
}

export function distancePointToSegment(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSq = dx * dx + dy * dy
  const rawT = lengthSq === 0 ? 0 : ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq
  const t = Math.max(0, Math.min(1, rawT))
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t))
}

export interface FanSpec {
  origin: Vec2
  directionRadians: number
  radius: number
  halfAngleRadians: number
}

export function pointInFan(point: Vec2, fan: FanSpec): boolean {
  if (vecDistance(point, fan.origin) > fan.radius) return false
  const angle = vecAngle(vecSub(point, fan.origin))
  return Math.abs(angleDiff(angle, fan.directionRadians)) <= fan.halfAngleRadians
}

export interface RingBandSpec {
  center: Vec2
  innerRadius: number
  outerRadius: number
  gapCenterRadians: number
  gapHalfAngleRadians: number
}

export function pointInRingBand(point: Vec2, ring: RingBandSpec): boolean {
  const distance = vecDistance(point, ring.center)
  if (distance < ring.innerRadius || distance > ring.outerRadius) return false
  const angle = vecAngle(vecSub(point, ring.center))
  return Math.abs(angleDiff(angle, ring.gapCenterRadians)) > ring.gapHalfAngleRadians
}

export function quadBezierPoint(from: Vec2, control: Vec2, to: Vec2, t: number): Vec2 {
  const u = 1 - t
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  }
}

export function quadBezierLength(from: Vec2, control: Vec2, to: Vec2): number {
  let length = 0
  let previous = from
  for (let index = 1; index <= 16; index += 1) {
    const point = quadBezierPoint(from, control, to, index / 16)
    length += vecDistance(previous, point)
    previous = point
  }
  return length
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cocos-client && node --test tests/combatGeometry.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Battle/Geometry.ts cocos-client/tests/combatGeometry.test.mjs
git commit -m "feat: add combat geometry hit shapes"
```

---

## Task 4: PlayerMotor full-screen movement

Spec §4.3: the hero moves anywhere inside the safe battle bounds (no more `-310..70` left-half lock), repeated taps only update the target (no teleport/jitter), and hurt/death never rewrite the target or position. Movement is substepped like the old `MovementRuntime`.

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Battle/PlayerMotor.ts`
- Test: `cocos-client/tests/combatPlayerMotor.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlayerMotor, setMoveTarget, tickPlayerMotor } from '../assets/Scripts/Core/Battle/PlayerMotor.ts'

const config = {
  bounds: { minX: -330, maxX: 330, minY: -420, maxY: 460 },
  speed: 280,
  spawn: { x: -260, y: -80 },
  maxHp: 260,
  radius: 24,
}

test('tap target is clamped to full-screen safe bounds, not the old left half', () => {
  const motor = createPlayerMotor(config)
  assert.equal(setMoveTarget(motor, { x: 999, y: 999 }), true)
  assert.deepEqual(motor.target, { x: 330, y: 460 })
  assert.equal(setMoveTarget(motor, { x: 250, y: 100 }), true)
  assert.deepEqual(motor.target, { x: 250, y: 100 })
})

test('repeated taps update the target without teleporting or resetting position', () => {
  const motor = createPlayerMotor(config)
  setMoveTarget(motor, { x: 200, y: 100 })
  tickPlayerMotor(motor, 1 / 60)
  const afterFirst = { ...motor.position }
  assert.ok(afterFirst.x > -260 && afterFirst.x < -255)
  setMoveTarget(motor, { x: -300, y: -200 })
  tickPlayerMotor(motor, 1 / 60)
  const delta = Math.hypot(motor.position.x - afterFirst.x, motor.position.y - afterFirst.y)
  assert.ok(delta <= 280 / 60 + 1e-6)
})

test('non-finite targets and deltas are rejected, keeping the last valid state', () => {
  const motor = createPlayerMotor(config)
  assert.equal(setMoveTarget(motor, { x: Number.NaN, y: 0 }), false)
  assert.equal(motor.target, null)
  setMoveTarget(motor, { x: 100, y: 0 })
  const before = { ...motor.position }
  tickPlayerMotor(motor, Number.NaN)
  assert.deepEqual(motor.position, before)
})

test('movement arrives and stops; hp fields are initialised', () => {
  const motor = createPlayerMotor(config)
  setMoveTarget(motor, { x: -258, y: -80 })
  const result = tickPlayerMotor(motor, 1 / 60)
  assert.equal(result.arrived, true)
  assert.equal(motor.target, null)
  assert.equal(motor.hp, 260)
  assert.equal(motor.alive, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cocos-client && node --test tests/combatPlayerMotor.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `PlayerMotor.ts`**

```ts
import { BattleBounds, clampVecToBounds, isFiniteVec, Vec2 } from './Geometry'

export interface PlayerMotorConfig {
  bounds: BattleBounds
  speed: number
  spawn: Vec2
  maxHp: number
  radius: number
}

export interface PlayerMotor {
  position: Vec2
  target: Vec2 | null
  readonly speed: number
  readonly bounds: BattleBounds
  readonly radius: number
  hp: number
  readonly maxHp: number
  alive: boolean
  hurtCooldownRemaining: number
}

export const MOTOR_MAX_FRAME_DELTA = 0.25
export const MOTOR_SUBSTEP = 1 / 60

export function createPlayerMotor(config: PlayerMotorConfig): PlayerMotor {
  return {
    position: { ...config.spawn },
    target: null,
    speed: config.speed,
    bounds: { ...config.bounds },
    radius: config.radius,
    hp: Math.max(1, Math.floor(config.maxHp)),
    maxHp: Math.max(1, Math.floor(config.maxHp)),
    alive: true,
    hurtCooldownRemaining: 0,
  }
}

export function setMoveTarget(motor: PlayerMotor, point: Vec2): boolean {
  if (!motor.alive || !isFiniteVec(point)) return false
  motor.target = clampVecToBounds(point, motor.bounds)
  return true
}

export function tickPlayerMotor(motor: PlayerMotor, deltaTime: number): { distanceMoved: number; arrived: boolean } {
  const idle = { distanceMoved: 0, arrived: false }
  if (!motor.alive || !motor.target) return idle
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return idle
  if (!isFiniteVec(motor.position) || !isFiniteVec(motor.target)) return idle

  const acceptedDelta = Math.min(deltaTime, MOTOR_MAX_FRAME_DELTA)
  const substeps = Math.max(1, Math.ceil(acceptedDelta / MOTOR_SUBSTEP - 1e-12))
  const substepDelta = acceptedDelta / substeps
  let distanceMoved = 0

  for (let index = 0; index < substeps; index += 1) {
    const dx = motor.target.x - motor.position.x
    const dy = motor.target.y - motor.position.y
    const distance = Math.hypot(dx, dy)
    if (distance === 0) {
      motor.target = null
      return { distanceMoved, arrived: true }
    }
    const step = Math.min(distance, motor.speed * substepDelta)
    motor.position = { x: motor.position.x + (dx / distance) * step, y: motor.position.y + (dy / distance) * step }
    distanceMoved += step
    if (step >= distance) {
      motor.target = null
      return { distanceMoved, arrived: true }
    }
  }

  return { distanceMoved, arrived: false }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cocos-client && node --test tests/combatPlayerMotor.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Battle/PlayerMotor.ts cocos-client/tests/combatPlayerMotor.test.mjs
git commit -m "feat: add full-screen player motor"
```

---

## Task 5: EnemyBrain wolf/moth state machines

Spec §6: data-driven `spawn -> select-position -> telegraph -> attack -> recovery` with `hurt`/`death` branches. Wolf flanks, crouches, pounces through the player's position, and suffers a longer whiff recovery. Moth holds an altitude band, keeps separation from other moths, and alternates dive / spirit-bolt. AI decisions run staggered at 8-10Hz; movement and dashes update every frame.

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Battle/EnemyBrain.ts`
- Test: `cocos-client/tests/combatEnemyBrain.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createEnemy,
  enemyBodyHitsPlayer,
  interruptEnemy,
  killEnemy,
  tickEnemy,
} from '../assets/Scripts/Core/Battle/EnemyBrain.ts'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'

const wolf = {
  kind: 'wolf', maxHp: 110, radius: 26, moveSpeed: 130, flankOffsetY: 90, postOffsetX: 130,
  pounceRange: 210, telegraphSeconds: 0.6, pounceSpeed: 540, pounceSeconds: 0.45,
  recoverySeconds: 0.5, whiffRecoverySeconds: 0.9, touchDamage: 16, decisionHz: 8, spawnSeconds: 0.5,
}
const moth = {
  kind: 'moth', maxHp: 80, radius: 22, moveSpeed: 150, altitudeMin: 60, altitudeMax: 240,
  postOffsetX: 140, attackRange: 280, minSeparation: 90, telegraphSeconds: 0.55,
  diveSpeed: 580, diveSeconds: 0.5, projectileSpeed: 320, projectileRadius: 12,
  projectileDamage: 14, touchDamage: 12, recoverySeconds: 0.6, decisionHz: 9, spawnSeconds: 0.6,
}
const bounds = { minX: -330, maxX: 330, minY: -420, maxY: 460 }
const ctxFor = (enemy, extras = {}) => ({
  playerPosition: { x: 0, y: 0 },
  playerAlive: true,
  enemies: [enemy],
  bounds,
  random: createSeededRandom(3),
  deltaTime: 1 / 60,
  ...extras,
})

function run(enemy, seconds, extras = {}) {
  const events = []
  for (let tick = 0; tick < seconds * 60; tick += 1) events.push(...tickEnemy(enemy, ctxFor(enemy, extras)))
  return events
}

test('wolf follows spawn -> select-position -> telegraph -> attack -> recovery', () => {
  const enemy = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(3))
  const seen = []
  for (let tick = 0; tick < 600; tick += 1) {
    tickEnemy(enemy, ctxFor(enemy))
    if (seen[seen.length - 1] !== enemy.state) seen.push(enemy.state)
  }
  assert.deepEqual(seen.slice(0, 5), ['spawn', 'select-position', 'telegraph', 'attack', 'recovery'])
})

test('telegraph and recovery deal no body damage, only attack frames do', () => {
  const enemy = createEnemy(1, wolf, { x: 100, y: 0 }, createSeededRandom(3))
  enemy.state = 'telegraph'
  assert.equal(enemyBodyHitsPlayer(enemy, { x: 0, y: 0 }, 24), false)
  enemy.state = 'attack'
  enemy.position = { x: 30, y: 0 }
  assert.equal(enemyBodyHitsPlayer(enemy, { x: 0, y: 0 }, 24), true)
  enemy.state = 'recovery'
  assert.equal(enemyBodyHitsPlayer(enemy, { x: 0, y: 0 }, 24), false)
})

test('whiffed pounce uses the longer whiff recovery', () => {
  const enemy = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(3))
  enemy.state = 'attack'
  enemy.stateElapsed = 99
  enemy.attackDidHit = false
  tickEnemy(enemy, ctxFor(enemy))
  assert.equal(enemy.state, 'recovery')
  assert.equal(enemy.recoveryDuration, wolf.whiffRecoverySeconds)
})

test('hurt interrupts telegraph, death is terminal, spawn is not interruptible', () => {
  const enemy = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(3))
  assert.equal(interruptEnemy(enemy), false)
  enemy.state = 'telegraph'
  assert.equal(interruptEnemy(enemy), true)
  assert.equal(enemy.state, 'hurt')
  assert.equal(killEnemy(enemy), true)
  assert.equal(enemy.alive, false)
  assert.equal(enemy.state, 'death')
  assert.equal(interruptEnemy(enemy), false)
})

test('moth alternates bolt and dive and emits a projectile event on bolt', () => {
  const enemy = createEnemy(2, moth, { x: 200, y: 120 }, createSeededRandom(5))
  enemy.state = 'select-position'
  enemy.position = { x: 200, y: 120 }
  const events = run(enemy, 4)
  const bolt = events.find((event) => event.type === 'moth-bolt')
  assert.ok(bolt, 'bolt volley should fire')
  assert.equal(bolt.speed, 320)
  assert.equal(enemy.nextMothAttack, 'dive')
})

test('decisions are staggered so not every enemy decides on the same frame', () => {
  const a = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(11))
  const b = createEnemy(2, wolf, { x: 150, y: 0 }, createSeededRandom(99))
  assert.notEqual(a.decisionRemaining, b.decisionRemaining)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cocos-client && node --test tests/combatEnemyBrain.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `EnemyBrain.ts`**

```ts
import { BattleBounds, clampVecToBounds, vecAdd, vecDistance, vecNormalize, vecScale, vecSub, Vec2 } from './Geometry'
import { SeededRandom } from './Random'

export type EnemyKind = 'wolf' | 'moth'
export type EnemyStateName = 'spawn' | 'select-position' | 'telegraph' | 'attack' | 'recovery' | 'hurt' | 'death'

export interface WolfBehavior {
  kind: 'wolf'
  maxHp: number
  radius: number
  moveSpeed: number
  flankOffsetY: number
  postOffsetX: number
  pounceRange: number
  telegraphSeconds: number
  pounceSpeed: number
  pounceSeconds: number
  recoverySeconds: number
  whiffRecoverySeconds: number
  touchDamage: number
  decisionHz: number
  spawnSeconds: number
}

export interface MothBehavior {
  kind: 'moth'
  maxHp: number
  radius: number
  moveSpeed: number
  altitudeMin: number
  altitudeMax: number
  postOffsetX: number
  attackRange: number
  minSeparation: number
  telegraphSeconds: number
  diveSpeed: number
  diveSeconds: number
  projectileSpeed: number
  projectileRadius: number
  projectileDamage: number
  touchDamage: number
  recoverySeconds: number
  decisionHz: number
  spawnSeconds: number
}

export type EnemyBehavior = WolfBehavior | MothBehavior

export interface EnemyEntity {
  id: number
  kind: EnemyKind
  behavior: EnemyBehavior
  position: Vec2
  hp: number
  maxHp: number
  radius: number
  alive: boolean
  state: EnemyStateName
  stateElapsed: number
  post: Vec2
  attackDirection: Vec2
  attackDidHit: boolean
  recoveryDuration: number
  nextMothAttack: 'dive' | 'bolt'
  decisionRemaining: number
  deathElapsed: number
}

export type EnemyEvent =
  | { type: 'enemy-state'; enemyId: number; state: EnemyStateName }
  | { type: 'pounce-start'; enemyId: number; from: Vec2; direction: Vec2 }
  | { type: 'dive-start'; enemyId: number; from: Vec2; direction: Vec2 }
  | { type: 'moth-bolt'; enemyId: number; from: Vec2; direction: Vec2; speed: number; radius: number; damage: number }

export interface EnemyTickContext {
  playerPosition: Vec2
  playerAlive: boolean
  enemies: readonly EnemyEntity[]
  bounds: BattleBounds
  random: SeededRandom
  deltaTime: number
}

export const HURT_SECONDS = 0.25

export function createEnemy(id: number, behavior: EnemyBehavior, spawn: Vec2, random: SeededRandom): EnemyEntity {
  return {
    id,
    kind: behavior.kind,
    behavior,
    position: { ...spawn },
    hp: behavior.maxHp,
    maxHp: behavior.maxHp,
    radius: behavior.radius,
    alive: true,
    state: 'spawn',
    stateElapsed: 0,
    post: { ...spawn },
    attackDirection: { x: -1, y: 0 },
    attackDidHit: false,
    recoveryDuration: behavior.recoverySeconds,
    nextMothAttack: 'bolt',
    decisionRemaining: random.range(0, 1 / behavior.decisionHz),
    deathElapsed: 0,
  }
}

function enterState(enemy: EnemyEntity, state: EnemyStateName, events: EnemyEvent[]) {
  enemy.state = state
  enemy.stateElapsed = 0
  events.push({ type: 'enemy-state', enemyId: enemy.id, state })
}

function moveToward(enemy: EnemyEntity, target: Vec2, speed: number, deltaTime: number) {
  const offset = vecSub(target, enemy.position)
  const distance = Math.hypot(offset.x, offset.y)
  if (distance === 0) return
  const step = Math.min(distance, speed * deltaTime)
  enemy.position = vecAdd(enemy.position, vecScale(offset, step / distance))
}

function choosePost(enemy: EnemyEntity, ctx: EnemyTickContext) {
  const behavior = enemy.behavior
  const side = ctx.random.pick([-1, 1] as const)
  if (behavior.kind === 'wolf') {
    enemy.post = clampVecToBounds({
      x: ctx.playerPosition.x + side * behavior.postOffsetX,
      y: ctx.playerPosition.y + ctx.random.pick([-1, 1] as const) * behavior.flankOffsetY,
    }, ctx.bounds)
    return
  }
  let post = clampVecToBounds({
    x: ctx.playerPosition.x + side * behavior.postOffsetX,
    y: ctx.random.range(behavior.altitudeMin, behavior.altitudeMax),
  }, ctx.bounds)
  for (const other of ctx.enemies) {
    if (other.id === enemy.id || !other.alive || other.kind !== 'moth') continue
    const gap = vecDistance(post, other.position)
    if (gap > 0 && gap < behavior.minSeparation) {
      post = clampVecToBounds(
        vecAdd(post, vecScale(vecNormalize(vecSub(post, other.position)), behavior.minSeparation - gap)),
        ctx.bounds,
      )
    }
  }
  enemy.post = post
}

function attackRangeOf(behavior: EnemyBehavior): number {
  return behavior.kind === 'wolf' ? behavior.pounceRange : behavior.attackRange
}

function beginTelegraph(enemy: EnemyEntity, ctx: EnemyTickContext, events: EnemyEvent[]) {
  enemy.attackDirection = vecNormalize(vecSub(ctx.playerPosition, enemy.position))
  enterState(enemy, 'telegraph', events)
}

function beginAttack(enemy: EnemyEntity, ctx: EnemyTickContext, events: EnemyEvent[]) {
  enemy.attackDirection = vecNormalize(vecSub(ctx.playerPosition, enemy.position))
  enemy.attackDidHit = false
  enterState(enemy, 'attack', events)
  if (enemy.behavior.kind === 'wolf') {
    events.push({ type: 'pounce-start', enemyId: enemy.id, from: { ...enemy.position }, direction: { ...enemy.attackDirection } })
    return
  }
  if (enemy.nextMothAttack === 'bolt') {
    events.push({
      type: 'moth-bolt',
      enemyId: enemy.id,
      from: { ...enemy.position },
      direction: { ...enemy.attackDirection },
      speed: enemy.behavior.projectileSpeed,
      radius: enemy.behavior.projectileRadius,
      damage: enemy.behavior.projectileDamage,
    })
  } else {
    events.push({ type: 'dive-start', enemyId: enemy.id, from: { ...enemy.position }, direction: { ...enemy.attackDirection } })
  }
}

function endAttack(enemy: EnemyEntity, events: EnemyEvent[]) {
  const behavior = enemy.behavior
  if (behavior.kind === 'moth') {
    enemy.nextMothAttack = enemy.nextMothAttack === 'bolt' ? 'dive' : 'bolt'
  }
  enemy.recoveryDuration = !enemy.attackDidHit && behavior.kind === 'wolf'
    ? behavior.whiffRecoverySeconds
    : behavior.recoverySeconds
  enterState(enemy, 'recovery', events)
}

export function tickEnemy(enemy: EnemyEntity, ctx: EnemyTickContext): EnemyEvent[] {
  const events: EnemyEvent[] = []
  if (enemy.state === 'death') {
    enemy.deathElapsed += ctx.deltaTime
    return events
  }
  if (!enemy.alive) return events

  enemy.stateElapsed += ctx.deltaTime
  enemy.decisionRemaining -= ctx.deltaTime
  const behavior = enemy.behavior

  switch (enemy.state) {
    case 'spawn':
      if (enemy.stateElapsed >= behavior.spawnSeconds) enterState(enemy, 'select-position', events)
      break
    case 'select-position': {
      if (enemy.decisionRemaining <= 0) {
        enemy.decisionRemaining = 1 / behavior.decisionHz
        choosePost(enemy, ctx)
      }
      moveToward(enemy, enemy.post, behavior.moveSpeed, ctx.deltaTime)
      if (ctx.playerAlive && vecDistance(enemy.position, ctx.playerPosition) <= attackRangeOf(behavior)) {
        beginTelegraph(enemy, ctx, events)
      }
      break
    }
    case 'telegraph':
      if (enemy.stateElapsed >= behavior.telegraphSeconds) beginAttack(enemy, ctx, events)
      break
    case 'attack': {
      const isBolt = behavior.kind === 'moth' && enemy.nextMothAttack === 'bolt'
      if (isBolt) {
        if (enemy.stateElapsed >= 0.2) endAttack(enemy, events)
        break
      }
      const dashSpeed = behavior.kind === 'wolf' ? behavior.pounceSpeed : behavior.diveSpeed
      const dashSeconds = behavior.kind === 'wolf' ? behavior.pounceSeconds : behavior.diveSeconds
      enemy.position = vecAdd(enemy.position, vecScale(enemy.attackDirection, dashSpeed * ctx.deltaTime))
      if (enemy.stateElapsed >= dashSeconds) endAttack(enemy, events)
      break
    }
    case 'recovery':
      if (enemy.stateElapsed >= enemy.recoveryDuration) {
        enemy.attackDidHit = false
        enterState(enemy, 'select-position', events)
      }
      break
    case 'hurt':
      if (enemy.stateElapsed >= HURT_SECONDS) enterState(enemy, 'recovery', events)
      break
  }

  return events
}

export function interruptEnemy(enemy: EnemyEntity): boolean {
  if (!enemy.alive) return false
  if (enemy.state === 'spawn' || enemy.state === 'hurt' || enemy.state === 'death') return false
  enemy.state = 'hurt'
  enemy.stateElapsed = 0
  return true
}

export function killEnemy(enemy: EnemyEntity): boolean {
  if (!enemy.alive) return false
  enemy.alive = false
  enemy.state = 'death'
  enemy.stateElapsed = 0
  enemy.deathElapsed = 0
  return true
}

export function enemyBodyHitsPlayer(enemy: EnemyEntity, playerPosition: Vec2, playerRadius: number): boolean {
  if (!enemy.alive || enemy.state !== 'attack' || enemy.attackDidHit) return false
  if (enemy.behavior.kind === 'moth' && enemy.nextMothAttack === 'bolt') return false
  return vecDistance(enemy.position, playerPosition) <= enemy.radius + playerRadius
}
```

Note the legal-transition contract the tests pin down: `spawn -> select-position -> telegraph -> attack -> recovery -> select-position`, with `select-position/telegraph/attack/recovery -> hurt -> recovery`, and any living state -> `death` (spec §6.1, §13.1).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cocos-client && node --test tests/combatEnemyBrain.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Battle/EnemyBrain.ts cocos-client/tests/combatEnemyBrain.test.mjs
git commit -m "feat: add wolf and moth enemy state machines"
```

---

## Task 6: CombatResolver — enemy/player damage resolution

Spec §6.1: damage lands only inside valid attack frames; ordinary contact never drains HP. Player hits respect a short invincibility window so one pounce cannot chain-drain. Non-lethal sword damage interrupts ordinary enemies (spec: 普通怪可被打断); killing damage does not need the interrupt.

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Battle/CombatResolver.ts`
- Test: `cocos-client/tests/combatResolver.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyEnemyDamage, applyPlayerDamage, tickPlayerCombat } from '../assets/Scripts/Core/Battle/CombatResolver.ts'
import { createEnemy } from '../assets/Scripts/Core/Battle/EnemyBrain.ts'
import { createPlayerMotor } from '../assets/Scripts/Core/Battle/PlayerMotor.ts'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'

const wolf = {
  kind: 'wolf', maxHp: 110, radius: 26, moveSpeed: 130, flankOffsetY: 90, postOffsetX: 130,
  pounceRange: 210, telegraphSeconds: 0.6, pounceSpeed: 540, pounceSeconds: 0.45,
  recoverySeconds: 0.5, whiffRecoverySeconds: 0.9, touchDamage: 16, decisionHz: 8, spawnSeconds: 0.5,
}
const motorConfig = {
  bounds: { minX: -330, maxX: 330, minY: -420, maxY: 460 },
  speed: 280, spawn: { x: -260, y: -80 }, maxHp: 260, radius: 24,
}

test('enemy damage interrupts survivors and kills at zero', () => {
  const enemy = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(3))
  enemy.state = 'telegraph'
  const first = applyEnemyDamage(enemy, 55)
  assert.equal(first.killed, false)
  assert.equal(first.interrupted, true)
  assert.equal(enemy.state, 'hurt')
  const second = applyEnemyDamage(enemy, 55)
  assert.equal(second.killed, true)
  assert.equal(enemy.alive, false)
  assert.equal(applyEnemyDamage(enemy, 55).killed, false)
})

test('player damage respects the invincibility window; death keeps the move target untouched', () => {
  const motor = createPlayerMotor(motorConfig)
  motor.target = { x: 100, y: 100 }
  assert.equal(applyPlayerDamage(motor, 40, 0.5), true)
  assert.equal(motor.hp, 220)
  assert.equal(applyPlayerDamage(motor, 40, 0.5), false)
  tickPlayerCombat(motor, 0.5)
  assert.equal(applyPlayerDamage(motor, 220, 0.5), true)
  assert.equal(motor.alive, false)
  assert.deepEqual(motor.target, { x: 100, y: 100 })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cocos-client && node --test tests/combatResolver.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `CombatResolver.ts`**

```ts
import { EnemyEntity, interruptEnemy, killEnemy } from './EnemyBrain'
import { PlayerMotor } from './PlayerMotor'

export interface EnemyDamageResult {
  amount: number
  remainingHp: number
  killed: boolean
  interrupted: boolean
}

export function applyEnemyDamage(enemy: EnemyEntity, amount: number): EnemyDamageResult {
  if (!enemy.alive) return { amount: 0, remainingHp: 0, killed: false, interrupted: false }
  const applied = Math.max(0, Math.round(amount))
  enemy.hp = Math.max(0, enemy.hp - applied)
  if (enemy.hp === 0) {
    killEnemy(enemy)
    return { amount: applied, remainingHp: 0, killed: true, interrupted: false }
  }
  const interrupted = interruptEnemy(enemy)
  return { amount: applied, remainingHp: enemy.hp, killed: false, interrupted }
}

export function tickPlayerCombat(motor: PlayerMotor, deltaTime: number) {
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return
  motor.hurtCooldownRemaining = Math.max(0, motor.hurtCooldownRemaining - deltaTime)
}

export function applyPlayerDamage(motor: PlayerMotor, amount: number, invincibleSeconds: number): boolean {
  if (!motor.alive || motor.hurtCooldownRemaining > 0) return false
  motor.hp = Math.max(0, motor.hp - Math.max(0, Math.round(amount)))
  motor.hurtCooldownRemaining = Math.max(0, invincibleSeconds)
  if (motor.hp === 0) motor.alive = false
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cocos-client && node --test tests/combatResolver.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Battle/CombatResolver.ts cocos-client/tests/combatResolver.test.mjs
git commit -m "feat: add combat resolver with attack-frame damage"
```

---

## Task 7: ArtifactRuntime — 御剑术 curved flying sword

Spec §8.1: auto-target nearest enemy, **curved** outbound path that pierces, then a return pass that may hit each enemy once more; the sword stays at combat height. Quality-tier mutations (§8.2) are M3 and out of scope.

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Battle/ArtifactRuntime.ts`
- Test: `cocos-client/tests/combatArtifact.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createArtifactState, tickArtifact } from '../assets/Scripts/Core/Battle/ArtifactRuntime.ts'

const config = {
  damage: 55, speed: 900, width: 30, pierce: 3, outboundDistance: 160,
  curveHeight: 90, cooldownSeconds: 0.9, returnArriveRadius: 28,
}
const owner = { x: -260, y: -80 }
const makeTargets = () => [
  { id: 1, position: { x: -60, y: -80 }, radius: 26, alive: true },
  { id: 2, position: { x: 60, y: -80 }, radius: 26, alive: true },
  { id: 3, position: { x: 180, y: -80 }, radius: 26, alive: true },
  { id: 4, position: { x: 500, y: 300 }, radius: 26, alive: true },
]

test('sword auto-fires at the nearest target when the cooldown is ready', () => {
  const state = createArtifactState()
  let fired = false
  for (let tick = 0; tick < 120 && !fired; tick += 1) {
    fired = tickArtifact(state, config, { owner, targets: makeTargets(), deltaTime: 1 / 60 }).fired
  }
  assert.equal(fired, true)
  assert.ok(state.sword)
})

test('outbound path is curved, pierces, and each pass hits a target at most once', () => {
  const state = createArtifactState()
  const targets = makeTargets()
  const allHits = []
  let minY = Infinity
  let maxY = -Infinity
  for (let tick = 0; tick < 600 && allHits.length === 0; tick += 1) {
    tickArtifact(state, config, { owner, targets, deltaTime: 1 / 60 })
  }
  for (let tick = 0; tick < 600 && state.sword; tick += 1) {
    const result = tickArtifact(state, config, { owner, targets, deltaTime: 1 / 60 })
    allHits.push(...result.hits)
    if (state.sword) {
      minY = Math.min(minY, state.sword.position.y)
      maxY = Math.max(maxY, state.sword.position.y)
    }
  }
  assert.ok(maxY - minY > 40, 'path must bend, not be a straight line')
  assert.equal(allHits.filter((hit) => hit.targetId === 1).length <= 2, true)
  assert.ok(allHits.length >= 3, 'outbound + return passes should pierce several targets')
  assert.ok(allHits.every((hit) => hit.targetId !== 4), 'pierce cap keeps the far target unhit')
})

test('sword returns to a moving owner and restarts the cooldown', () => {
  const state = createArtifactState()
  const targets = makeTargets()
  const movingOwner = { ...owner }
  tickArtifact(state, config, { owner: movingOwner, targets, deltaTime: 1 / 60 })
  let returned = false
  for (let tick = 0; tick < 600 && !returned; tick += 1) {
    movingOwner.x -= 1
    returned = tickArtifact(state, config, { owner: movingOwner, targets, deltaTime: 1 / 60 }).returnedToOwner
  }
  assert.equal(returned, true)
  assert.equal(state.sword, null)
  assert.ok(state.cooldownRemaining > 0)
})

test('no targets means no firing', () => {
  const state = createArtifactState()
  const result = tickArtifact(state, config, { owner, targets: [], deltaTime: 1 / 60 })
  assert.equal(result.fired, false)
  assert.equal(state.sword, null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cocos-client && node --test tests/combatArtifact.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `ArtifactRuntime.ts`**

```ts
import {
  distancePointToSegment,
  quadBezierLength,
  quadBezierPoint,
  vecAdd,
  vecDistance,
  vecNormalize,
  vecScale,
  vecSub,
  Vec2,
} from './Geometry'

export interface FlyingSwordConfig {
  damage: number
  speed: number
  width: number
  pierce: number
  outboundDistance: number
  curveHeight: number
  cooldownSeconds: number
  returnArriveRadius: number
}

export type SwordPhase = 'outbound' | 'returning'

export interface FlyingSword {
  phase: SwordPhase
  position: Vec2
  from: Vec2
  control: Vec2
  to: Vec2
  progress: number
  distance: number
  hitOutbound: number[]
  hitReturn: number[]
}

export interface ArtifactState {
  sword: FlyingSword | null
  cooldownRemaining: number
}

export interface SwordTarget {
  id: number
  position: Vec2
  radius: number
  alive: boolean
}

export interface SwordHit {
  targetId: number
  position: Vec2
}

export interface ArtifactTickResult {
  hits: SwordHit[]
  fired: boolean
  returnedToOwner: boolean
}

export function createArtifactState(): ArtifactState {
  return { sword: null, cooldownRemaining: 0 }
}

function nearestTarget(owner: Vec2, targets: readonly SwordTarget[]): SwordTarget | null {
  let best: SwordTarget | null = null
  let bestDistance = Infinity
  for (const target of targets) {
    if (!target.alive) continue
    const distance = vecDistance(owner, target.position)
    if (distance < bestDistance) {
      bestDistance = distance
      best = target
    }
  }
  return best
}

function launchSword(owner: Vec2, target: SwordTarget, config: FlyingSwordConfig): FlyingSword {
  const direction = vecNormalize(vecSub(target.position, owner))
  const to = vecAdd(target.position, vecScale(direction, config.outboundDistance))
  const mid = vecScale(vecAdd(owner, to), 0.5)
  const perpendicular = { x: -direction.y, y: direction.x }
  const control = vecAdd(mid, vecScale(perpendicular, config.curveHeight))
  return {
    phase: 'outbound',
    position: { ...owner },
    from: { ...owner },
    control,
    to,
    progress: 0,
    distance: Math.max(1, quadBezierLength(owner, control, to)),
    hitOutbound: [],
    hitReturn: [],
  }
}

function collectSegmentHits(
  sword: FlyingSword,
  from: Vec2,
  to: Vec2,
  config: FlyingSwordConfig,
  targets: readonly SwordTarget[],
  hitList: number[],
  hits: SwordHit[],
) {
  for (const target of targets) {
    if (!target.alive || hitList.includes(target.id)) continue
    if (hitList.length >= config.pierce) break
    if (distancePointToSegment(target.position, from, to) <= target.radius + config.width * 0.5) {
      hitList.push(target.id)
      hits.push({ targetId: target.id, position: { ...target.position } })
    }
  }
}

export function tickArtifact(
  state: ArtifactState,
  config: FlyingSwordConfig,
  ctx: { owner: Vec2; targets: readonly SwordTarget[]; deltaTime: number },
): ArtifactTickResult {
  const hits: SwordHit[] = []
  let fired = false
  let returnedToOwner = false
  state.cooldownRemaining = Math.max(0, state.cooldownRemaining - ctx.deltaTime)

  if (!state.sword) {
    if (state.cooldownRemaining > 0) return { hits, fired, returnedToOwner }
    const target = nearestTarget(ctx.owner, ctx.targets)
    if (!target) return { hits, fired, returnedToOwner }
    state.sword = launchSword(ctx.owner, target, config)
    fired = true
  }

  const sword = state.sword
  const previous = { ...sword.position }

  if (sword.phase === 'outbound') {
    sword.progress = Math.min(1, sword.progress + (config.speed * ctx.deltaTime) / sword.distance)
    sword.position = quadBezierPoint(sword.from, sword.control, sword.to, sword.progress)
    collectSegmentHits(sword, previous, sword.position, config, ctx.targets, sword.hitOutbound, hits)
    if (sword.progress >= 1) sword.phase = 'returning'
  } else {
    const distanceToOwner = vecDistance(sword.position, ctx.owner)
    const step = config.speed * ctx.deltaTime
    if (distanceToOwner <= Math.max(config.returnArriveRadius, step)) {
      sword.position = { ...ctx.owner }
      returnedToOwner = true
      state.sword = null
      state.cooldownRemaining = config.cooldownSeconds
    } else {
      const direction = vecNormalize(vecSub(ctx.owner, sword.position))
      sword.position = vecAdd(sword.position, vecScale(direction, step))
      collectSegmentHits(sword, previous, sword.position, config, ctx.targets, sword.hitReturn, hits)
    }
  }

  return { hits, fired, returnedToOwner }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cocos-client && node --test tests/combatArtifact.test.mjs`
Expected: PASS (the curve assertion relies on `curveHeight: 90` bending the bezier ~45 units off the straight line).

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Battle/ArtifactRuntime.ts cocos-client/tests/combatArtifact.test.mjs
git commit -m "feat: add curved auto-targeting flying sword"
```

---

## Task 8: BossBrain — three skills and phase two

Spec §7: 横扫竹刃 (fan sweep, tests vertical dodging), 破土竹刺 (three sequential markers under the player, delayed eruption), 守山震吼 (expanding ring with one safe gap). Phase two below 50% HP pairs skills **without shortening telegraphs**. Sword damage never interrupts boss skill states (spec §6.1: Boss 只在配置允许的阶段被打断 — M1 configures none).

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Battle/BossBrain.ts`
- Test: `cocos-client/tests/combatBossBrain.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyBossDamage,
  createBoss,
  roarHitsPlayer,
  sweepHitsPlayer,
  tickBoss,
} from '../assets/Scripts/Core/Battle/BossBrain.ts'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'

const config = {
  spawn: { x: 420, y: -40 }, anchor: { x: 170, y: -20 },
  maxHp: 1500, radius: 56, moveSpeed: 60, entrySeconds: 1.5, idleSeconds: 1.1,
  decisionHz: 8, phaseTwoHpFraction: 0.5,
  sweep: { telegraph: 0.8, active: 0.25, recovery: 0.7, radius: 260, halfAngleRadians: 0.9, damage: 24 },
  spikes: { count: 3, interval: 0.35, markerDelay: 0.7, radius: 60, damage: 20, recovery: 0.6 },
  roar: { telegraph: 0.9, waveSpeed: 420, bandWidth: 70, maxRadius: 520, gapHalfAngleRadians: 0.55, damage: 28, recovery: 0.8 },
}
const ctxFor = (extras = {}) => ({
  playerPosition: { x: 0, y: -20 }, playerAlive: true, random: createSeededRandom(9), deltaTime: 1 / 60, ...extras,
})
function run(boss, seconds, extras = {}) {
  const events = []
  for (let tick = 0; tick < seconds * 60; tick += 1) events.push(...tickBoss(boss, config, ctxFor(extras)))
  return events
}

test('boss walks in during entry, then cycles all three skills', () => {
  const boss = createBoss(100, config)
  const events = run(boss, 20)
  const telegraphed = events.filter((event) => event.type === 'boss-telegraph').map((event) => event.skill)
  assert.deepEqual([...new Set(telegraphed)].sort(), ['bamboo-sweep', 'earth-spikes', 'mountain-roar'])
})

test('sweep only hits inside the fan during active frames', () => {
  const boss = createBoss(100, config)
  boss.state = 'telegraph'
  boss.currentSkill = 'bamboo-sweep'
  boss.sweepFan = { origin: { x: 170, y: -20 }, directionRadians: Math.PI, radius: 260, halfAngleRadians: 0.9 }
  assert.equal(sweepHitsPlayer(boss, { x: 0, y: -20 }, 24), false, 'no damage during telegraph')
  boss.state = 'attack'
  assert.equal(sweepHitsPlayer(boss, { x: 0, y: -20 }, 24), true)
  assert.equal(sweepHitsPlayer(boss, { x: 170, y: 200 }, 24), false, 'outside the fan angle')
})

test('earth spikes erupt after their delay, never at spawn', () => {
  const boss = createBoss(100, config)
  boss.state = 'attack'
  boss.currentSkill = 'earth-spikes'
  boss.clock = 10
  const events = run(boss, 0.1)
  const marker = events.find((event) => event.type === 'boss-spike-marker')?.marker
  assert.ok(marker, 'first marker spawns immediately in the attack state')
  assert.ok(marker.eruptAt > 10, 'eruption is always delayed')
  assert.equal(events.some((event) => event.type === 'boss-spike-erupt'), false)
})

test('roar wave hits the band but never the safe gap', () => {
  const boss = createBoss(100, config)
  boss.state = 'attack'
  boss.currentSkill = 'mountain-roar'
  boss.roarWave = { center: { x: 170, y: -20 }, radius: 200, bandWidth: 70, gapCenterRadians: 0, gapHalfAngleRadians: 0.55, didHit: false }
  assert.equal(roarHitsPlayer(boss, { x: 170, y: 180 }, 24), true)
  assert.equal(roarHitsPlayer(boss, { x: 370, y: -20 }, 24), false, 'player inside the gap is safe')
  assert.equal(roarHitsPlayer(boss, { x: 170, y: 500 }, 24), false, 'outside the band')
})

test('phase two queues a second skill without shortening telegraphs', () => {
  const boss = createBoss(100, config)
  const result = applyBossDamage(boss, 800)
  assert.equal(result.enteredPhaseTwo, true)
  assert.equal(boss.phase, 2)
  const events = run(boss, 6)
  const telegraphs = events.filter((event) => event.type === 'boss-telegraph')
  assert.ok(telegraphs.length >= 2, 'phase two pairs skills')
  assert.equal(config.sweep.telegraph, 0.8)
})

test('boss damage never interrupts skill states; death is terminal', () => {
  const boss = createBoss(100, config)
  boss.state = 'attack'
  boss.currentSkill = 'bamboo-sweep'
  applyBossDamage(boss, 100)
  assert.equal(boss.state, 'attack')
  const result = applyBossDamage(boss, 9999)
  assert.equal(result.killed, true)
  assert.equal(boss.alive, false)
  assert.equal(boss.state, 'death')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cocos-client && node --test tests/combatBossBrain.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `BossBrain.ts`**

```ts
import { angleDiff, FanSpec, pointInFan, vecAdd, vecAngle, vecDistance, vecNormalize, vecScale, vecSub, Vec2 } from './Geometry'
import { SeededRandom } from './Random'

export type BossSkillId = 'bamboo-sweep' | 'earth-spikes' | 'mountain-roar'
export type BossState = 'entry' | 'idle' | 'telegraph' | 'attack' | 'recovery' | 'death'

export interface SpikeMarker {
  id: number
  position: Vec2
  radius: number
  eruptAt: number
  erupted: boolean
  resolved: boolean
  damage: number
}

export interface RoarWave {
  center: Vec2
  radius: number
  bandWidth: number
  gapCenterRadians: number
  gapHalfAngleRadians: number
  didHit: boolean
}

export interface BossConfig {
  spawn: Vec2
  anchor: Vec2
  maxHp: number
  radius: number
  moveSpeed: number
  entrySeconds: number
  idleSeconds: number
  decisionHz: number
  phaseTwoHpFraction: number
  sweep: { telegraph: number; active: number; recovery: number; radius: number; halfAngleRadians: number; damage: number }
  spikes: { count: number; interval: number; markerDelay: number; radius: number; damage: number; recovery: number }
  roar: { telegraph: number; waveSpeed: number; bandWidth: number; maxRadius: number; gapHalfAngleRadians: number; damage: number; recovery: number }
}

export interface BossEntity {
  id: number
  position: Vec2
  hp: number
  maxHp: number
  radius: number
  alive: boolean
  state: BossState
  stateElapsed: number
  clock: number
  phase: 1 | 2
  currentSkill: BossSkillId | null
  queuedSkill: BossSkillId | null
  sweepFan: FanSpec | null
  spikes: SpikeMarker[]
  roarWave: RoarWave | null
  roarGapRadians: number
  skillCursor: number
  spikeSpawned: number
  spikeTimer: number
  didHit: boolean
  nextSpikeId: number
}

export type BossEvent =
  | { type: 'boss-state'; state: BossState }
  | { type: 'boss-telegraph'; skill: BossSkillId; fan?: FanSpec; gapRadians?: number }
  | { type: 'boss-attack'; skill: BossSkillId }
  | { type: 'boss-spike-marker'; marker: SpikeMarker }
  | { type: 'boss-spike-erupt'; marker: SpikeMarker }
  | { type: 'boss-phase-two' }

export interface BossTickContext {
  playerPosition: Vec2
  playerAlive: boolean
  random: SeededRandom
  deltaTime: number
}

const SKILL_ROTATION: readonly BossSkillId[] = ['bamboo-sweep', 'earth-spikes', 'mountain-roar']

export function createBoss(id: number, config: BossConfig): BossEntity {
  return {
    id,
    position: { ...config.spawn },
    hp: config.maxHp,
    maxHp: config.maxHp,
    radius: config.radius,
    alive: true,
    state: 'entry',
    stateElapsed: 0,
    clock: 0,
    phase: 1,
    currentSkill: null,
    queuedSkill: null,
    sweepFan: null,
    spikes: [],
    roarWave: null,
    roarGapRadians: 0,
    skillCursor: 0,
    spikeSpawned: 0,
    spikeTimer: 0,
    didHit: false,
    nextSpikeId: 1,
  }
}

function enterBossState(boss: BossEntity, state: BossState, events: BossEvent[]) {
  boss.state = state
  boss.stateElapsed = 0
  events.push({ type: 'boss-state', state })
}

function moveToward(position: Vec2, target: Vec2, speed: number, deltaTime: number): Vec2 {
  const offset = vecSub(target, position)
  const distance = Math.hypot(offset.x, offset.y)
  if (distance === 0) return position
  const step = Math.min(distance, speed * deltaTime)
  return vecAdd(position, vecScale(offset, step / distance))
}

function startSkill(boss: BossEntity, config: BossConfig, skill: BossSkillId, ctx: BossTickContext, events: BossEvent[]) {
  boss.currentSkill = skill
  boss.didHit = false
  boss.spikeSpawned = 0
  boss.spikeTimer = 0
  if (skill === 'bamboo-sweep') {
    boss.sweepFan = {
      origin: { ...boss.position },
      directionRadians: vecAngle(vecSub(ctx.playerPosition, boss.position)),
      radius: config.sweep.radius,
      halfAngleRadians: config.sweep.halfAngleRadians,
    }
  }
  if (skill === 'mountain-roar') {
    boss.roarGapRadians = ctx.random.range(-Math.PI, Math.PI)
  }
  enterBossState(boss, 'telegraph', events)
  events.push({
    type: 'boss-telegraph',
    skill,
    fan: boss.sweepFan ?? undefined,
    gapRadians: skill === 'mountain-roar' ? boss.roarGapRadians : undefined,
  })
}

function pickNextSkill(boss: BossEntity): BossSkillId {
  const skill = SKILL_ROTATION[boss.skillCursor % SKILL_ROTATION.length]
  boss.skillCursor += 1
  return skill
}

function telegraphSecondsOf(boss: BossEntity, config: BossConfig): number {
  if (boss.currentSkill === 'bamboo-sweep') return config.sweep.telegraph
  if (boss.currentSkill === 'earth-spikes') return 0.4
  return config.roar.telegraph
}

function recoverySecondsOf(boss: BossEntity, config: BossConfig): number {
  if (boss.currentSkill === 'bamboo-sweep') return config.sweep.recovery
  if (boss.currentSkill === 'earth-spikes') return config.spikes.recovery
  return config.roar.recovery
}

function beginBossAttack(boss: BossEntity, config: BossConfig, events: BossEvent[]) {
  enterBossState(boss, 'attack', events)
  events.push({ type: 'boss-attack', skill: boss.currentSkill ?? 'bamboo-sweep' })
  if (boss.currentSkill === 'mountain-roar') {
    boss.roarWave = {
      center: { ...boss.position },
      radius: config.roar.bandWidth,
      bandWidth: config.roar.bandWidth,
      gapCenterRadians: boss.roarGapRadians,
      gapHalfAngleRadians: config.roar.gapHalfAngleRadians,
      didHit: false,
    }
  }
}

function tickSpikeMarkers(boss: BossEntity, events: BossEvent[]) {
  for (const marker of boss.spikes) {
    if (!marker.erupted && boss.clock >= marker.eruptAt) {
      marker.erupted = true
      events.push({ type: 'boss-spike-erupt', marker })
    } else if (marker.erupted && !marker.resolved && boss.clock >= marker.eruptAt + 0.25) {
      marker.resolved = true
    }
  }
}

export function tickBoss(boss: BossEntity, config: BossConfig, ctx: BossTickContext): BossEvent[] {
  const events: BossEvent[] = []
  if (!boss.alive) {
    boss.stateElapsed += ctx.deltaTime
    return events
  }
  boss.stateElapsed += ctx.deltaTime
  boss.clock += ctx.deltaTime
  tickSpikeMarkers(boss, events)

  switch (boss.state) {
    case 'entry': {
      boss.position = moveToward(boss.position, config.anchor, config.moveSpeed * 2, ctx.deltaTime)
      if (boss.stateElapsed >= config.entrySeconds) enterBossState(boss, 'idle', events)
      break
    }
    case 'idle': {
      if (ctx.playerAlive) {
        const hold = vecAdd(ctx.playerPosition, vecScale(vecNormalize(vecSub(boss.position, ctx.playerPosition)), 220))
        boss.position = moveToward(boss.position, hold, config.moveSpeed, ctx.deltaTime)
      }
      if (boss.stateElapsed >= config.idleSeconds && ctx.playerAlive) {
        const skill = pickNextSkill(boss)
        if (boss.phase === 2) boss.queuedSkill = SKILL_ROTATION[boss.skillCursor % SKILL_ROTATION.length]
        startSkill(boss, config, skill, ctx, events)
      }
      break
    }
    case 'telegraph':
      if (boss.stateElapsed >= telegraphSecondsOf(boss, config)) beginBossAttack(boss, config, events)
      break
    case 'attack': {
      if (boss.currentSkill === 'bamboo-sweep' && boss.stateElapsed >= config.sweep.active) {
        enterBossState(boss, 'recovery', events)
        break
      }
      if (boss.currentSkill === 'earth-spikes') {
        boss.spikeTimer -= ctx.deltaTime
        if (boss.spikeSpawned < config.spikes.count && boss.spikeTimer <= 0) {
          boss.spikeTimer = config.spikes.interval
          boss.spikeSpawned += 1
          const marker: SpikeMarker = {
            id: boss.nextSpikeId,
            position: { ...ctx.playerPosition },
            radius: config.spikes.radius,
            eruptAt: boss.clock + config.spikes.markerDelay,
            erupted: false,
            resolved: false,
            damage: config.spikes.damage,
          }
          boss.nextSpikeId += 1
          boss.spikes.push(marker)
          events.push({ type: 'boss-spike-marker', marker })
        }
        if (boss.spikeSpawned >= config.spikes.count && boss.spikes.every((marker) => marker.resolved)) {
          boss.spikes = []
          enterBossState(boss, 'recovery', events)
        }
        break
      }
      if (boss.currentSkill === 'mountain-roar' && boss.roarWave) {
        boss.roarWave.radius += config.roar.waveSpeed * ctx.deltaTime
        if (boss.roarWave.radius >= config.roar.maxRadius) {
          boss.roarWave = null
          enterBossState(boss, 'recovery', events)
        }
      }
      break
    }
    case 'recovery':
      if (boss.stateElapsed >= recoverySecondsOf(boss, config)) {
        if (boss.queuedSkill) {
          const queued = boss.queuedSkill
          boss.queuedSkill = null
          startSkill(boss, config, queued, ctx, events)
        } else {
          boss.currentSkill = null
          enterBossState(boss, 'idle', events)
        }
      }
      break
  }

  return events
}

export function applyBossDamage(boss: BossEntity, amount: number): { killed: boolean; enteredPhaseTwo: boolean } {
  if (!boss.alive) return { killed: false, enteredPhaseTwo: false }
  boss.hp = Math.max(0, boss.hp - Math.max(0, Math.round(amount)))
  const enteredPhaseTwo = boss.phase === 1 && boss.hp > 0 && boss.hp <= boss.maxHp * 0.5
  if (enteredPhaseTwo) boss.phase = 2
  if (boss.hp === 0) {
    boss.alive = false
    boss.state = 'death'
    boss.stateElapsed = 0
    return { killed: true, enteredPhaseTwo }
  }
  return { killed: false, enteredPhaseTwo }
}

export function sweepHitsPlayer(boss: BossEntity, playerPosition: Vec2, playerRadius: number): boolean {
  if (!boss.alive || boss.state !== 'attack' || boss.currentSkill !== 'bamboo-sweep' || boss.didHit || !boss.sweepFan) return false
  return pointInFan(playerPosition, { ...boss.sweepFan, radius: boss.sweepFan.radius + playerRadius * 0.5 })
}

export function roarHitsPlayer(boss: BossEntity, playerPosition: Vec2, playerRadius: number): boolean {
  const wave = boss.roarWave
  if (!boss.alive || boss.state !== 'attack' || boss.currentSkill !== 'mountain-roar' || !wave || wave.didHit) return false
  const distance = vecDistance(wave.center, playerPosition)
  if (Math.abs(distance - wave.radius) > wave.bandWidth * 0.5 + playerRadius * 0.5) return false
  const angle = vecAngle(vecSub(playerPosition, wave.center))
  return Math.abs(angleDiff(angle, wave.gapCenterRadians)) > wave.gapHalfAngleRadians
}
```

Spike lifecycle: a marker erupts `markerDelay` after spawning (spec §7.2: 不在生成瞬间造成伤害), stays hittable for 0.25s, then auto-resolves so the attack can end even when the player dodges everything. The session (Task 9) hit-tests each erupted, unresolved marker every frame and resolves it early after testing.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cocos-client && node --test tests/combatBossBrain.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Battle/BossBrain.ts cocos-client/tests/combatBossBrain.test.mjs
git commit -m "feat: add three-skill boss brain with phase two"
```

---

## Task 9: StageOneConfig + BattleSession orchestration

Spec §3 timeline (entry 0-15s, mowing 15-40s, elite pressure 40-60s, boss 60-90s), §12 cap of 18 active enemies, §3.4 settlement with a 3-second auto-continue that fires exactly once even if the button races it (§13.1).

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Battle/StageOneConfig.ts`
- Create: `cocos-client/assets/Scripts/Core/Battle/BattleSession.ts`
- Test: `cocos-client/tests/combatSession.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleSession, requestSettleContinue, tickBattleSession } from '../assets/Scripts/Core/Battle/BattleSession.ts'
import { applyBossDamage, createBoss } from '../assets/Scripts/Core/Battle/BossBrain.ts'
import { STAGE_ONE } from '../assets/Scripts/Core/Battle/StageOneConfig.ts'

function tickSeconds(session, seconds) {
  for (let tick = 0; tick < Math.round(seconds * 60); tick += 1) tickBattleSession(session, 1 / 60)
}

test('session flows opening -> waves -> drain -> boss-entry -> boss', () => {
  const session = createBattleSession(STAGE_ONE, 7)
  assert.equal(session.phase, 'opening')
  tickSeconds(session, 1.2)
  assert.equal(session.phase, 'waves')
  tickSeconds(session, 57)
  assert.ok(['drain', 'boss-entry', 'boss'].includes(session.phase), `unexpected phase ${session.phase}`)
  tickSeconds(session, 4)
  assert.equal(session.phase, 'boss')
  assert.ok(session.boss)
})

test('wave spawning never exceeds the 18-enemy cap', () => {
  const session = createBattleSession(STAGE_ONE, 7)
  let maxAlive = 0
  for (let tick = 0; tick < 60 * 60; tick += 1) {
    tickBattleSession(session, 1 / 60)
    maxAlive = Math.max(maxAlive, session.enemies.filter((enemy) => enemy.alive).length)
  }
  assert.ok(maxAlive <= 18)
})

test('settlement continue is idempotent against the 3-second auto-continue race', () => {
  const manual = createBattleSession(STAGE_ONE, 7)
  manual.phase = 'settle'
  manual.settleElapsed = 0
  assert.equal(requestSettleContinue(manual), true)
  assert.equal(manual.phase, 'cleared')
  assert.equal(requestSettleContinue(manual), false)

  const auto = createBattleSession(STAGE_ONE, 7)
  auto.phase = 'settle'
  tickSeconds(auto, 3.1)
  assert.equal(auto.phase, 'cleared')
  assert.equal(auto.events.filter((event) => event.type === 'cleared').length, 1)
})

test('player defeat freezes the session', () => {
  const session = createBattleSession(STAGE_ONE, 7)
  session.player.hp = 0
  session.player.alive = false
  tickBattleSession(session, 1 / 60)
  assert.equal(session.phase, 'defeated')
  const before = session.elapsed
  tickBattleSession(session, 1 / 60)
  assert.equal(session.elapsed, before)
  assert.equal(session.events.filter((event) => event.type === 'defeated').length, 1)
})

test('boss death settles the session exactly once', () => {
  const session = createBattleSession(STAGE_ONE, 7)
  session.phase = 'boss'
  session.boss = createBoss(999, STAGE_ONE.boss)
  applyBossDamage(session.boss, 99999)
  tickBattleSession(session, 1 / 60)
  assert.equal(session.phase, 'settle')
  tickBattleSession(session, 1 / 60)
  assert.equal(session.events.filter((event) => event.type === 'settle').length, 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cocos-client && node --test tests/combatSession.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `StageOneConfig.ts`**

```ts
import { FlyingSwordConfig } from './ArtifactRuntime'
import { BossConfig } from './BossBrain'
import { MothBehavior, WolfBehavior } from './EnemyBrain'
import { BattleBounds } from './Geometry'
import { PlayerMotorConfig } from './PlayerMotor'

export type SpawnKind = 'wolf' | 'moth'

export interface WaveSpec {
  start: number
  end: number
  spawnInterval: number
  composition: readonly SpawnKind[]
}

export interface StageOneProfile {
  id: number
  name: string
  bounds: BattleBounds
  player: PlayerMotorConfig
  playerInvincibleSeconds: number
  openingSeconds: number
  bossEntryTime: number
  drainSeconds: number
  maxAliveEnemies: number
  waves: readonly WaveSpec[]
  wolf: WolfBehavior
  moth: MothBehavior
  boss: BossConfig
  sword: FlyingSwordConfig
  enemySpawn: { x: number; groundY: readonly [number, number]; airY: readonly [number, number] }
  soulPerKill: number
  bossSoulAmount: number
  enemyDeathRecycleSeconds: number
}

const bounds: BattleBounds = { minX: -330, maxX: 330, minY: -420, maxY: 460 }

export const STAGE_ONE: StageOneProfile = {
  id: 1,
  name: '青苔丘陵',
  bounds,
  player: { bounds, speed: 280, spawn: { x: -260, y: -80 }, maxHp: 260, radius: 24 },
  playerInvincibleSeconds: 0.5,
  openingSeconds: 1.0,
  bossEntryTime: 58,
  drainSeconds: 2,
  maxAliveEnemies: 18,
  waves: [
    { start: 0, end: 15, spawnInterval: 2.4, composition: ['wolf', 'wolf', 'moth'] },
    { start: 15, end: 40, spawnInterval: 1.5, composition: ['wolf', 'moth', 'wolf', 'moth'] },
    { start: 40, end: 58, spawnInterval: 1.2, composition: ['wolf', 'wolf', 'moth', 'wolf'] },
  ],
  wolf: {
    kind: 'wolf', maxHp: 110, radius: 26, moveSpeed: 130, flankOffsetY: 90, postOffsetX: 130,
    pounceRange: 210, telegraphSeconds: 0.6, pounceSpeed: 540, pounceSeconds: 0.45,
    recoverySeconds: 0.5, whiffRecoverySeconds: 0.9, touchDamage: 16, decisionHz: 8, spawnSeconds: 0.5,
  },
  moth: {
    kind: 'moth', maxHp: 80, radius: 22, moveSpeed: 150, altitudeMin: 60, altitudeMax: 240,
    postOffsetX: 140, attackRange: 280, minSeparation: 90, telegraphSeconds: 0.55,
    diveSpeed: 580, diveSeconds: 0.5, projectileSpeed: 320, projectileRadius: 12,
    projectileDamage: 14, touchDamage: 12, recoverySeconds: 0.6, decisionHz: 9, spawnSeconds: 0.6,
  },
  boss: {
    spawn: { x: 420, y: -40 }, anchor: { x: 170, y: -20 },
    maxHp: 1500, radius: 56, moveSpeed: 60, entrySeconds: 1.5, idleSeconds: 1.1,
    decisionHz: 8, phaseTwoHpFraction: 0.5,
    sweep: { telegraph: 0.8, active: 0.25, recovery: 0.7, radius: 260, halfAngleRadians: 0.9, damage: 24 },
    spikes: { count: 3, interval: 0.35, markerDelay: 0.7, radius: 60, damage: 20, recovery: 0.6 },
    roar: { telegraph: 0.9, waveSpeed: 420, bandWidth: 70, maxRadius: 520, gapHalfAngleRadians: 0.55, damage: 28, recovery: 0.8 },
  },
  sword: {
    damage: 55, speed: 900, width: 30, pierce: 3, outboundDistance: 160,
    curveHeight: 90, cooldownSeconds: 0.9, returnArriveRadius: 28,
  },
  enemySpawn: { x: 400, groundY: [-200, -60], airY: [80, 220] },
  soulPerKill: 1,
  bossSoulAmount: 5,
  enemyDeathRecycleSeconds: 0.6,
}
```

- [ ] **Step 4: Implement `BattleSession.ts`**

```ts
import { ArtifactState, createArtifactState, SwordTarget, tickArtifact } from './ArtifactRuntime'
import {
  applyBossDamage,
  BossEntity,
  BossEvent,
  createBoss,
  roarHitsPlayer,
  sweepHitsPlayer,
  tickBoss,
} from './BossBrain'
import { applyEnemyDamage, applyPlayerDamage, tickPlayerCombat } from './CombatResolver'
import { createEnemy, EnemyEntity, EnemyEvent, enemyBodyHitsPlayer, tickEnemy } from './EnemyBrain'
import { vecAdd, vecDistance, vecScale, Vec2 } from './Geometry'
import { createPlayerMotor, PlayerMotor, tickPlayerMotor } from './PlayerMotor'
import { createSeededRandom, SeededRandom } from './Random'
import { StageOneProfile } from './StageOneConfig'

export type SessionPhase = 'opening' | 'waves' | 'drain' | 'boss-entry' | 'boss' | 'settle' | 'cleared' | 'defeated'

export interface Projectile {
  id: number
  position: Vec2
  direction: Vec2
  speed: number
  radius: number
  damage: number
  alive: boolean
}

export interface SoulDrop {
  id: number
  position: Vec2
  amount: number
}

export type SessionEvent =
  | { type: 'phase'; phase: SessionPhase }
  | { type: 'enemy-spawn'; enemy: EnemyEntity }
  | { type: 'enemy-event'; event: EnemyEvent }
  | { type: 'enemy-damage'; enemyId: number; amount: number; remainingHp: number; position: Vec2 }
  | { type: 'enemy-death'; enemyId: number; kind: string; position: Vec2 }
  | { type: 'enemy-recycled'; enemyId: number }
  | { type: 'sword-fired' }
  | { type: 'sword-returned' }
  | { type: 'projectile-spawn'; projectile: Projectile }
  | { type: 'projectile-despawn'; id: number }
  | { type: 'player-hurt'; amount: number; remainingHp: number }
  | { type: 'boss-event'; event: BossEvent }
  | { type: 'boss-damage'; amount: number; remainingHp: number }
  | { type: 'soul-drop'; soul: SoulDrop }
  | { type: 'settle' }
  | { type: 'cleared' }
  | { type: 'defeated' }

export interface BattleSession {
  stage: StageOneProfile
  phase: SessionPhase
  elapsed: number
  phaseElapsed: number
  generation: number
  player: PlayerMotor
  enemies: EnemyEntity[]
  boss: BossEntity | null
  artifact: ArtifactState
  projectiles: Projectile[]
  souls: SoulDrop[]
  spawnCursor: number
  spawnTimer: number
  nextEntityId: number
  settleElapsed: number
  settleContinued: boolean
  events: SessionEvent[]
  random: SeededRandom
}

const MAX_FRAME_DELTA = 0.25
const SETTLE_AUTO_CONTINUE_SECONDS = 3

export function createBattleSession(stage: StageOneProfile, seed: number): BattleSession {
  return {
    stage,
    phase: 'opening',
    elapsed: 0,
    phaseElapsed: 0,
    generation: 1,
    player: createPlayerMotor(stage.player),
    enemies: [],
    boss: null,
    artifact: createArtifactState(),
    projectiles: [],
    souls: [],
    spawnCursor: 0,
    spawnTimer: 0,
    nextEntityId: 1,
    settleElapsed: 0,
    settleContinued: false,
    events: [],
    random: createSeededRandom(seed),
  }
}

function setPhase(session: BattleSession, phase: SessionPhase) {
  session.phase = phase
  session.phaseElapsed = 0
  session.events.push({ type: 'phase', phase })
}

function activeWave(session: BattleSession, stage: StageOneProfile) {
  return stage.waves.find((wave) => session.elapsed >= wave.start && session.elapsed < wave.end) ?? null
}

function trySpawn(session: BattleSession, stage: StageOneProfile, deltaTime: number) {
  const wave = activeWave(session, stage)
  if (!wave) return
  session.spawnTimer += deltaTime
  if (session.spawnTimer < wave.spawnInterval) return
  session.spawnTimer = 0
  const aliveOrdinary = session.enemies.filter((enemy) => enemy.alive).length
  if (aliveOrdinary >= stage.maxAliveEnemies) return
  const kind = wave.composition[session.spawnCursor % wave.composition.length]
  session.spawnCursor += 1
  const behavior = kind === 'wolf' ? stage.wolf : stage.moth
  const band = kind === 'wolf' ? stage.enemySpawn.groundY : stage.enemySpawn.airY
  const spawn = { x: stage.enemySpawn.x, y: session.random.range(band[0], band[1]) }
  const enemy = createEnemy(session.nextEntityId, behavior, spawn, session.random)
  session.nextEntityId += 1
  session.enemies.push(enemy)
  session.events.push({ type: 'enemy-spawn', enemy })
}

function swordTargets(session: BattleSession): SwordTarget[] {
  const targets: SwordTarget[] = session.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => ({ id: enemy.id, position: enemy.position, radius: enemy.radius, alive: enemy.alive }))
  if (session.boss && session.boss.alive && session.boss.state !== 'entry') {
    targets.push({ id: session.boss.id, position: session.boss.position, radius: session.boss.radius, alive: true })
  }
  return targets
}

function damagePlayer(session: BattleSession, stage: StageOneProfile, amount: number) {
  if (applyPlayerDamage(session.player, amount, stage.playerInvincibleSeconds)) {
    session.events.push({ type: 'player-hurt', amount, remainingHp: session.player.hp })
  }
}

function hurtPlayerFromEnemies(session: BattleSession, stage: StageOneProfile) {
  for (const enemy of session.enemies) {
    if (!enemyBodyHitsPlayer(enemy, session.player.position, session.player.radius)) continue
    enemy.attackDidHit = true
    damagePlayer(session, stage, enemy.behavior.touchDamage)
  }
}

function hurtPlayerFromBoss(session: BattleSession, stage: StageOneProfile) {
  const boss = session.boss
  if (!boss || !boss.alive) return
  if (sweepHitsPlayer(boss, session.player.position, session.player.radius)) {
    boss.didHit = true
    damagePlayer(session, stage, stage.boss.sweep.damage)
  }
  if (boss.roarWave && roarHitsPlayer(boss, session.player.position, session.player.radius)) {
    boss.roarWave.didHit = true
    damagePlayer(session, stage, stage.boss.roar.damage)
  }
  for (const marker of boss.spikes) {
    if (!marker.erupted || marker.resolved) continue
    marker.resolved = true
    if (vecDistance(marker.position, session.player.position) <= marker.radius + session.player.radius * 0.5) {
      damagePlayer(session, stage, marker.damage)
    }
  }
}

function dropSouls(session: BattleSession, position: Vec2, amount: number) {
  const soul: SoulDrop = { id: session.nextEntityId, position: { ...position }, amount }
  session.nextEntityId += 1
  session.souls.push(soul)
  session.events.push({ type: 'soul-drop', soul })
}

function settle(session: BattleSession) {
  setPhase(session, 'settle')
  session.settleElapsed = 0
  session.events.push({ type: 'settle' })
}

function tickProjectiles(session: BattleSession, stage: StageOneProfile, deltaTime: number) {
  for (const projectile of session.projectiles) {
    if (!projectile.alive) continue
    projectile.position = vecAdd(projectile.position, vecScale(projectile.direction, projectile.speed * deltaTime))
    if (session.player.alive
      && vecDistance(projectile.position, session.player.position) <= projectile.radius + session.player.radius) {
      projectile.alive = false
      damagePlayer(session, stage, projectile.damage)
      session.events.push({ type: 'projectile-despawn', id: projectile.id })
      continue
    }
    const { bounds } = stage
    if (projectile.position.x < bounds.minX - 80 || projectile.position.x > bounds.maxX + 80
      || projectile.position.y < bounds.minY - 80 || projectile.position.y > bounds.maxY + 80) {
      projectile.alive = false
      session.events.push({ type: 'projectile-despawn', id: projectile.id })
    }
  }
  session.projectiles = session.projectiles.filter((projectile) => projectile.alive)
}

function recycleDeadEnemies(session: BattleSession, stage: StageOneProfile) {
  const recycled = session.enemies.filter(
    (enemy) => enemy.state === 'death' && enemy.deathElapsed >= stage.enemyDeathRecycleSeconds,
  )
  if (recycled.length === 0) return
  const recycledIds = new Set(recycled.map((enemy) => enemy.id))
  session.enemies = session.enemies.filter((enemy) => !recycledIds.has(enemy.id))
  for (const enemy of recycled) session.events.push({ type: 'enemy-recycled', enemyId: enemy.id })
}

function forceKillRemainingOrdinary(session: BattleSession) {
  for (const enemy of session.enemies) {
    if (!enemy.alive) continue
    enemy.alive = false
    enemy.state = 'death'
    enemy.deathElapsed = 0
    session.events.push({ type: 'enemy-death', enemyId: enemy.id, kind: enemy.kind, position: { ...enemy.position } })
  }
}

function summonBoss(session: BattleSession, stage: StageOneProfile) {
  session.boss = createBoss(session.nextEntityId, stage.boss)
  session.nextEntityId += 1
  setPhase(session, 'boss-entry')
}

function applySwordHits(session: BattleSession, stage: StageOneProfile, hits: Array<{ targetId: number; position: Vec2 }>) {
  for (const hit of hits) {
    if (session.boss && hit.targetId === session.boss.id) {
      const result = applyBossDamage(session.boss, stage.sword.damage)
      session.events.push({ type: 'boss-damage', amount: stage.sword.damage, remainingHp: session.boss.hp })
      if (result.enteredPhaseTwo) session.events.push({ type: 'boss-event', event: { type: 'boss-phase-two' } })
      if (result.killed) {
        dropSouls(session, session.boss.position, stage.bossSoulAmount)
        settle(session)
        return true
      }
      continue
    }
    const enemy = session.enemies.find((entry) => entry.id === hit.targetId)
    if (!enemy) continue
    const result = applyEnemyDamage(enemy, stage.sword.damage)
    session.events.push({
      type: 'enemy-damage',
      enemyId: enemy.id,
      amount: result.amount,
      remainingHp: result.remainingHp,
      position: { ...enemy.position },
    })
    if (result.killed) {
      session.events.push({ type: 'enemy-death', enemyId: enemy.id, kind: enemy.kind, position: { ...enemy.position } })
      dropSouls(session, enemy.position, stage.soulPerKill)
    }
  }
  return false
}

export function requestSettleContinue(session: BattleSession): boolean {
  if (session.phase !== 'settle' || session.settleContinued) return false
  session.settleContinued = true
  setPhase(session, 'cleared')
  session.events.push({ type: 'cleared' })
  return true
}

export function tickBattleSession(session: BattleSession, deltaTime: number): void {
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return
  const stage = session.stage
  const dt = Math.min(deltaTime, MAX_FRAME_DELTA)

  if (session.phase === 'settle') {
    session.settleElapsed += dt
    if (session.settleElapsed >= SETTLE_AUTO_CONTINUE_SECONDS) requestSettleContinue(session)
    return
  }
  if (session.phase === 'cleared' || session.phase === 'defeated') return

  if (!session.player.alive) {
    setPhase(session, 'defeated')
    session.events.push({ type: 'defeated' })
    return
  }

  session.elapsed += dt
  session.phaseElapsed += dt

  if (session.phase === 'opening' && session.phaseElapsed >= stage.openingSeconds) setPhase(session, 'waves')

  if (session.phase === 'waves' && session.elapsed >= stage.bossEntryTime) setPhase(session, 'drain')

  if (session.phase === 'drain') {
    const aliveOrdinary = session.enemies.filter((enemy) => enemy.alive).length
    if (aliveOrdinary === 0 || session.phaseElapsed >= stage.drainSeconds) {
      forceKillRemainingOrdinary(session)
      summonBoss(session, stage)
    }
  }

  if (session.phase === 'boss-entry' && session.boss && session.boss.state !== 'entry') setPhase(session, 'boss')

  tickPlayerMotor(session.player, dt)
  tickPlayerCombat(session.player, dt)

  if (session.phase === 'waves') trySpawn(session, stage, dt)

  const enemyCtx = {
    playerPosition: session.player.position,
    playerAlive: session.player.alive,
    enemies: session.enemies,
    bounds: stage.bounds,
    random: session.random,
    deltaTime: dt,
  }
  for (const enemy of session.enemies) {
    for (const event of tickEnemy(enemy, enemyCtx)) {
      session.events.push({ type: 'enemy-event', event })
      if (event.type === 'moth-bolt') {
        const projectile: Projectile = {
          id: session.nextEntityId,
          position: { ...event.from },
          direction: { ...event.direction },
          speed: event.speed,
          radius: event.radius,
          damage: event.damage,
          alive: true,
        }
        session.nextEntityId += 1
        session.projectiles.push(projectile)
        session.events.push({ type: 'projectile-spawn', projectile })
      }
    }
  }

  if (session.boss && session.boss.alive) {
    const bossEvents = tickBoss(session.boss, stage.boss, {
      playerPosition: session.player.position,
      playerAlive: session.player.alive,
      random: session.random,
      deltaTime: dt,
    })
    for (const event of bossEvents) session.events.push({ type: 'boss-event', event })
  }

  const artifactResult = tickArtifact(session.artifact, stage.sword, {
    owner: session.player.position,
    targets: swordTargets(session),
    deltaTime: dt,
  })
  if (artifactResult.fired) session.events.push({ type: 'sword-fired' })
  if (artifactResult.returnedToOwner) session.events.push({ type: 'sword-returned' })
  if (applySwordHits(session, stage, artifactResult.hits)) return

  if (session.boss && !session.boss.alive && session.phase === 'boss') {
    dropSouls(session, session.boss.position, stage.bossSoulAmount)
    settle(session)
    return
  }

  hurtPlayerFromEnemies(session, stage)
  hurtPlayerFromBoss(session, stage)
  tickProjectiles(session, stage, dt)
  recycleDeadEnemies(session, stage)

  if (!session.player.alive) {
    setPhase(session, 'defeated')
    session.events.push({ type: 'defeated' })
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd cocos-client && node --test tests/combatSession.test.mjs`
Expected: PASS. The flow test tolerates `drain`/`boss-entry` timing because the player may kill the last ordinary enemy before the 2s force-drain.

- [ ] **Step 6: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Battle/StageOneConfig.ts cocos-client/assets/Scripts/Core/Battle/BattleSession.ts cocos-client/tests/combatSession.test.mjs
git commit -m "feat: add stage one battle session orchestration"
```

---

## Task 10: 90-second seeded simulation test

Spec §13.2: full stage-one clear without Cocos nodes, boss entry around 60s, clear within 90s, enemy cap respected, same seed = repeatable. The dodge bot below is part of the test artifact and uses its own seeded RNG so runs stay deterministic.

**Files:**
- Test: `cocos-client/tests/combatSimulation.test.mjs`

- [ ] **Step 1: Write the simulation test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleSession, tickBattleSession } from '../assets/Scripts/Core/Battle/BattleSession.ts'
import { setMoveTarget } from '../assets/Scripts/Core/Battle/PlayerMotor.ts'
import { angleDiff, pointInFan, vecAngle } from '../assets/Scripts/Core/Battle/Geometry.ts'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'
import { STAGE_ONE } from '../assets/Scripts/Core/Battle/StageOneConfig.ts'

function dodgeTarget(session, botRandom) {
  const player = session.player.position
  const boss = session.boss
  if (boss && boss.alive) {
    if (boss.sweepFan && (boss.state === 'telegraph' || boss.state === 'attack') && pointInFan(player, boss.sweepFan)) {
      const escape = boss.sweepFan.directionRadians + (boss.sweepFan.halfAngleRadians + 0.6)
      return {
        x: boss.sweepFan.origin.x + Math.cos(escape) * 260,
        y: boss.sweepFan.origin.y + Math.sin(escape) * 260,
      }
    }
    for (const marker of boss.spikes) {
      if (marker.resolved || marker.erupted) continue
      if (Math.hypot(player.x - marker.position.x, player.y - marker.position.y) < marker.radius + 40) {
        return { x: marker.position.x + 180, y: player.y + botRandom.pick([-1, 1]) * 120 }
      }
    }
    if (boss.roarWave) {
      const wave = boss.roarWave
      const distance = Math.hypot(player.x - wave.center.x, player.y - wave.center.y)
      if (Math.abs(distance - wave.radius) < wave.bandWidth + 80) {
        return {
          x: wave.center.x + Math.cos(wave.gapCenterRadians) * Math.max(140, distance),
          y: wave.center.y + Math.sin(wave.gapCenterRadians) * Math.max(140, distance),
        }
      }
    }
  }
  for (const enemy of session.enemies) {
    if (!enemy.alive || enemy.state !== 'telegraph') continue
    if (Math.hypot(player.x - enemy.position.x, player.y - enemy.position.y) < 200) {
      return { x: player.x, y: player.y + (player.y > enemy.position.y ? 180 : -180) }
    }
  }
  return null
}

function nearestEnemyDistance(session) {
  let best = Infinity
  for (const enemy of session.enemies) {
    if (!enemy.alive) continue
    best = Math.min(best, Math.hypot(enemy.position.x - session.player.position.x, enemy.position.y - session.player.position.y))
  }
  return best
}

function runSimulation(seed) {
  const session = createBattleSession(STAGE_ONE, seed)
  const botRandom = createSeededRandom(seed * 1000 + 1)
  let thinkTimer = 0
  let bossEntryElapsed = null
  let clearedElapsed = null
  let maxAlive = 0
  const eventCounts = {}

  for (let tick = 0; tick < 120 * 60; tick += 1) {
    tickBattleSession(session, 1 / 60)
    for (const event of session.events.splice(0)) eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1
    if (bossEntryElapsed === null && (session.phase === 'boss-entry' || session.phase === 'boss')) {
      bossEntryElapsed = session.elapsed
    }
    maxAlive = Math.max(maxAlive, session.enemies.filter((enemy) => enemy.alive).length)

    thinkTimer -= 1 / 60
    if (thinkTimer <= 0 && session.player.alive) {
      thinkTimer = 0.2
      const dodge = dodgeTarget(session, botRandom)
      if (dodge) {
        setMoveTarget(session.player, dodge)
      } else if (nearestEnemyDistance(session) > 230) {
        setMoveTarget(session.player, {
          x: session.player.position.x + botRandom.range(40, 140),
          y: session.player.position.y + botRandom.range(-140, 140),
        })
      }
    }

    if (session.phase === 'cleared') {
      clearedElapsed = session.elapsed
      break
    }
    if (session.phase === 'defeated') break
  }

  return { session, bossEntryElapsed, clearedElapsed, maxAlive, eventCounts }
}

test('seeded bot clears stage one within 90 seconds with boss entry near 60s', () => {
  const result = runSimulation(7)
  assert.equal(result.session.phase, 'cleared')
  assert.ok(result.bossEntryElapsed !== null, 'boss entry should happen')
  assert.ok(result.bossEntryElapsed >= 55 && result.bossEntryElapsed <= 65, `boss entry at ${result.bossEntryElapsed}s`)
  assert.ok(result.clearedElapsed !== null && result.clearedElapsed <= 90, `cleared at ${result.clearedElapsed}s`)
  assert.ok(result.maxAlive <= 18)
  assert.ok(result.session.player.hp > 0, 'bot should survive')
})

test('same seed produces identical outcomes', () => {
  const a = runSimulation(11)
  const b = runSimulation(11)
  assert.deepEqual(
    { phase: a.session.phase, playerHp: a.session.player.hp, souls: a.session.souls.length, events: a.eventCounts },
    { phase: b.session.phase, playerHp: b.session.player.hp, souls: b.session.souls.length, events: b.eventCounts },
  )
})
```

- [ ] **Step 2: Run the simulation**

Run: `cd cocos-client && node --test tests/combatSimulation.test.mjs`
Expected: PASS. If it fails, tune **only** `StageOneConfig.ts` numbers (damage, hp, intervals, speed) and/or the bot dodge policy in this test file. Never weaken the assertions (90s clear, 55-65s boss entry, cap 18, survival, determinism). Typical knobs: boss `maxHp`, sword `damage`/`cooldownSeconds`, wolf `touchDamage`, bot think interval.

- [ ] **Step 3: Commit**

```bash
git add cocos-client/tests/combatSimulation.test.mjs
git commit -m "test: add seeded 90-second stage one simulation"
```

---

## Task 11: GrayboxBattleController — Cocos binding with placeholder visuals

One self-contained component builds the entire graybox battle at runtime (`Graphics` circles/polygons — no prefabs, no atlas, no scene edits beyond attaching it). It feeds touch input to `PlayerMotor`, ticks the session, and renders session state + telegraphs. Damage numbers are plain expiring labels for M1; object pools arrive with M3 (spec §12).

**Files:**
- Create: `cocos-client/assets/Scripts/Game/GrayboxBattleController.ts`
- Test: `cocos-client/tests/grayboxBattle.test.mjs`
- Modify: `cocos-client/docs/scene-assembly.md` (append graybox section)

- [ ] **Step 1: Write the failing contract test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('graybox controller wires the new battle core to cocos nodes', () => {
  const source = read('assets/Scripts/Game/GrayboxBattleController.ts')

  assert.match(source, /class GrayboxBattleController/)
  assert.match(source, /createBattleSession\(STAGE_ONE/)
  assert.match(source, /tickBattleSession\(this\.session, deltaTime\)/)
  assert.match(source, /Node\.EventType\.TOUCH_END/)
  assert.match(source, /convertToNodeSpaceAR/)
  assert.match(source, /setMoveTarget\(this\.session\.player/)
  assert.match(source, /requestSettleContinue/)
  assert.match(source, /Graphics/)
  assert.match(source, /update\(deltaTime: number\)/)
})

test('graybox controller renders telegraphs, settlement countdown, and defeat restart', () => {
  const source = read('assets/Scripts/Game/GrayboxBattleController.ts')

  assert.match(source, /drawTelegraphs/)
  assert.match(source, /sweepFan/)
  assert.match(source, /roarWave/)
  assert.match(source, /settleElapsed/)
  assert.match(source, /rebuildSession/)
  assert.match(source, /'settle'/)
  assert.match(source, /'defeated'/)
  assert.match(source, /'enemy-death'/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cocos-client && node --test tests/grayboxBattle.test.mjs`
Expected: FAIL, file not found.

- [ ] **Step 3: Implement `GrayboxBattleController.ts`**

```ts
import { _decorator, Button, Color, Component, EventTouch, Graphics, Label, Node, UITransform, Vec3 } from 'cc'
import { createBattleSession, requestSettleContinue, tickBattleSession, BattleSession } from '../Core/Battle/BattleSession'
import { FanSpec } from '../Core/Battle/Geometry'
import { setMoveTarget } from '../Core/Battle/PlayerMotor'
import { STAGE_ONE } from '../Core/Battle/StageOneConfig'

const { ccclass, property } = _decorator

const COLOR_BG = new Color(22, 33, 26, 255)
const COLOR_GROUND = new Color(46, 66, 52, 255)
const COLOR_PLAYER = new Color(126, 227, 192, 255)
const COLOR_PLAYER_HURT = new Color(240, 240, 240, 255)
const COLOR_WOLF = new Color(176, 136, 80, 255)
const COLOR_MOTH = new Color(159, 143, 255, 255)
const COLOR_BOSS = new Color(208, 90, 74, 255)
const COLOR_BOSS_ENRAGED = new Color(150, 40, 40, 255)
const COLOR_SWORD = new Color(190, 240, 255, 255)
const COLOR_SOUL = new Color(150, 220, 255, 255)
const COLOR_TELEGRAPH = new Color(220, 70, 60, 60)
const COLOR_TELEGRAPH_LINE = new Color(230, 90, 70, 200)
const COLOR_SAFE_GAP = new Color(120, 220, 140, 220)

const DESIGN_WIDTH = 750
const DESIGN_HEIGHT = 1334

interface FloatingText {
  node: Node
  ttl: number
}

@ccclass('GrayboxBattleController')
export class GrayboxBattleController extends Component {
  @property
  seed = 7

  private session: BattleSession = createBattleSession(STAGE_ONE, 7)
  private telegraphLayer: Graphics | null = null
  private hudLabel: Label | null = null
  private playerNode: Node | null = null
  private swordNode: Node | null = null
  private bossNode: Node | null = null
  private bossHpBar: Graphics | null = null
  private enemyNodes = new Map<number, Node>()
  private projectileNodes = new Map<number, Node>()
  private soulNodes = new Map<number, Node>()
  private floatingTexts: FloatingText[] = []
  private actorLayer: Node | null = null
  private effectLayer: Node | null = null
  private settlePanel: Node | null = null
  private settleCountdown: Label | null = null
  private settleResult: Label | null = null
  private defeatPanel: Node | null = null

  onLoad() {
    const area = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    area.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT)
    this.buildStaticScene()
    this.session = createBattleSession(STAGE_ONE, this.seed)
    this.node.on(Node.EventType.TOUCH_END, this.onBattleTouch, this)
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_END, this.onBattleTouch, this)
  }

  update(deltaTime: number) {
    tickBattleSession(this.session, deltaTime)
    for (const event of this.session.events.splice(0)) this.handleSessionEvent(event)
    this.syncScene()
  }

  rebuildSession() {
    for (const node of this.enemyNodes.values()) node.destroy()
    for (const node of this.projectileNodes.values()) node.destroy()
    for (const node of this.soulNodes.values()) node.destroy()
    for (const text of this.floatingTexts) text.node.destroy()
    this.enemyNodes.clear()
    this.projectileNodes.clear()
    this.soulNodes.clear()
    this.floatingTexts = []
    if (this.bossNode) {
      this.bossNode.destroy()
      this.bossNode = null
      this.bossHpBar = null
    }
    this.seed += 1
    this.session = createBattleSession(STAGE_ONE, this.seed)
    this.settlePanel?.active && (this.settlePanel.active = false)
    this.defeatPanel?.active && (this.defeatPanel.active = false)
  }

  private onBattleTouch(event: EventTouch) {
    const area = this.node.getComponent(UITransform)
    if (!area) return
    const ui = event.getUILocation()
    const local = area.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0))
    setMoveTarget(this.session.player, { x: local.x, y: local.y })
  }

  private makeLayer(name: string): Node {
    const layer = new Node(name)
    layer.layer = this.node.layer
    layer.setParent(this.node)
    return layer
  }

  private makeCircle(parent: Node, name: string, radius: number, color: Color): Node {
    const node = new Node(name)
    node.layer = this.node.layer
    node.setParent(parent)
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = color
    graphics.circle(0, 0, radius)
    graphics.fill()
    return node
  }

  private makeLabel(parent: Node, name: string, fontSize: number, color: Color): Label {
    const node = new Node(name)
    node.layer = this.node.layer
    node.setParent(parent)
    const label = node.addComponent(Label)
    label.fontSize = fontSize
    label.color = color
    label.string = ''
    return label
  }

  private buildStaticScene() {
    const background = new Node('GrayboxBackground')
    background.layer = this.node.layer
    background.setParent(this.node)
    const backgroundGraphics = background.addComponent(Graphics)
    backgroundGraphics.fillColor = COLOR_BG
    backgroundGraphics.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT)
    backgroundGraphics.fill()
    backgroundGraphics.fillColor = COLOR_GROUND
    backgroundGraphics.rect(-DESIGN_WIDTH / 2, STAGE_ONE.bounds.minY - 60, DESIGN_WIDTH, 120)
    backgroundGraphics.fill()

    const telegraphNode = this.makeLayer('TelegraphLayer')
    this.telegraphLayer = telegraphNode.addComponent(Graphics)

    this.makeLayer('DropLayer')
    this.actorLayer = this.makeLayer('ActorLayer')
    this.effectLayer = this.makeLayer('EffectLayer')

    this.playerNode = this.makeCircle(this.actorLayer, 'Player', STAGE_ONE.player.radius, COLOR_PLAYER)
    this.swordNode = this.makeCircle(this.effectLayer, 'FlyingSword', 10, COLOR_SWORD)
    this.swordNode.active = false

    const hudLayer = this.makeLayer('HudLayer')
    this.hudLabel = this.makeLabel(hudLayer, 'HudLabel', 28, Color.WHITE)
    this.hudLabel.node.setPosition(0, DESIGN_HEIGHT / 2 - 80, 0)

    this.settlePanel = this.buildSettlePanel()
    this.defeatPanel = this.buildDefeatPanel()
  }

  private buildSettlePanel(): Node {
    const panel = this.makeLayer('SettlePanel')
    const graphics = panel.addComponent(Graphics)
    graphics.fillColor = new Color(10, 18, 14, 210)
    graphics.roundRect(-260, -140, 520, 280, 18)
    graphics.fill()
    const title = this.makeLabel(panel, 'SettleTitle', 40, new Color(255, 235, 180, 255))
    title.string = `第${STAGE_ONE.id}关 ${STAGE_ONE.name} 突破`
    title.node.setPosition(0, 80, 0)
    this.settleResult = this.makeLabel(panel, 'SettleResult', 26, Color.WHITE)
    this.settleResult.node.setPosition(0, 20, 0)
    this.settleCountdown = this.makeLabel(panel, 'SettleCountdown', 26, new Color(180, 220, 255, 255))
    this.settleCountdown.node.setPosition(0, -30, 0)
    const buttonNode = new Node('ContinueButton')
    buttonNode.layer = this.node.layer
    buttonNode.setParent(panel)
    const buttonTransform = buttonNode.addComponent(UITransform)
    buttonTransform.setContentSize(220, 72)
    const buttonGraphics = buttonNode.addComponent(Graphics)
    buttonGraphics.fillColor = new Color(70, 130, 100, 255)
    buttonGraphics.roundRect(-110, -36, 220, 72, 12)
    buttonGraphics.fill()
    const button = buttonNode.addComponent(Button)
    const buttonLabel = this.makeLabel(buttonNode, 'ContinueLabel', 30, Color.WHITE)
    buttonLabel.string = '继续'
    buttonNode.setPosition(0, -90, 0)
    button.node.on(Button.EventType.CLICK, () => {
      requestSettleContinue(this.session)
    }, this)
    panel.active = false
    return panel
  }

  private buildDefeatPanel(): Node {
    const panel = this.makeLayer('DefeatPanel')
    const graphics = panel.addComponent(Graphics)
    graphics.fillColor = new Color(30, 12, 12, 220)
    graphics.roundRect(-260, -120, 520, 240, 18)
    graphics.fill()
    const title = this.makeLabel(panel, 'DefeatTitle', 40, new Color(255, 160, 150, 255))
    title.string = '挑战失败'
    title.node.setPosition(0, 60, 0)
    const buttonNode = new Node('RestartButton')
    buttonNode.layer = this.node.layer
    buttonNode.setParent(panel)
    const buttonTransform = buttonNode.addComponent(UITransform)
    buttonTransform.setContentSize(220, 72)
    const buttonGraphics = buttonNode.addComponent(Graphics)
    buttonGraphics.fillColor = new Color(130, 70, 70, 255)
    buttonGraphics.roundRect(-110, -36, 220, 72, 12)
    buttonGraphics.fill()
    const button = buttonNode.addComponent(Button)
    const buttonLabel = this.makeLabel(buttonNode, 'RestartLabel', 30, Color.WHITE)
    buttonLabel.string = '重新开始'
    buttonNode.setPosition(0, -50, 0)
    button.node.on(Button.EventType.CLICK, () => {
      this.rebuildSession()
    }, this)
    panel.active = false
    return panel
  }

  private handleSessionEvent(event: ReturnType<BattleSession['events']['slice']> extends never ? never : import('../Core/Battle/BattleSession').SessionEvent) {
    switch (event.type) {
      case 'enemy-spawn': {
        const color = event.enemy.kind === 'wolf' ? COLOR_WOLF : COLOR_MOTH
        const node = this.makeCircle(this.actorLayer ?? this.node, `Enemy${event.enemy.id}`, event.enemy.radius, color)
        this.enemyNodes.set(event.enemy.id, node)
        break
      }
      case 'enemy-recycled': {
        const node = this.enemyNodes.get(event.enemyId)
        if (node) node.destroy()
        this.enemyNodes.delete(event.enemyId)
        break
      }
      case 'enemy-damage':
        this.spawnFloatingText(event.position, `${event.amount}`, new Color(255, 230, 140, 255))
        break
      case 'boss-damage':
        this.spawnFloatingText(this.session.boss?.position ?? { x: 0, y: 0 }, `${event.amount}`, new Color(255, 200, 120, 255))
        break
      case 'projectile-spawn': {
        const node = this.makeCircle(this.effectLayer ?? this.node, `Bolt${event.projectile.id}`, event.projectile.radius, COLOR_MOTH)
        this.projectileNodes.set(event.projectile.id, node)
        break
      }
      case 'projectile-despawn': {
        const node = this.projectileNodes.get(event.id)
        if (node) node.destroy()
        this.projectileNodes.delete(event.id)
        break
      }
      case 'soul-drop': {
        const node = this.makeCircle(this.effectLayer ?? this.node, `Soul${event.soul.id}`, 8, COLOR_SOUL)
        node.setPosition(event.soul.position.x, event.soul.position.y, 0)
        this.soulNodes.set(event.soul.id, node)
        break
      }
      case 'settle':
        if (this.settlePanel) this.settlePanel.active = true
        break
      case 'cleared':
        if (this.settleResult) this.settleResult.string = '即将进入第二关（M1 灰盒占位）'
        break
      case 'defeated':
        if (this.defeatPanel) this.defeatPanel.active = true
        break
      default:
        break
    }
  }

  private spawnFloatingText(position: { x: number; y: number }, text: string, color: Color) {
    const label = this.makeLabel(this.effectLayer ?? this.node, 'DamageNumber', 26, color)
    label.string = text
    label.node.setPosition(position.x, position.y + 20, 0)
    this.floatingTexts.push({ node: label.node, ttl: 0.6 })
  }

  private syncScene() {
    const session = this.session
    if (this.playerNode) {
      this.playerNode.setPosition(session.player.position.x, session.player.position.y, 0)
      const graphics = this.playerNode.getComponent(Graphics)
      if (graphics) graphics.fillColor = session.player.hurtCooldownRemaining > 0 ? COLOR_PLAYER_HURT : COLOR_PLAYER
    }
    for (const enemy of session.enemies) {
      const node = this.enemyNodes.get(enemy.id)
      if (!node) continue
      node.setPosition(enemy.position.x, enemy.position.y, 0)
      node.active = enemy.alive
    }
    if (this.swordNode) {
      const sword = session.artifact.sword
      this.swordNode.active = Boolean(sword)
      if (sword) this.swordNode.setPosition(sword.position.x, sword.position.y, 0)
    }
    for (const projectile of session.projectiles) {
      const node = this.projectileNodes.get(projectile.id)
      if (node) node.setPosition(projectile.position.x, projectile.position.y, 0)
    }
    this.syncBoss()
    this.drawTelegraphs()
    this.syncHud()
    this.syncFloatingTexts()
  }

  private syncBoss() {
    const boss = this.session.boss
    if (!boss) return
    if (!this.bossNode && this.actorLayer) {
      this.bossNode = this.makeCircle(this.actorLayer, 'Boss', boss.radius, COLOR_BOSS)
      const barNode = new Node('BossHpBar')
      barNode.layer = this.node.layer
      barNode.setParent(this.bossNode)
      barNode.setPosition(0, boss.radius + 24, 0)
      this.bossHpBar = barNode.addComponent(Graphics)
    }
    if (!this.bossNode) return
    this.bossNode.setPosition(boss.position.x, boss.position.y, 0)
    this.bossNode.active = boss.alive
    const body = this.bossNode.getComponent(Graphics)
    if (body) body.fillColor = boss.phase === 2 ? COLOR_BOSS_ENRAGED : COLOR_BOSS
    if (this.bossHpBar) {
      this.bossHpBar.clear()
      this.bossHpBar.fillColor = new Color(60, 20, 20, 255)
      this.bossHpBar.rect(-70, -6, 140, 12)
      this.bossHpBar.fill()
      this.bossHpBar.fillColor = new Color(220, 80, 60, 255)
      this.bossHpBar.rect(-70, -6, 140 * (boss.hp / boss.maxHp), 12)
      this.bossHpBar.fill()
    }
  }

  private drawTelegraphs() {
    const graphics = this.telegraphLayer
    if (!graphics) return
    graphics.clear()
    graphics.lineWidth = 4
    const boss = this.session.boss
    if (!boss || !boss.alive) return

    if (boss.sweepFan && (boss.state === 'telegraph' || boss.state === 'attack')) {
      this.strokeFan(graphics, boss.sweepFan)
    }
    for (const marker of boss.spikes) {
      if (marker.resolved) continue
      graphics.strokeColor = COLOR_TELEGRAPH_LINE
      graphics.fillColor = marker.erupted ? new Color(240, 120, 60, 120) : COLOR_TELEGRAPH
      graphics.circle(marker.position.x, marker.position.y, marker.radius)
      graphics.fill()
      graphics.stroke()
    }
    if (boss.state === 'telegraph' && boss.currentSkill === 'mountain-roar') {
      this.strokeRingWithGap(graphics, boss.position, 120, 200, boss.roarGapRadians, 0.55)
    }
    if (boss.roarWave) {
      this.strokeRingWithGap(
        graphics,
        boss.roarWave.center,
        Math.max(1, boss.roarWave.radius - boss.roarWave.bandWidth / 2),
        boss.roarWave.radius + boss.roarWave.bandWidth / 2,
        boss.roarWave.gapCenterRadians,
        boss.roarWave.gapHalfAngleRadians,
      )
    }
  }

  private strokeFan(graphics: Graphics, fan: FanSpec) {
    graphics.fillColor = COLOR_TELEGRAPH
    graphics.strokeColor = COLOR_TELEGRAPH_LINE
    graphics.moveTo(fan.origin.x, fan.origin.y)
    const steps = 20
    for (let index = 0; index <= steps; index += 1) {
      const angle = fan.directionRadians - fan.halfAngleRadians + (2 * fan.halfAngleRadians * index) / steps
      graphics.lineTo(fan.origin.x + Math.cos(angle) * fan.radius, fan.origin.y + Math.sin(angle) * fan.radius)
    }
    graphics.lineTo(fan.origin.x, fan.origin.y)
    graphics.fill()
    graphics.stroke()
  }

  private strokeRingWithGap(graphics: Graphics, center: { x: number; y: number }, inner: number, outer: number, gapCenter: number, gapHalf: number) {
    graphics.strokeColor = COLOR_TELEGRAPH_LINE
    graphics.arc(center.x, center.y, outer, gapCenter + gapHalf, gapCenter - gapHalf + Math.PI * 2, false)
    graphics.stroke()
    graphics.arc(center.x, center.y, inner, gapCenter + gapHalf, gapCenter - gapHalf + Math.PI * 2, false)
    graphics.stroke()
    graphics.strokeColor = COLOR_SAFE_GAP
    graphics.arc(center.x, center.y, (inner + outer) / 2, gapCenter - gapHalf, gapCenter + gapHalf, false)
    graphics.stroke()
  }

  private syncHud() {
    if (!this.hudLabel) return
    const session = this.session
    const bossText = session.boss && session.boss.alive ? ` Boss ${session.boss.hp}/${session.boss.maxHp}` : ''
    this.hudLabel.string = `${STAGE_ONE.name} ${session.phase} ${session.elapsed.toFixed(1)}s  生命 ${session.player.hp}/${session.player.maxHp}  灵魂 ${session.souls.length}${bossText}`
  }

  private syncFloatingTexts() {
    const survivors: FloatingText[] = []
    for (const text of this.floatingTexts) {
      text.ttl -= 1 / 60
      text.node.setPosition(text.node.position.x, text.node.position.y + 1.2, 0)
      if (text.ttl > 0) {
        survivors.push(text)
      } else {
        text.node.destroy()
      }
    }
    this.floatingTexts = survivors
  }
}
```

Typing note: the `handleSessionEvent` parameter type should simply be `SessionEvent` imported as a type:

```ts
import { createBattleSession, requestSettleContinue, tickBattleSession, BattleSession, SessionEvent } from '../Core/Battle/BattleSession'
```

and the signature `private handleSessionEvent(event: SessionEvent)`. (The convoluted conditional type in the code block above is wrong — use this plain import. If the executor pastes the plain import and deletes the conditional type, everything type-checks.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cocos-client && node --test tests/grayboxBattle.test.mjs`
Expected: PASS.

- [ ] **Step 5: Append the graybox section to `docs/scene-assembly.md`**

Append exactly:

```markdown

## 灰盒战斗（M1）

M1 阶段用 `GrayboxBattleController` 跑新战斗核心，画面全部是 Graphics 占位图形，不需要预制体和图集。

1. 在 `Canvas` 下新建空节点 `GrayboxBattle`。
2. 挂 `GrayboxBattleController` 组件，`seed` 默认 `7`。
3. 运行时组件自建背景、角色、怪物、Boss、预警、飞剑、HUD、结算与失败面板，无需拖字段。
4. 灰盒验证期间把旧的 `BattleRoot` 节点设为 inactive，避免旧战斗线同时驱动。
5. 触屏/点击战斗区域即移动；击败 Boss 出结算，3 秒倒计时与「继续」按钮只触发一次；失败面板「重新开始」以新 seed 重建会话。
```

- [ ] **Step 6: Commit**

```bash
git add cocos-client/assets/Scripts/Game/GrayboxBattleController.ts cocos-client/tests/grayboxBattle.test.mjs cocos-client/docs/scene-assembly.md
git commit -m "feat: add graybox battle controller for stage one core"
```

---

## Task 12: Full verification and cleanup

**Files:** none modified beyond verification.

- [ ] **Step 1: Run the entire test suite (old + new)**

Run: `cd cocos-client && node --test tests/*.test.mjs`
Expected: all PASS, including the pre-existing old-battle tests (they are untouched) and the 10 new combat test files.

- [ ] **Step 2: Run the build readiness check**

Run: `cd cocos-client && npm run build:check`
Expected: exit 0. This validates the Cocos project structure still parses; the new core/controller are additive.

- [ ] **Step 3: Review the change set**

Run: `git status && git log --oneline -15`
Expected: only the files listed in this plan; one commit per task; no stray edits to old battle files.

- [ ] **Step 4: Final commit (only if anything is left uncommitted)**

```bash
git add -A
git commit -m "chore: verify combat graybox suite"
```

---

## Spec coverage map (self-review)

| Spec requirement (§) | Where it lands |
| --- | --- |
| §4.3 full-screen movement, no teleport/jitter, actions never move the player | Task 4 (`PlayerMotor`, bounds ±330/-420..460), Task 6 test (damage keeps target) |
| §6.1 data-driven FSM + hurt/interrupted/death branches | Task 5 (`EnemyBrain`), Task 8 (boss states) |
| §6.1 AI 8-10Hz staggered decisions, per-frame movement | Task 5 (`decisionHz` 8/9, per-frame dashes), Task 8 boss |
| §6.2 wolf flank/crouch/pounce/whiff-stop | Task 5 (`choosePost` flank, telegraph crouch, `whiffRecoverySeconds`) |
| §6.3 moth altitude band, separation, dive/bolt rotation | Task 5 (`altitudeMin/Max`, `minSeparation`, `nextMothAttack`) |
| §7.1 fan sweep with telegraph + recovery | Task 8 (`sweep`, `sweepHitsPlayer`) |
| §7.2 three sequential delayed markers | Task 8 (`spikes`, `markerDelay`) |
| §7.3 ring roar with safe gap | Task 8 (`roar`, `roarHitsPlayer` gap) |
| §7.4 phase two pairs skills, telegraphs unchanged | Task 8 (`queuedSkill`, phase-two test) |
| §8.1 curved pierce sword, return re-hit, nearest targeting | Task 7 (`ArtifactRuntime`) |
| §3 pacing 0-15/15-40/40-60/60-90 | Task 9 (`waves`, `bossEntryTime` 58, drain) |
| §12 max 18 active enemies | Task 9 (`maxAliveEnemies`, cap test) |
| §3.4 settlement, 3s auto-continue, fires once | Task 9 (`settle`, `requestSettleContinue` idempotency test) |
| §10 pure-TS core, single authoritative implementation | Tasks 1-9 (no `tools/*.mjs` mirror; direct TS imports proven in Task 1) |
| §11 non-finite rejection keeps last valid state | Task 4 (non-finite target/delta tests) |
| §13.1 unit tests listed | Tasks 4-9 test files (movement, no-teleport, sword behavior, legal transitions, attack frames, boss skills, phase two, settle/defeat idempotency, settle race) |
| §13.2 90s simulation, seeded repeatability | Task 10 |
| §13.5/§13.6 device + agent acceptance | Out of scope for M1 (M5); graybox controller (Task 11) is the in-editor smoke target |

**M1 done definition:** all tasks committed, full suite green, `build:check` green, and in the Cocos editor the `GrayboxBattle` node auto-plays stage one to settlement with placeholders. M2 (art) can then replace graybox nodes with the real sprite pipeline without touching the core.

