import { _decorator, Color, Component, Graphics, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc'
import { BOSS_HAZARD_POOL_CAPACITY } from '../Combat/BossBrain.ts'
import type { EnemyCommand } from '../Combat/EnemyBrain.ts'
import type { VfxQuality } from '../Combat/PerformanceBudget.ts'
import {
  bossVfxPhase,
  resolveBossTelegraphVisual,
  type BossTelegraphVisualProfile,
  type BossVfxPhaseOutput,
} from '../Core/BossTelegraphVisualProfile.ts'
import { BossHazardVisualController } from './BossHazardVisualController'
import type { EnemyTelegraphDelivery } from './EnemyCombatResolverAdapter.ts'
import { NodePoolController } from './NodePoolController'

const { ccclass, property } = _decorator

export { BOSS_HAZARD_POOL_CAPACITY }

export class BossHazardPoolInvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BossHazardPoolInvariantError'
  }
}

type ActiveHitboxCommand = Extract<EnemyCommand, { readonly type: 'activate-hitbox' }>

interface CachedVisualLayers {
  readonly controller: BossHazardVisualController | null
  readonly mainShape: Sprite | null
  readonly accent: Sprite | null
  readonly particleNear: Sprite | null
  readonly particleFar: Sprite | null
}

interface PreparedVisualNode extends CachedVisualLayers {
  readonly graphics: Graphics | null
}

interface CachedVisualColors {
  readonly mainColor: Color
  readonly accentColor: Color
  readonly particleNearColor: Color
  readonly particleFarColor: Color
}

interface TelegraphVisual extends PreparedVisualNode, CachedVisualColors {
  readonly node: Node
  readonly duration: number
  readonly profile: BossTelegraphVisualProfile
  readonly quality: VfxQuality
  readonly phase: BossVfxPhaseOutput
  remaining: number
}

interface PendingActivation {
  readonly command: ActiveHitboxCommand
  readonly quality: VfxQuality
}

interface TelegraphGroup {
  readonly generation: number
  readonly enemyId: number
  readonly authorityId: string
  readonly visuals: TelegraphVisual[]
  readonly pending: PendingActivation[]
}

interface ImpactVisual extends PreparedVisualNode, CachedVisualColors {
  readonly node: Node
  readonly generation: number
  readonly enemyId: number
  readonly duration: number
  readonly profile: BossTelegraphVisualProfile
  readonly quality: VfxQuality
  readonly phase: BossVfxPhaseOutput
  fresh: boolean
  remaining: number
}

type ProfileColor = BossTelegraphVisualProfile['spirit']

const BOSS_VFX_RESOURCE_PATHS = (() => {
  const paths: string[] = []
  const seen = new Set<string>()
  for (const kind of ['sweep', 'spike', 'roar-sector'] as const) {
    const profile = resolveBossTelegraphVisual({ kind })
    for (const path of [profile.resources.main, profile.resources.accent, profile.resources.particle]) {
      if (seen.has(path)) continue
      seen.add(path)
      paths.push(path)
    }
  }
  return Object.freeze(paths)
})()

function createPhaseOutput(): BossVfxPhaseOutput {
  return { progress: 0, phase: 'warning', intensity: 0, travel: 0 }
}

function createVisualColors(color: ProfileColor): CachedVisualColors {
  return {
    mainColor: new Color(...color),
    accentColor: new Color(...color),
    particleNearColor: new Color(...color),
    particleFarColor: new Color(...color),
  }
}

function setLayerVisibility(sprite: Sprite | null, visible: boolean): void {
  if (!sprite) return
  sprite.enabled = visible
  sprite.node.active = visible
}

function setLayerColor(
  sprite: Sprite | null,
  target: Color,
  source: ProfileColor,
  alphaScale: number,
): void {
  if (!sprite) return
  target.set(source[0], source[1], source[2], Math.round(source[3] * alphaScale))
  sprite.color = target
}

function authorityKey(generation: number, enemyId: number, authorityId: string): string {
  return `${generation}\u0000${enemyId}\u0000${authorityId}`
}

function commandAuthority(command: ActiveHitboxCommand): string {
  return command.telegraphId ?? command.attackId
}

function centerAndSize(area: EnemyTelegraphDelivery['area'] | ActiveHitboxCommand['area']) {
  return {
    x: (area.minX + area.maxX) * 0.5,
    y: (area.minY + area.maxY) * 0.5,
    width: area.maxX - area.minX,
    height: area.maxY - area.minY,
  }
}

