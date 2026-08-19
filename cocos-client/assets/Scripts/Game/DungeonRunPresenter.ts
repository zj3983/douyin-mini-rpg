import { _decorator, Component, Node } from 'cc'
import type { DungeonRunEvent } from '../Core/Dungeon/DungeonTypes.ts'

const { ccclass, property } = _decorator

export const DUNGEON_NODE_NAMES = Object.freeze([
  'DungeonWorldLayer',
  'DungeonHud',
  'DungeonPressureBar',
  'DungeonMapButton',
  'DungeonMapOverlay',
  'DungeonInteractionHint',
  'DungeonPursuitWarning',
  'DungeonSettlement',
] as const)

const EQUIPMENT = Object.freeze<Record<string, { icon: string; rarity: string; name: string }>>({
  'flying-sword': { icon: 'artifact-flying-sword', rarity: 'epic', name: 'Flying Sword' },
  'thunder-seal': { icon: 'artifact-thunder-seal', rarity: 'legendary', name: 'Thunder Seal' },
  'soul-bell': { icon: 'artifact-soul-bell', rarity: 'mystic', name: 'Soul Bell' },
  'flame-ruler': { icon: 'artifact-flame-ruler', rarity: 'legendary', name: 'Flame Ruler' },
  'soul-magnet': { icon: 'relic-soul-magnet', rarity: 'spirit', name: 'Soul Magnet' },
  'jade-guard': { icon: 'relic-jade-guard', rarity: 'mystic', name: 'Jade Guard' },
  'spirit-vessel': { icon: 'relic-spirit-vessel', rarity: 'epic', name: 'Spirit Vessel' },
  'bamboo-emperor-fitting': { icon: 'relic-bamboo-emperor-fitting', rarity: 'legendary', name: 'Bamboo Emperor Fitting' },
})

export interface SharedDungeonLayers {
  readonly actor: unknown
  readonly effect: unknown
  readonly drop: unknown
  readonly input: unknown
}

interface DungeonHudState {
  health: number
  floor: number
  pressure: number
  carriedLootCount: number
}

interface PooledPickup {
  id: number
  itemId: string
  attractingToPlayer: true
}

interface EquipmentToast {
  itemId: string
  icon: string
  rarity: string
  name: string
}

interface SettlementState {
  visible: boolean
  exitKind: 'damaged' | 'full'
  explorationRate: number
  bossDefeated: boolean
  manualClose: true
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export class DungeonPresenterModel {
  readonly sharedLayers: SharedDungeonLayers
  readonly createdCombatRuntimeCount = 0
  onPauseChanged: ((paused: boolean) => void) | null = null
  onMapClosed: (() => void) | null = null
  pendingScheduleCount = 0

  private readonly maxPickups: number
  private readonly pickups = new Map<number, PooledPickup>()
  private readonly availablePickupIds: number[] = []
  private nextPickupId = 1
  private hud: DungeonHudState = { health: 0, floor: 1, pressure: 0, carriedLootCount: 0 }
  private mapOpen = false
  private pursuitWarningVisible = false
  private bossBarVisible = false
  private toasts: EquipmentToast[] = []
  private settlement: SettlementState | null = null
  private destroyed = false

  constructor(sharedLayers: SharedDungeonLayers, options: { maxPickups?: number } = {}) {
    this.sharedLayers = sharedLayers
    const requested = options.maxPickups ?? 24
    this.maxPickups = Number.isSafeInteger(requested) && requested > 0 ? requested : 24
  }

  presentHud(value: Record<string, unknown>): void {
    this.hud = {
      health: this.number(value.health),
      floor: this.number(value.floor),
      pressure: this.number(value.pressure),
      carriedLootCount: this.number(value.carriedLootCount),
    }
  }

  setMapOpen(open: boolean): void {
    if (this.destroyed || this.mapOpen === open) return
    this.mapOpen = open
    this.onPauseChanged?.(open)
    if (!open) this.onMapClosed?.()
  }

  consumeEvent(event: DungeonRunEvent): void {
    if (this.destroyed) return
    if (event.type === 'pursuer-hunt-started') {
      this.pursuitWarningVisible = true
      this.bossBarVisible = false
    } else if (event.type === 'altar-activated') {
      this.pursuitWarningVisible = false
      this.bossBarVisible = true
    } else if (event.type === 'pursuer-defeated') {
      this.pursuitWarningVisible = false
      this.bossBarVisible = false
    } else if (event.type === 'room-searched') {
      for (const item of event.loot) {
        const equipment = EQUIPMENT[item.itemId]
        if (equipment) this.toasts.push({ itemId: item.itemId, ...equipment })
        for (let count = 0; count < item.amount; count += 1) this.acquirePickup(item.itemId)
      }
    } else if (event.type === 'extraction-completed') {
      this.settlement = {
        visible: true,
        exitKind: event.exitKind,
        explorationRate: event.explorationRate,
        bossDefeated: event.bossDefeated,
        manualClose: true,
      }
    }
  }

  releasePickup(id: number): boolean {
    if (!this.pickups.delete(id)) return false
    this.availablePickupIds.push(id)
    return true
  }

  closeSettlement(): void {
    if (this.settlement) this.settlement.visible = false
  }

  snapshot() {
    return deepClone({
      hud: this.hud,
      paused: this.mapOpen,
      pursuitWarningVisible: this.pursuitWarningVisible,
      bossBarVisible: this.bossBarVisible,
      pickups: [...this.pickups.values()],
      toasts: this.toasts,
      settlement: this.settlement,
      destroyed: this.destroyed,
    })
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.mapOpen = false
    this.pickups.clear()
    this.availablePickupIds.length = 0
    this.toasts = []
    this.pendingScheduleCount = 0
    this.onPauseChanged = null
    this.onMapClosed = null
  }

  private acquirePickup(itemId: string): void {
    if (this.pickups.size >= this.maxPickups) return
    const id = this.availablePickupIds.shift() ?? this.nextPickupId++
    this.pickups.set(id, { id, itemId, attractingToPlayer: true })
  }

  private number(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }
}

@ccclass('DungeonRunPresenter')
export class DungeonRunPresenter extends Component {
  @property(Node) sharedActorLayer: Node | null = null
  @property(Node) sharedEffectLayer: Node | null = null
  @property(Node) sharedDropLayer: Node | null = null
  @property(Node) sharedInputLayer: Node | null = null

  private model: DungeonPresenterModel | null = null
  private ownedNodes: Node[] = []

  onLoad(): void {
    this.model = new DungeonPresenterModel({
      actor: this.sharedActorLayer,
      effect: this.sharedEffectLayer,
      drop: this.sharedDropLayer,
      input: this.sharedInputLayer,
    })
    for (const name of DUNGEON_NODE_NAMES) {
      const child = new Node(name)
      this.node.addChild(child)
      child.active = name !== 'DungeonMapOverlay' && name !== 'DungeonPursuitWarning' && name !== 'DungeonSettlement'
      this.ownedNodes.push(child)
    }
  }

  getModel(): DungeonPresenterModel | null {
    return this.model
  }

  onDestroy(): void {
    this.model?.destroy()
    this.model = null
    for (const node of this.ownedNodes.splice(0)) node.destroy()
  }
}
