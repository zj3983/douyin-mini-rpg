import { _decorator, Color, Component, Graphics, Node, UITransform } from 'cc'
import type { EnemyCommand } from '../Combat/EnemyBrain.ts'
import type { EnemyTelegraphDelivery } from './EnemyCombatResolverAdapter.ts'
import { NodePoolController } from './NodePoolController'

const { ccclass, property } = _decorator

export const BOSS_TELEGRAPH_POOL_CAPACITY = 12

type ActiveHitboxCommand = Extract<EnemyCommand, { readonly type: 'activate-hitbox' }>

interface TelegraphVisual {
  readonly node: Node
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

@ccclass('BossTelegraphPresenter')
export class BossTelegraphPresenter extends Component {
  @property(NodePoolController)
  telegraphPool: NodePoolController | null = null

  private generation = 0
  private readonly groups = new Map<string, TelegraphGroup>()
  private readonly impacts: ImpactVisual[] = []
  private readonly earlyActivations = new Map<string, ActiveHitboxCommand[]>()
  private readonly activatedAuthorities = new Set<string>()

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
    this.hideAll()
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return
    for (let index = this.impacts.length - 1; index >= 0; index -= 1) {
      const impact = this.impacts[index]
      impact.remaining -= deltaSeconds
      if (impact.remaining <= 1e-9) this.removeImpact(index)
    }

    const ready: TelegraphGroup[] = []
    for (const group of this.groups.values()) {
      for (const visual of group.visuals) visual.remaining -= deltaSeconds
      if (group.pending.length > 0 && group.visuals.every((visual) => visual.remaining <= 1e-9)) ready.push(group)
    }
    for (const group of ready) this.activateGroup(group)
  }

  present(delivery: EnemyTelegraphDelivery): boolean {
    if (delivery.generation < this.generation) return false
    if (delivery.generation > this.generation) this.resetGeneration(delivery.generation)
    const node = this.acquireDangerNode()
    if (!node) return false
    this.drawArea(node, delivery.area, false)
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
    group.visuals.push({ node, remaining: delivery.duration })
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

  private acquireDangerNode(): Node | null {
    let node = this.telegraphPool?.spawn(false) ?? null
    while (!node && this.impacts.length > 0) {
      this.removeImpact(0)
      node = this.telegraphPool?.spawn(false) ?? null
    }
    return node
  }

  private showImpact(generation: number, enemyId: number, command: ActiveHitboxCommand): void {
    const node = this.telegraphPool?.spawn(false) ?? null
    if (!node) return
    this.drawArea(node, command.area, true)
    this.telegraphPool?.activateNode(node)
    this.impacts.push({ node, generation, enemyId, remaining: command.duration })
  }

  private drawArea(node: Node, area: EnemyTelegraphDelivery['area'], active: boolean): void {
    const geometry = centerAndSize(area)
    node.setPosition(geometry.x, geometry.y, 0)
    node.getComponent(UITransform)?.setContentSize(geometry.width, geometry.height)
    const graphics = node.getComponent(Graphics)
    if (!graphics) return
    graphics.clear()
    graphics.fillColor = active ? new Color(238, 74, 54, 120) : new Color(244, 181, 53, 92)
    graphics.strokeColor = active ? new Color(255, 228, 198, 235) : new Color(255, 224, 134, 235)
    graphics.lineWidth = active ? 4 : 3
    graphics.rect(-geometry.width * 0.5, -geometry.height * 0.5, geometry.width, geometry.height)
    graphics.fill()
    graphics.stroke()
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
