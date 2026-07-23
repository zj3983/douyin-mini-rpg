import type { BattleRect, Point2 } from './CombatTypes.ts'
import {
  beginSwordReturn,
  createHomingSword,
  recordGeometricSwordHits,
  snapshotLivingSwordTargets,
  stepHomingSwordCast,
} from '../Core/HomingSwordRuntime.ts'
import type { HomingSwordState, HomingSwordTarget } from '../Core/HomingSwordRuntime.ts'

export interface ArtifactContext {
  now: number
  ownerPosition: Point2
  targets: readonly { id: string; position: Point2; alive: boolean }[]
  battleBounds: BattleRect
}

export type ArtifactCommand =
  | { type: 'animate-owner'; action: 'hand_seal' | 'cast' }
  | { type: 'spawn-sword'; pathId: string; origin: Point2; targetId: string }
  | { type: 'move-sword'; pathId: string; from: Point2; to: Point2; phase: 'outbound' | 'orbit' | 'returning' }
  | { type: 'resolve-sword-hit'; pathId: string; targetId: string; phase: 'outbound' | 'orbit' | 'returning' }
  | { type: 'despawn-sword'; pathId: string }

export interface ArtifactRuntime {
  artifactId: 'flying-sword'
  level: number
  ownerId: string
  generation: number
  cooldownLeft: number
  activePaths: Map<string, unknown>
}

type SwordPhase = 'outbound' | 'orbit' | 'returning'

interface FlyingSwordPath {
  pathId: string
  state: HomingSwordState
  phase: SwordPhase
  targetId: string
  orbitCenter: Point2
  orbitAngle: number
  orbitRemaining: number
  orbitRadius: number
}

interface MutableArtifactRuntime extends ArtifactRuntime {
  activePaths: Map<string, FlyingSwordPath>
  nextPathId: number
}

const DEFAULT_COOLDOWN_SECONDS = 1.15
const SWORD_HIT_RADIUS = 52
const RETURNING_SWORD_HIT_RADIUS = 128
const SWORD_SPEED = 760
const SWORD_TURN_RADIANS = 7
const SWORD_DISTANCE = 260
const SWORD_RETURN_RADIUS = 22
const ORBIT_SECONDS = 0.42
const ORBIT_RADIUS = 92
const FLOOR_CLEARANCE = 38

function finitePoint(value: Point2 | null | undefined): Point2 {
  return {
    x: Number.isFinite(value?.x) ? value.x : 0,
    y: Number.isFinite(value?.y) ? value.y : 0,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clampPoint(point: Point2, bounds: BattleRect): Point2 {
  return {
    x: clamp(point.x, bounds.minX, bounds.maxX),
    y: clamp(point.y, bounds.minY + FLOOR_CLEARANCE, bounds.maxY),
  }
}

function levelTier(level: number): 0 | 1 | 2 | 3 {
  if (level >= 18) return 3
  if (level >= 12) return 2
  if (level >= 6) return 1
  return 0
}

function pathCountForLevel(level: number): number {
  const tier = levelTier(level)
  if (tier === 3) return 5
  if (tier >= 1) return 3
  return 1
}

function normalizeLevel(level: number): number {
  return Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1
}

function commandPoint(point: Point2): Point2 {
  return { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000 }
}

function distanceToSegment(point: Point2, from: Point2, to: Point2): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-9) return Math.hypot(point.x - from.x, point.y - from.y)
  const ratio = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared, 0, 1)
  return Math.hypot(point.x - (from.x + dx * ratio), point.y - (from.y + dy * ratio))
}

function livingTargets(context: ArtifactContext): HomingSwordTarget[] {
  return snapshotLivingSwordTargets([...context.targets])
}

function nearestTargets(ownerPosition: Point2, targets: HomingSwordTarget[], count: number): HomingSwordTarget[] {
  const sorted = [...targets].sort((left, right) => {
    const leftDistance = (left.position.x - ownerPosition.x) ** 2 + (left.position.y - ownerPosition.y) ** 2
    const rightDistance = (right.position.x - ownerPosition.x) ** 2 + (right.position.y - ownerPosition.y) ** 2
    return leftDistance - rightDistance || left.id.localeCompare(right.id)
  })
  if (sorted.length === 0) return []
  const selected: HomingSwordTarget[] = []
  for (let index = 0; index < count; index += 1) selected.push(sorted[index % sorted.length])
  return selected
}