function dangerKindForAttack(attackId: string): string {
  if (attackId.startsWith('ground-spikes:')) return 'spike'
  if (attackId.startsWith('mountain-roar:')) return 'roar-sector'
  return 'sweep'
}

function drawBrokenRail(graphics: Graphics, minX: number, maxX: number, y: number): void {
  const width = maxX - minX
  graphics.moveTo(minX, y)
  graphics.lineTo(minX + width * 0.38, y)
  graphics.moveTo(minX + width * 0.55, y)
  graphics.lineTo(maxX, y)
}

@ccclass('BossTelegraphPresenter')
export class BossTelegraphPresenter extends Component {
  @property(NodePoolController)
  telegraphPool: NodePoolController | null = null

  private generation = 0
  private readonly groups = new Map<string, TelegraphGroup>()
  private readonly impacts: ImpactVisual[] = []
  private readonly earlyActivations = new Map<string, PendingActivation[]>()
  private readonly activatedAuthorities = new Set<string>()
  private readonly vfxFrames = new Map<string, SpriteFrame>()
  private destroyed = false
  private preloadStarted = false
  private loadGeneration = 0

  onLoad(): void {
    if (this.destroyed || this.preloadStarted || !this.isValid || !this.node?.isValid) return
    this.preloadStarted = true
    const loadGeneration = ++this.loadGeneration
    for (const path of BOSS_VFX_RESOURCE_PATHS) {
      resources.load(path, SpriteFrame, (error, frame) => {
        if (error || !(frame instanceof SpriteFrame)) return
        if (
          this.destroyed
          || loadGeneration !== this.loadGeneration
          || !this.isValid
          || !this.node?.isValid
        ) {
          frame.addRef()
          frame.decRef(true)
          return
        }
        const previousFrame = this.vfxFrames.get(path)
        frame.addRef()
        this.vfxFrames.set(path, frame)
        previousFrame?.decRef(true)
      })
    }
  }

  get visibleTelegraphCount(): number {
    let count = 0
    for (const group of this.groups.values()) count += group.visuals.length
    return count
  }

  get visibleImpactCount(): number {
    return this.impacts.length
  }

  onDisable(): void {
    this.hideAll()
  }

  onDestroy(): void {
    this.destroyed = true
    this.loadGeneration += 1
    this.hideAll()
    for (const frame of this.vfxFrames.values()) frame.decRef(true)
    this.vfxFrames.clear()
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return
    for (let index = this.impacts.length - 1; index >= 0; index -= 1) {
      const impact = this.impacts[index]
      if (impact.fresh) {
        impact.fresh = false
        continue
      }
      impact.remaining -= deltaSeconds
      if (impact.remaining <= 1e-9) this.removeImpact(index)
    }

    for (const group of this.groups.values()) {
      let ready = group.pending.length > 0
      for (const visual of group.visuals) {
        visual.remaining -= deltaSeconds
        this.updateTelegraphPhase(visual)
        if (visual.remaining > 1e-9) ready = false
      }
      if (ready) this.activateGroup(group)
    }
  }

  present(delivery: EnemyTelegraphDelivery, quality: VfxQuality = 'full'): boolean {
    if (this.destroyed || !this.isValid || !this.node?.isValid) return false
    if (delivery.generation < this.generation) return false
    if (delivery.generation > this.generation) this.resetGeneration(delivery.generation)
    const node = this.acquireHazardNode(delivery.attackId)
    const profile = resolveBossTelegraphVisual(delivery.danger)
    const phase = createPhaseOutput()
    const colors = createVisualColors(profile.spirit)
    const layers = this.drawTelegraph(node, delivery.area, profile, quality)
    const visual: TelegraphVisual = {
      node,
      duration: delivery.duration,
      profile,
      quality,
      phase,
      remaining: delivery.duration,
      ...layers,
      ...colors,
    }
    this.updateTelegraphPhase(visual)
    this.telegraphPool?.activateNode(node)

    const key = authorityKey(delivery.generation, delivery.enemyId, delivery.telegraphId)
    let group = this.groups.get(key)
    if (!group) {
      group = {
        generation: delivery.generation,
        enemyId: delivery.enemyId,
        authorityId: delivery.telegraphId,
        visuals: [],
        pending: this.earlyActivations.get(key) ?? [],
      }
      this.earlyActivations.delete(key)
      this.groups.set(key, group)
    }
    group.visuals.push(visual)
    return true
  }

