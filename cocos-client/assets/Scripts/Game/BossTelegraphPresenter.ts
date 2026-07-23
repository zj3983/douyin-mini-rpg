import { _decorator, Color, Component, Graphics, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc'
import { BOSS_HAZARD_POOL_CAPACITY } from '../Combat/BossBrain.ts'
import type { EnemyCommand } from '../Combat/EnemyBrain.ts'
import {
  resolveBossTelegraphVisual,
  talismanPulse,
  type BossTelegraphVisualProfile,
  type TalismanPulseOutput,
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

interface TelegraphVisual {
  readonly node: Node
  readonly duration: number
  readonly profile: BossTelegraphVisualProfile
  readonly controller: BossHazardVisualController | null
  readonly talisman: Sprite | null
  readonly pulse: TalismanPulseOutput
  readonly pulseColor: Color
  remaining: number
}

interface TelegraphGroup {
  readonly generation: number
  readonly enemyId: number
  readonly authorityId: string
  readonly visuals: TelegraphVisual[]
  readonly pending: ActiveHitboxCommand[]
}

interface ImpactVisual {
  readonly node: Node
  readonly generation: number
  readonly enemyId: number
  fresh: boolean
  remaining: number
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
  private readonly earlyActivations = new Map<string, ActiveHitboxCommand[]>()
  private readonly activatedAuthorities = new Set<string>()
  private readonly talismanFrames = new Map<string, SpriteFrame>()
  private destroyed = false
  private loadGeneration = 0

  onLoad(): void {
    if (this.destroyed || !this.isValid || !this.node?.isValid) return
    const loadGeneration = ++this.loadGeneration
    for (const kind of ['sweep', 'spike', 'roar-sector'] as const) {
      const path = resolveBossTelegraphVisual({ kind }).talismanPath
      resources.load(path, SpriteFrame, (error, frame) => {
        if (
          error
          || !(frame instanceof SpriteFrame)
          || this.destroyed
          || loadGeneration !== this.loadGeneration
          || !this.isValid
          || !this.node?.isValid
        ) return
        this.talismanFrames.set(path, frame)
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
    this.talismanFrames.clear()
    this.hideAll()
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
        this.updateTelegraphPulse(visual)
        if (visual.remaining > 1e-9) ready = false
      }
      if (ready) this.activateGroup(group)
    }
  }

  present(delivery: EnemyTelegraphDelivery): boolean {
    if (this.destroyed || !this.isValid || !this.node?.isValid) return false
    if (delivery.generation < this.generation) return false
    if (delivery.generation > this.generation) this.resetGeneration(delivery.generation)
    const node = this.acquireHazardNode(delivery.attackId)
    const profile = resolveBossTelegraphVisual(delivery.danger)
    const pulse: TalismanPulseOutput = { progress: 0, alpha: 0, hot: false }
    talismanPulse(delivery.duration, delivery.duration, pulse)
    const pulseColor = new Color(
      profile.spirit[0],
      profile.spirit[1],
      profile.spirit[2],
      Math.round(profile.spirit[3] * pulse.alpha),
    )
    const controller = this.drawTelegraph(node, delivery.area, profile, pulseColor)
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
    group.visuals.push({
      node,
      duration: delivery.duration,
      profile,
      controller,
      talisman: controller?.talisman ?? null,
      pulse,
      pulseColor,
      remaining: delivery.duration,
    })
    return true
  }

  activate(generation: number, enemyId: number, command: ActiveHitboxCommand): void {
    if (generation !== this.generation) return
    const key = authorityKey(generation, enemyId, commandAuthority(command))
    const group = this.groups.get(key)
    if (!group) {
      if (this.activatedAuthorities.has(key)) {
        this.showImpact(generation, enemyId, command)
        return
      }
      const pending = this.earlyActivations.get(key) ?? []
      pending.push(command)
      this.earlyActivations.set(key, pending)
      return
    }
    if (group.visuals.some((visual) => visual.remaining > 1e-9)) {
      group.pending.push(command)
      return
    }
    group.pending.push(command)
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
    for (const command of group.pending) this.showImpact(group.generation, group.enemyId, command)
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

  private showImpact(generation: number, enemyId: number, command: ActiveHitboxCommand): void {
    const node = this.acquireHazardNode(command.attackId)
    const danger = command.danger ?? { kind: dangerKindForAttack(command.attackId) }
    this.drawImpact(node, command.area, resolveBossTelegraphVisual(danger))
    this.telegraphPool?.activateNode(node)
    this.impacts.push({ node, generation, enemyId, fresh: true, remaining: command.duration })
  }

  private drawTelegraph(
    node: Node,
    area: EnemyTelegraphDelivery['area'],
    profile: BossTelegraphVisualProfile,
    pulseColor: Color,
  ): BossHazardVisualController | null {
    const geometry = centerAndSize(area)
    const controller = this.prepareVisualNode(node, geometry, profile, false, pulseColor)
    const graphics = node.getComponent(Graphics)
    if (!graphics) return controller

    const halfWidth = geometry.width * 0.5
    const halfHeight = geometry.height * 0.5
    if (profile.id === 'sweep-seal') {
      drawBrokenRail(graphics, -halfWidth * 0.9, halfWidth * 0.9, -halfHeight * 0.3)
      drawBrokenRail(graphics, -halfWidth * 0.9, halfWidth * 0.9, halfHeight * 0.3)
      for (const offset of [-0.42, 0, 0.42]) {
        graphics.moveTo(halfWidth * offset - halfHeight * 0.22, halfHeight * 0.62)
        graphics.lineTo(halfWidth * offset + halfHeight * 0.22, -halfHeight * 0.62)
      }
    } else if (profile.id === 'spike-seal') {
      const radius = Math.min(halfWidth, halfHeight) * 0.68
      graphics.moveTo(0, radius)
      graphics.lineTo(radius * 0.72, 0)
      graphics.lineTo(0, -radius)
      graphics.lineTo(-radius * 0.72, 0)
      graphics.lineTo(0, radius)
      graphics.moveTo(-radius, 0)
      graphics.lineTo(radius, 0)
      graphics.moveTo(0, radius * 0.72)
      graphics.lineTo(0, -radius)
      graphics.circle(0, -radius * 0.42, Math.max(2, radius * 0.1))
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
    return controller
  }

  private drawImpact(
    node: Node,
    area: EnemyTelegraphDelivery['area'],
    profile: BossTelegraphVisualProfile,
  ): void {
    const geometry = centerAndSize(area)
    const impactColor = new Color(...profile.impact)
    this.prepareVisualNode(node, geometry, profile, true, impactColor)
    const graphics = node.getComponent(Graphics)
    if (!graphics) return

    const halfWidth = geometry.width * 0.5
    const halfHeight = geometry.height * 0.5
    if (profile.id === 'sweep-seal') {
      for (const offset of [-0.5, 0, 0.5]) {
        graphics.moveTo(-halfWidth * 0.82, halfHeight * offset)
        graphics.lineTo(halfWidth * 0.82, halfHeight * (offset - 0.32))
      }
    } else if (profile.id === 'spike-seal') {
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
  }

  private prepareVisualNode(
    node: Node,
    geometry: ReturnType<typeof centerAndSize>,
    profile: BossTelegraphVisualProfile,
    impact: boolean,
    talismanColor: Color,
  ): BossHazardVisualController | null {
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
    controller?.setTalisman(
      this.talismanFrames.get(profile.talismanPath) ?? null,
      talismanColor,
      geometry.width,
      geometry.height,
    )
    return controller
  }

  private updateTelegraphPulse(visual: TelegraphVisual): void {
    talismanPulse(visual.duration, visual.remaining, visual.pulse)
    if (!visual.talisman) return
    visual.pulseColor.set(
      visual.profile.spirit[0],
      visual.profile.spirit[1],
      visual.profile.spirit[2],
      Math.round(visual.profile.spirit[3] * visual.pulse.alpha),
    )
    visual.talisman.color = visual.pulseColor
  }

  private removeGroup(key: string, group: TelegraphGroup): void {
    if (this.groups.get(key) !== group) return
    this.groups.delete(key)
    for (const visual of group.visuals) this.telegraphPool?.despawn(visual.node)
  }

  private removeImpact(index: number): void {
    const [impact] = this.impacts.splice(index, 1)
    if (impact) this.telegraphPool?.despawn(impact.node)
  }
}