function formationOffset(index: number, count: number): Point2 {
  if (count === 1) return { x: 0, y: 0 }
  const middle = (count - 1) / 2
  return { x: -Math.abs(index - middle) * 14, y: (index - middle) * 34 }
}

function createPath(
  runtime: MutableArtifactRuntime,
  ownerPosition: Point2,
  target: HomingSwordTarget,
  index: number,
  count: number,
): FlyingSwordPath {
  const offset = formationOffset(index, count)
  const origin = { x: ownerPosition.x + offset.x, y: ownerPosition.y + offset.y }
  const directionBias = count === 1 ? 70 : 92 + Math.abs(offset.y)
  const initialDirection = {
    x: Math.max(24, target.position.x - origin.x),
    y: target.position.y >= origin.y ? directionBias : -directionBias * 0.55,
  }
  const state = createHomingSword(origin, initialDirection, {
    speed: SWORD_SPEED,
    maxTurnRadians: SWORD_TURN_RADIANS,
    maxOutboundDistance: SWORD_DISTANCE + Math.abs(offset.y) * 0.8,
    returnRadius: SWORD_RETURN_RADIUS,
  })
  state.targetId = target.id
  const pathId = `${runtime.ownerId}-sword-${runtime.generation}-${runtime.nextPathId}`
  runtime.nextPathId += 1
  return {
    pathId,
    state,
    phase: 'outbound',
    targetId: target.id,
    orbitCenter: { ...target.position },
    orbitAngle: index * Math.PI * 0.32,
    orbitRemaining: 0,
    orbitRadius: ORBIT_RADIUS + Math.abs(offset.y) * 0.2,
  }
}

function spawnPaths(runtime: MutableArtifactRuntime, context: ArtifactContext): ArtifactCommand[] {
  const targets = nearestTargets(context.ownerPosition, livingTargets(context), pathCountForLevel(runtime.level))
  if (targets.length === 0) return []

  const commands: ArtifactCommand[] = [{ type: 'animate-owner', action: 'hand_seal' }]
  const count = pathCountForLevel(runtime.level)
  for (let index = 0; index < count; index += 1) {
    const path = createPath(runtime, finitePoint(context.ownerPosition), targets[index % targets.length], index, count)
    runtime.activePaths.set(path.pathId, path)
    commands.push({
      type: 'spawn-sword',
      pathId: path.pathId,
      origin: commandPoint(path.state.position),
      targetId: path.targetId,
    })
  }
  runtime.cooldownLeft = DEFAULT_COOLDOWN_SECONDS
  return commands
}

function resolveHits(path: FlyingSwordPath, targets: HomingSwordTarget[], from: Point2, to: Point2, phase: SwordPhase): ArtifactCommand[] {
  const radius = phase === 'returning' ? RETURNING_SWORD_HIT_RADIUS : SWORD_HIT_RADIUS
  const ids = targets
    .filter((target) => distanceToSegment(target.position, from, to) <= radius)
    .map((target) => target.id)
  return recordGeometricSwordHits(path.state, ids, phase)
    .map((targetId) => ({ type: 'resolve-sword-hit', pathId: path.pathId, targetId, phase }))
}

function stepOrbit(path: FlyingSwordPath, context: ArtifactContext, deltaSeconds: number): ArtifactCommand[] {
  const from = { ...path.state.position }
  path.orbitRemaining = Math.max(0, path.orbitRemaining - deltaSeconds)
  path.orbitAngle += Math.PI * 3.1 * deltaSeconds
  const center = clampPoint(path.orbitCenter, context.battleBounds)
  path.state.position = clampPoint({
    x: center.x + Math.cos(path.orbitAngle) * path.orbitRadius,
    y: center.y + Math.sin(path.orbitAngle) * path.orbitRadius * 0.48,
  }, context.battleBounds)
  const to = { ...path.state.position }
  const commands: ArtifactCommand[] = [{
    type: 'move-sword',
    pathId: path.pathId,
    from: commandPoint(from),
    to: commandPoint(to),
    phase: 'orbit',
  }]
  commands.push(...resolveHits(path, livingTargets(context), from, to, 'orbit'))
  if (path.orbitRemaining <= 0) {
    path.phase = 'returning'
    beginSwordReturn(path.state)
  }
  return commands
}