  activate(generation: number, enemyId: number, command: ActiveHitboxCommand, quality: VfxQuality = 'full'): void {
    if (generation !== this.generation) return
    const key = authorityKey(generation, enemyId, commandAuthority(command))
    const group = this.groups.get(key)
    if (!group) {
      if (this.activatedAuthorities.has(key)) {
        this.showImpact(generation, enemyId, command, quality)
        return
      }
      const pending = this.earlyActivations.get(key) ?? []
      pending.push({ command, quality })
      this.earlyActivations.set(key, pending)
      return
    }
    if (group.visuals.some((visual) => visual.remaining > 1e-9)) {
      group.pending.push({ command, quality })
      return
    }
    group.pending.push({ command, quality })
    this.activateGroup(group)
  }

  recoverEnemy(generation: number, enemyId: number): void {
    if (generation !== this.generation) return
    for (const [key, group] of this.groups) {
      if (group.enemyId !== enemyId || group.pending.length > 0) continue
      if (group.visuals.every((visual) => visual.remaining <= 1e-9)) this.removeGroup(key, group)
    }
  }

  cancelEnemy(generation: number, enemyId: number): void {
    if (generation !== this.generation) return
    for (const [key, group] of this.groups) {
      if (group.enemyId === enemyId) this.removeGroup(key, group)
    }
    for (const key of this.earlyActivations.keys()) {
      if (key.startsWith(`${generation}\u0000${enemyId}\u0000`)) this.earlyActivations.delete(key)
    }
    for (const key of this.activatedAuthorities) {
      if (key.startsWith(`${generation}\u0000${enemyId}\u0000`)) this.activatedAuthorities.delete(key)
    }
    for (let index = this.impacts.length - 1; index >= 0; index -= 1) {
      if (this.impacts[index].enemyId === enemyId) this.removeImpact(index)
    }
  }

  resetGeneration(generation: number): void {
    if (!Number.isSafeInteger(generation) || generation <= 0 || generation < this.generation) return
    this.hideAll()
    this.generation = generation
  }

  hideAll(): void {
    for (const [key, group] of this.groups) this.removeGroup(key, group)
    for (let index = this.impacts.length - 1; index >= 0; index -= 1) this.removeImpact(index)
    this.earlyActivations.clear()
    this.activatedAuthorities.clear()
  }

  private activateGroup(group: TelegraphGroup): void {
    const key = authorityKey(group.generation, group.enemyId, group.authorityId)
    this.activatedAuthorities.add(key)
    this.removeGroup(key, group)
    for (const pending of group.pending) {
      this.showImpact(group.generation, group.enemyId, pending.command, pending.quality)
    }
  }

  private acquireHazardNode(attackId: string): Node {
    const pool = this.telegraphPool
    if (!pool) throw new BossHazardPoolInvariantError('Boss hazard pool invariant: presenter has no configured pool')
    if (pool.capacity < BOSS_HAZARD_POOL_CAPACITY) {
      throw new BossHazardPoolInvariantError(
        `Boss hazard pool invariant: configured capacity ${pool.capacity} is below required ${BOSS_HAZARD_POOL_CAPACITY}`,
      )
    }
    let node = pool.spawn(false)
    if (!node) {
      for (let index = this.impacts.length - 1; index >= 0; index -= 1) {
        if (!this.impacts[index].fresh && this.impacts[index].remaining <= 1e-9) this.removeImpact(index)
      }
      node = pool.spawn(false)
    }
    if (!node) {
      throw new BossHazardPoolInvariantError(
        `Boss hazard pool invariant: exhausted ${pool.capacity} nodes for ${attackId}; telegraphs=${this.visibleTelegraphCount}, impacts=${this.visibleImpactCount}`,
      )
    }
    return node
  }

