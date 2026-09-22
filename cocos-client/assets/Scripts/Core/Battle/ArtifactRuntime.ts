import {
  distancePointToSegment,
  quadBezierLength,
  quadBezierPoint,
  vecAdd,
  vecDistance,
  vecNormalize,
  vecScale,
  vecSub,
} from './Geometry.ts'
import type { Vec2 } from './Geometry.ts'

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