function stepPath(
  runtime: MutableArtifactRuntime,
  path: FlyingSwordPath,
  context: ArtifactContext,
  deltaSeconds: number,
): ArtifactCommand[] {
  if (path.phase === 'orbit') return stepOrbit(path, context, deltaSeconds)

  const targets = livingTargets(context)
  const frame = stepHomingSwordCast(path.state, deltaSeconds, targets, finitePoint(context.ownerPosition))
  const phase = frame.step.previousPhase === 'returning' ? 'returning' : 'outbound'
  const from = commandPoint(clampPoint(frame.step.previousPosition, context.battleBounds))
  const to = commandPoint(clampPoint(frame.step.nextPosition, context.battleBounds))
  path.state.position = { ...to }

  const commands: ArtifactCommand[] = [{ type: 'move-sword', pathId: path.pathId, from, to, phase }]
  commands.push(...resolveHits(path, targets, from, to, phase))

  if (phase === 'outbound' && frame.step.nextPhase === 'returning' && levelTier(runtime.level) >= 2) {
    path.phase = 'orbit'
    path.orbitRemaining = ORBIT_SECONDS
    const locked = targets.find((target) => target.id === (frame.step.nextTargetId ?? path.targetId))
    path.orbitCenter = locked ? { ...locked.position } : { ...path.state.position }
    return commands
  }
  if (phase === 'outbound' && frame.step.nextPhase === 'returning') {
    commands.push(...resolveHits(path, targets, from, to, 'returning'))
  }
  if (frame.step.nextPhase === 'returning') path.phase = 'returning'
  if (frame.step.nextPhase === 'finished') {
    runtime.activePaths.delete(path.pathId)
    commands.push({ type: 'despawn-sword', pathId: path.pathId })
  }
  return commands
}

export function createArtifactRuntime(input: {
  artifactId: 'flying-sword'
  level: number
  ownerId: string
}): ArtifactRuntime {
  if (input.artifactId !== 'flying-sword') throw new TypeError('artifactId must be flying-sword')
  if (typeof input.ownerId !== 'string' || input.ownerId.trim() === '') throw new TypeError('ownerId is required')
  return {
    artifactId: 'flying-sword',
    level: normalizeLevel(input.level),
    ownerId: input.ownerId,
    generation: 1,
    cooldownLeft: 0,
    activePaths: new Map(),
    nextPathId: 1,
  } as MutableArtifactRuntime
}

export function stepArtifact(
  runtime: ArtifactRuntime,
  context: ArtifactContext,
  deltaSeconds: number,
): ArtifactCommand[] {
  const state = runtime as MutableArtifactRuntime
  if (state.artifactId !== 'flying-sword' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return []

  const commands: ArtifactCommand[] = []
  state.cooldownLeft = Math.max(0, state.cooldownLeft - deltaSeconds)
  if (state.activePaths.size === 0 && state.cooldownLeft <= 0) commands.push(...spawnPaths(state, context))
  const activePaths: FlyingSwordPath[] = []
  state.activePaths.forEach((path) => activePaths.push(path))
  for (const path of activePaths) {
    commands.push(...stepPath(state, path, context, Math.min(deltaSeconds, 0.1)))
  }
  if (commands.some((command) => command.type === 'spawn-sword')) {
    commands.splice(1, 0, { type: 'animate-owner', action: 'cast' })
  }
  return commands
}

export function setArtifactLevel(runtime: ArtifactRuntime, level: number): void {
  runtime.level = normalizeLevel(level)
}

export function resetArtifact(runtime: ArtifactRuntime, generation: number): void {
  if (!Number.isSafeInteger(generation) || generation <= runtime.generation) return
  const state = runtime as MutableArtifactRuntime
  state.generation = generation
  state.cooldownLeft = 0
  state.activePaths.clear()
}