  private showImpact(
    generation: number,
    enemyId: number,
    command: ActiveHitboxCommand,
    quality: VfxQuality,
  ): void {
    const node = this.acquireHazardNode(command.attackId)
    const danger = command.danger ?? { kind: dangerKindForAttack(command.attackId) }
    const profile = resolveBossTelegraphVisual(danger)
    const phase = createPhaseOutput()
    bossVfxPhase(command.duration, 0, phase)
    const colors = createVisualColors(profile.impact)
    const layers = this.drawImpact(node, command.area, profile, quality)
    const impact: ImpactVisual = {
      node,
      generation,
      enemyId,
      duration: command.duration,
      profile,
      quality,
      phase,
      fresh: true,
      remaining: command.duration,
      ...layers,
      ...colors,
    }
    this.applyLayerColors(impact, profile.impact, 1)
    this.telegraphPool?.activateNode(node)
    this.impacts.push(impact)
  }

  private drawTelegraph(
    node: Node,
    area: EnemyTelegraphDelivery['area'],
    profile: BossTelegraphVisualProfile,
    quality: VfxQuality,
  ): PreparedVisualNode {
    const geometry = centerAndSize(area)
    const prepared = this.prepareVisualNode(node, geometry, profile, false, quality)
    const graphics = prepared.graphics
    if (!graphics) return prepared

    const halfWidth = geometry.width * 0.5
    const halfHeight = geometry.height * 0.5
    if (profile.id === 'sweep-arc') {
      drawBrokenRail(graphics, -halfWidth * 0.9, halfWidth * 0.9, -halfHeight * 0.3)
      drawBrokenRail(graphics, -halfWidth * 0.9, halfWidth * 0.9, halfHeight * 0.3)
      for (const offset of [-0.42, 0, 0.42]) {
        graphics.moveTo(halfWidth * offset - halfHeight * 0.22, halfHeight * 0.62)
        graphics.lineTo(halfWidth * offset + halfHeight * 0.22, -halfHeight * 0.62)
      }
    } else if (profile.id === 'spike-eruption') {
      drawBrokenRail(graphics, -halfWidth * 0.78, halfWidth * 0.78, -halfHeight * 0.68)
      for (const offset of [-0.48, 0, 0.48]) {
        const x = halfWidth * offset
        graphics.moveTo(x - halfWidth * 0.16, -halfHeight * 0.72)
        graphics.lineTo(x, halfHeight * 0.82)
        graphics.lineTo(x + halfWidth * 0.13, -halfHeight * 0.18)
      }
    } else {
      drawBrokenRail(graphics, -halfWidth * 0.86, halfWidth * 0.86, halfHeight * 0.58)
      graphics.moveTo(-halfWidth * 0.78, -halfHeight * 0.5)
      graphics.lineTo(-halfWidth * 0.42, halfHeight * 0.12)
      graphics.lineTo(-halfWidth * 0.15, -halfHeight * 0.18)
      graphics.lineTo(0, halfHeight * 0.42)
      graphics.lineTo(halfWidth * 0.18, -halfHeight * 0.12)
      graphics.lineTo(halfWidth * 0.48, halfHeight * 0.18)
      graphics.lineTo(halfWidth * 0.8, -halfHeight * 0.5)
      graphics.moveTo(-halfWidth * 0.62, -halfHeight * 0.64)
      graphics.lineTo(-halfWidth * 0.18, -halfHeight * 0.64)
      graphics.moveTo(halfWidth * 0.16, -halfHeight * 0.64)
      graphics.lineTo(halfWidth * 0.62, -halfHeight * 0.64)
    }
    graphics.stroke()
    return prepared
  }

  private drawImpact(
    node: Node,
    area: EnemyTelegraphDelivery['area'],
    profile: BossTelegraphVisualProfile,
    quality: VfxQuality,
  ): PreparedVisualNode {
    const geometry = centerAndSize(area)
    const prepared = this.prepareVisualNode(node, geometry, profile, true, quality)
    const graphics = prepared.graphics
    if (!graphics) return prepared

    const halfWidth = geometry.width * 0.5
    const halfHeight = geometry.height * 0.5
    if (profile.id === 'sweep-arc') {
      for (const offset of [-0.5, 0, 0.5]) {
        graphics.moveTo(-halfWidth * 0.82, halfHeight * offset)
        graphics.lineTo(halfWidth * 0.82, halfHeight * (offset - 0.32))
      }
    } else if (profile.id === 'spike-eruption') {
      graphics.moveTo(0, halfHeight * 0.9)
      graphics.lineTo(0, -halfHeight * 0.9)
      graphics.moveTo(-halfWidth * 0.7, 0)
      graphics.lineTo(halfWidth * 0.7, 0)
      graphics.moveTo(-halfWidth * 0.46, halfHeight * 0.46)
      graphics.lineTo(halfWidth * 0.46, -halfHeight * 0.46)
      graphics.moveTo(halfWidth * 0.46, halfHeight * 0.46)
      graphics.lineTo(-halfWidth * 0.46, -halfHeight * 0.46)
    } else {
      graphics.moveTo(-halfWidth * 0.88, -halfHeight * 0.54)
      graphics.lineTo(-halfWidth * 0.45, halfHeight * 0.42)
      graphics.lineTo(-halfWidth * 0.12, -halfHeight * 0.2)
      graphics.lineTo(halfWidth * 0.18, halfHeight * 0.5)
      graphics.lineTo(halfWidth * 0.46, -halfHeight * 0.1)
      graphics.lineTo(halfWidth * 0.88, halfHeight * 0.54)
    }
    graphics.stroke()
    return prepared
  }

  private prepareVisualNode(
    node: Node,
    geometry: ReturnType<typeof centerAndSize>,
    profile: BossTelegraphVisualProfile,
    impact: boolean,
    quality: VfxQuality,
  ): PreparedVisualNode {
    node.setPosition(geometry.x, geometry.y, 0)
    node.getComponent(UITransform)?.setContentSize(geometry.width, geometry.height)
    const controller = node.getComponent(BossHazardVisualController)
    controller?.resetVisual()
    const graphics = node.getComponent(Graphics)
    graphics?.clear()
    if (graphics) {
      const color = impact ? profile.impact : profile.warning
      graphics.strokeColor = new Color(...color)
      graphics.lineWidth = impact ? 4 : 3
    }
    controller?.setLayerFrames(
      this.vfxFrames.get(profile.resources.main) ?? null,
      this.vfxFrames.get(profile.resources.accent) ?? null,
      this.vfxFrames.get(profile.resources.particle) ?? null,
    )
    controller?.setLayerSizes(geometry.width, geometry.height)
    const prepared: PreparedVisualNode = {
      controller,
      graphics,
      mainShape: controller?.mainShape ?? null,
      accent: controller?.accent ?? null,
      particleNear: controller?.particleNear ?? null,
      particleFar: controller?.particleFar ?? null,
    }
    this.applyQuality(prepared, profile, quality)
    return prepared
  }

  private applyQuality(
    visual: CachedVisualLayers,
    profile: BossTelegraphVisualProfile,
    quality: VfxQuality,
  ): void {
    setLayerVisibility(visual.mainShape, true)
    setLayerVisibility(
      visual.accent,
      quality === 'full' || (quality === 'reduced' && profile.quality.reducedAccent),
    )
    setLayerVisibility(
      visual.particleNear,
      quality !== 'minimal' || profile.quality.minimalParticles,
    )
    setLayerVisibility(visual.particleFar, quality === 'full')
  }

  private applyLayerColors(
    visual: CachedVisualLayers & CachedVisualColors,
    color: ProfileColor,
    alphaScale: number,
  ): void {
    const safeAlpha = Math.min(1, Math.max(0, alphaScale))
    setLayerColor(visual.mainShape, visual.mainColor, color, safeAlpha)
    setLayerColor(visual.accent, visual.accentColor, color, safeAlpha * 0.9)
    setLayerColor(visual.particleNear, visual.particleNearColor, color, safeAlpha * 0.72)
    setLayerColor(visual.particleFar, visual.particleFarColor, color, safeAlpha * 0.55)
  }

  private updateTelegraphPhase(visual: TelegraphVisual): void {
    bossVfxPhase(visual.duration, visual.remaining, visual.phase)
    const phaseAlpha = visual.phase.intensity * (visual.phase.phase === 'critical' ? 1 : 0.82)
    this.applyLayerColors(visual, visual.profile.spirit, phaseAlpha)
  }

  private removeGroup(key: string, group: TelegraphGroup): void {
    if (this.groups.get(key) !== group) return
    this.groups.delete(key)
    for (const visual of group.visuals) {
      visual.controller?.resetVisual()
      this.telegraphPool?.despawn(visual.node)
    }
  }

  private removeImpact(index: number): void {
    const [impact] = this.impacts.splice(index, 1)
    if (!impact) return
    impact.controller?.resetVisual()
    this.telegraphPool?.despawn(impact.node)
  }
}
