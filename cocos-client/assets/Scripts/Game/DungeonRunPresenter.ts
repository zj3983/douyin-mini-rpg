import {
  _decorator,
  Button,
  Color,
  Component,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Layers,
  Node,
  UITransform,
  VerticalTextAlignment,
} from 'cc'
import type { DungeonRunEvent } from '../Core/Dungeon/DungeonTypes.ts'
import { computeDungeonLayout, type DungeonLayout } from './DungeonLayout.ts'
import type { ViewportMetrics } from './ViewportMetrics.ts'

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
  'flying-sword': { icon: '图标·剑', rarity: '史诗', name: '青岚飞剑' },
  'thunder-seal': { icon: '图标·雷', rarity: '传说', name: '九霄引雷印' },
  'soul-bell': { icon: '图标·铃', rarity: '玄品', name: '引魂铃' },
  'flame-ruler': { icon: '图标·尺', rarity: '传说', name: '焚海重尺' },
  'soul-magnet': { icon: '图标·磁', rarity: '灵品', name: '引魂磁石' },
  'jade-guard': { icon: '图标·玉', rarity: '玄品', name: '回元玉佩' },
  'spirit-vessel': { icon: '图标·鼎', rarity: '史诗', name: '纳灵宝鼎' },
  'bamboo-emperor-fitting': { icon: '图标·竹', rarity: '传说', name: '竹皇剑镡' },
})

const DEFAULT_VIEWPORT = Object.freeze({
  cssWidth: 750,
  cssHeight: 1334,
  topInsetPx: 0,
  bottomInsetPx: 0,
  leftInsetPx: 0,
  rightInsetPx: 0,
})
const PICKUP_SIZE = 28
const PICKUP_SPEED = 8
const PICKUP_RECYCLE_DISTANCE = 7
const TOAST_DURATION_SECONDS = 1.6
const UI_LAYER = Layers.Enum.UI_2D

interface DungeonPausePort {
  setMapOverlayOpen(open: boolean): void
}

interface PointLike {
  x: number
  y: number
}

interface PickupEntry {
  node: Node
  itemId: string
}

interface ToastEntry {
  node: Node
  label: Label
  remaining: number
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

@ccclass('DungeonRunPresenter')
export class DungeonRunPresenter extends Component {
  @property(Node) sharedActorLayer: Node | null = null
  @property(Node) sharedEffectLayer: Node | null = null
  @property(Node) sharedDropLayer: Node | null = null
  @property(Node) sharedInputLayer: Node | null = null
  @property(Node) playerTarget: Node | null = null

  pickupCapacity = 24
  toastCapacity = 4

  private controller: DungeonPausePort | null = null
  private layout: DungeonLayout = computeDungeonLayout(DEFAULT_VIEWPORT)
  private readonly ownedNodes: Node[] = []
  private readonly pickups: PickupEntry[] = []
  private readonly toasts: ToastEntry[] = []
  private worldLayer: Node | null = null
  private hud: Node | null = null
  private pressureBar: Node | null = null
  private pressureFill: Node | null = null
  private mapButton: Node | null = null
  private mapOverlay: Node | null = null
  private mapCloseButton: Node | null = null
  private interactionHint: Node | null = null
  private pursuitWarning: Node | null = null
  private finalBossBar: Node | null = null
  private finalBossFill: Node | null = null
  private settlement: Node | null = null
  private settlementCloseButton: Node | null = null
  private toastLayer: Node | null = null
  private healthLabel: Label | null = null
  private floorLabel: Label | null = null
  private pressureLabel: Label | null = null
  private lootLabel: Label | null = null
  private hintLabel: Label | null = null
  private bossLabel: Label | null = null
  private settlementTitle: Label | null = null
  private settlementBody: Label | null = null
  private destroyed = false

  bindController(controller: DungeonPausePort | null): void {
    if (this.controller === controller) return
    if (this.mapOverlay?.active) this.controller?.setMapOverlayOpen(false)
    this.controller = controller
    if (this.mapOverlay?.active) this.controller?.setMapOverlayOpen(true)
  }

  onLoad(): void {
    if (this.destroyed || this.worldLayer) return
    this.buildInterface()
    this.configureViewport(DEFAULT_VIEWPORT)
  }

  configureViewport(metrics: Pick<ViewportMetrics,
    'cssWidth' | 'cssHeight' | 'topInsetPx' | 'bottomInsetPx' | 'leftInsetPx' | 'rightInsetPx'>,
  ): void {
    this.layout = computeDungeonLayout(metrics)
    this.applyLayout()
  }

  getLayoutSnapshot(): DungeonLayout {
    return this.layout
  }

  presentHud(value: Record<string, unknown>): void {
    const health = finite(value.health)
    const floor = finite(value.floor, 1)
    const pressure = finite(value.pressure)
    const loot = finite(value.carriedLootCount)
    if (this.healthLabel) this.healthLabel.string = `生命 ${Math.max(0, Math.round(health))}`
    if (this.floorLabel) this.floorLabel.string = `第${Math.max(1, Math.round(floor))}层`
    if (this.pressureLabel) this.pressureLabel.string = `压力 ${Math.max(0, Math.round(pressure))}`
    if (this.lootLabel) this.lootLabel.string = `携带 ${Math.max(0, Math.round(loot))}`
    this.setFillRatio(this.pressureFill, Math.min(1, Math.max(0, pressure / 240)))
  }

  setInteractionHint(text: string): void {
    if (this.hintLabel) this.hintLabel.string = typeof text === 'string' ? text : ''
  }

  presentRunEvent(event: DungeonRunEvent, pickupOrigin?: PointLike): void {
    if (this.destroyed) return
    if (event.type === 'pursuer-hunt-started') {
      if (this.pursuitWarning) this.pursuitWarning.active = true
      if (this.finalBossBar) this.finalBossBar.active = false
      return
    }
    if (event.type === 'altar-activated') {
      if (this.pursuitWarning) this.pursuitWarning.active = false
      if (this.finalBossBar) this.finalBossBar.active = true
      if (this.bossLabel) this.bossLabel.string = '竹皇真身'
      this.setFillRatio(this.finalBossFill, 1)
      return
    }
    if (event.type === 'pursuer-health-damaged') {
      if (this.finalBossBar?.active) {
        if (this.bossLabel) this.bossLabel.string = `竹皇真身 ${Math.max(0, Math.round(event.remaining))}`
        this.setFillRatio(this.finalBossFill, Math.min(1, Math.max(0, event.remaining / 1200)))
      }
      return
    }
    if (event.type === 'pursuer-defeated') {
      if (this.pursuitWarning) this.pursuitWarning.active = false
      if (this.finalBossBar) this.finalBossBar.active = false
      return
    }
    if (event.type === 'room-searched') {
      for (const item of event.loot) {
        const equipment = EQUIPMENT[item.itemId]
        if (equipment) this.showEquipmentToast(equipment)
        for (let index = 0; index < item.amount; index += 1) {
          this.showPickup(item.itemId, pickupOrigin)
        }
      }
      return
    }
    if (event.type === 'extraction-completed') this.showSettlement(event)
  }

  update(deltaSeconds: number): void {
    if (this.destroyed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return
    this.updatePickups(deltaSeconds)
    this.updateToasts(deltaSeconds)
  }

  onDestroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.mapOverlay?.active) this.controller?.setMapOverlayOpen(false)
    this.mapButton?.off(Button.EventType.CLICK, this.openMap, this)
    this.mapCloseButton?.off(Button.EventType.CLICK, this.closeMap, this)
    this.settlementCloseButton?.off(Button.EventType.CLICK, this.closeSettlement, this)
    this.controller = null
    for (const pickup of this.pickups.splice(0)) pickup.node.destroy()
    for (const node of this.ownedNodes.splice(0)) node.destroy()
    this.toasts.length = 0
    this.clearReferences()
  }

  private buildInterface(): void {
    this.worldLayer = this.createNode('DungeonWorldLayer', this.node)
    this.hud = this.createPanel('DungeonHud', this.node, new Color(5, 20, 29, 215), new Color(58, 190, 184, 180))
    this.healthLabel = this.createLabel('DungeonHealthLabel', this.hud, '生命 0', 24)
    this.floorLabel = this.createLabel('DungeonFloorLabel', this.hud, '第1层', 24)
    this.pressureLabel = this.createLabel('DungeonPressureLabel', this.hud, '压力 0', 24)
    this.lootLabel = this.createLabel('DungeonLootLabel', this.hud, '携带 0', 24)

    this.pressureBar = this.createPanel('DungeonPressureBar', this.node, new Color(4, 9, 12, 220), new Color(45, 118, 118, 190))
    this.pressureFill = this.createPanel('DungeonPressureFill', this.pressureBar, new Color(44, 202, 130, 255), new Color(44, 202, 130, 255))

    this.mapButton = this.createPanel('DungeonMapButton', this.node, new Color(16, 82, 104, 245), new Color(90, 221, 218, 255))
    this.mapButton.addComponent(Button)
    this.createLabel('DungeonMapButtonLabel', this.mapButton, '地图', 22)
    this.mapButton.on(Button.EventType.CLICK, this.openMap, this)

    this.mapOverlay = this.createPanel('DungeonMapOverlay', this.node, new Color(2, 10, 20, 244), new Color(76, 180, 180, 220))
    this.createLabel('DungeonMapTitle', this.mapOverlay, '雾竹秘境路线', 30)
    this.mapCloseButton = this.createPanel('DungeonMapCloseButton', this.mapOverlay, new Color(20, 37, 55, 255), new Color(147, 215, 214, 255))
    this.mapCloseButton.addComponent(Button)
    this.createLabel('DungeonMapCloseLabel', this.mapCloseButton, '×', 28)
    this.mapCloseButton.on(Button.EventType.CLICK, this.closeMap, this)
    this.mapOverlay.active = false

    this.interactionHint = this.createPanel('DungeonInteractionHint', this.node, new Color(3, 15, 24, 220), new Color(79, 190, 170, 220))
    this.hintLabel = this.createLabel('DungeonInteractionLabel', this.interactionHint, '', 26)

    this.pursuitWarning = this.createPanel('DungeonPursuitWarning', this.node, new Color(88, 17, 26, 236), new Color(255, 104, 93, 255))
    this.createLabel('DungeonPursuitWarningLabel', this.pursuitWarning, '追猎者逼近', 28)
    this.pursuitWarning.active = false

    this.finalBossBar = this.createPanel('DungeonFinalBossBar', this.node, new Color(19, 7, 12, 235), new Color(225, 69, 85, 255))
    this.bossLabel = this.createLabel('DungeonFinalBossLabel', this.finalBossBar, '竹皇真身', 24)
    this.finalBossFill = this.createPanel('DungeonFinalBossFill', this.finalBossBar, new Color(213, 48, 70, 255), new Color(213, 48, 70, 255))
    this.finalBossBar.active = false

    this.settlement = this.createPanel('DungeonSettlement', this.node, new Color(4, 13, 27, 248), new Color(80, 202, 190, 255))
    this.settlementTitle = this.createLabel('DungeonSettlementTitle', this.settlement, '撤离结算', 34)
    this.settlementBody = this.createLabel('DungeonSettlementBody', this.settlement, '', 24)
    this.settlementCloseButton = this.createPanel('DungeonSettlementCloseButton', this.settlement, new Color(20, 66, 78, 255), new Color(111, 229, 211, 255))
    this.settlementCloseButton.addComponent(Button)
    this.createLabel('DungeonSettlementCloseLabel', this.settlementCloseButton, '关闭', 22)
    this.settlementCloseButton.on(Button.EventType.CLICK, this.closeSettlement, this)
    this.settlement.active = false

    this.toastLayer = this.createNode('DungeonToastLayer', this.node)
  }

  private applyLayout(): void {
    if (!this.worldLayer) return
    this.resizeAndPlace(this.node, { centerX: 0, centerY: 0, width: this.layout.width, height: this.layout.height })
    this.resizeAndPlace(this.worldLayer, this.layout.battleRect)
    this.resizeAndPlace(this.hud, this.layout.hud)
    this.layoutHudLabels()
    const pressureWidth = Math.max(1, this.layout.hud.width * 0.72)
    this.resizeAndPlace(this.pressureBar, {
      centerX: this.layout.hud.centerX,
      centerY: this.layout.hud.centerY - this.layout.hud.height / 2 - 12,
      width: pressureWidth,
      height: 14,
    })
    this.resizeAndPlace(this.pressureFill, { centerX: 0, centerY: 0, width: pressureWidth - 4, height: 10 })
    this.setFillRatio(this.pressureFill, 0)
    this.resizeAndPlace(this.mapButton, this.layout.mapButton)
    this.fitChildLabel(this.mapButton, 'DungeonMapButtonLabel')
    this.resizeAndPlace(this.mapOverlay, this.layout.safeRect)
    this.resizeAndPlace(this.mapOverlay?.getChildByName('DungeonMapTitle') ?? null, {
      centerX: 0,
      centerY: this.layout.safeRect.height / 2 - 58,
      width: this.layout.safeRect.width - 120,
      height: 58,
    })
    this.resizeAndPlace(this.interactionHint, this.layout.interaction)
    this.fitChildLabel(this.interactionHint, 'DungeonInteractionLabel')
    this.resizeAndPlace(this.settlement, this.layout.settlement)
    const touch = Math.max(44 / this.layout.physicalScale, 44)
    this.resizeAndPlace(this.mapCloseButton, {
      centerX: this.layout.safeRect.width / 2 - touch / 2 - 12,
      centerY: this.layout.safeRect.height / 2 - touch / 2 - 12,
      width: touch,
      height: touch,
    })
    this.fitChildLabel(this.mapCloseButton, 'DungeonMapCloseLabel')
    this.resizeAndPlace(this.settlementCloseButton, {
      centerX: 0,
      centerY: -this.layout.settlement.height / 2 + touch / 2 + 18,
      width: Math.max(touch, 120),
      height: touch,
    })
    this.fitChildLabel(this.settlementCloseButton, 'DungeonSettlementCloseLabel')
    this.resizeAndPlace(this.pursuitWarning, {
      centerX: this.layout.safeRect.centerX,
      centerY: this.layout.safeRect.centerY + this.layout.safeRect.height * 0.22,
      width: Math.min(this.layout.safeRect.width - 24, 460),
      height: 74,
    })
    this.fitChildLabel(this.pursuitWarning, 'DungeonPursuitWarningLabel')
    this.resizeAndPlace(this.finalBossBar, {
      centerX: this.layout.safeRect.centerX,
      centerY: this.layout.safeRect.centerY + this.layout.safeRect.height * 0.3,
      width: Math.min(this.layout.safeRect.width - 32, 520),
      height: 54,
    })
    this.resizeAndPlace(this.finalBossBar?.getChildByName('DungeonFinalBossLabel') ?? null, {
      centerX: 0,
      centerY: 9,
      width: Math.min(this.layout.safeRect.width - 56, 488),
      height: 32,
    })
    this.resizeAndPlace(this.finalBossFill, { centerX: 0, centerY: -14, width: Math.min(this.layout.safeRect.width - 44, 496), height: 10 })
    this.setFillRatio(this.finalBossFill, 1)
    this.resizeAndPlace(this.toastLayer, {
      centerX: this.layout.safeRect.centerX,
      centerY: this.layout.safeRect.centerY + this.layout.safeRect.height * 0.13,
      width: Math.min(this.layout.safeRect.width - 32, 520),
      height: 210,
    })
    this.layoutSettlementContent()
    this.layoutToasts()
  }

  private layoutHudLabels(): void {
    if (!this.hud) return
    const labels = [this.healthLabel, this.floorLabel, this.pressureLabel, this.lootLabel]
    const width = this.layout.hud.width / labels.length
    labels.forEach((entry, index) => {
      if (!entry) return
      entry.fontSize = this.layout.fontSizes.hud
      this.resizeAndPlace(entry.node, {
        centerX: -this.layout.hud.width / 2 + width * (index + 0.5),
        centerY: 0,
        width,
        height: this.layout.hud.height,
      })
    })
  }

  private layoutSettlementContent(): void {
    if (!this.settlement) return
    this.resizeAndPlace(this.settlementTitle?.node ?? null, {
      centerX: 0,
      centerY: this.layout.settlement.height / 2 - 56,
      width: this.layout.settlement.width - 48,
      height: 58,
    })
    this.resizeAndPlace(this.settlementBody?.node ?? null, {
      centerX: 0,
      centerY: 16,
      width: this.layout.settlement.width - 56,
      height: Math.max(60, this.layout.settlement.height - 190),
    })
  }

  private showPickup(itemId: string, origin?: PointLike): void {
    if (!this.sharedDropLayer) return
    const capacity = Number.isSafeInteger(this.pickupCapacity) && this.pickupCapacity > 0 ? this.pickupCapacity : 24
    let entry = this.pickups.find((candidate) => !candidate.node.active)
    if (!entry && this.pickups.length < capacity) {
      const node = this.createNode('DungeonPickup', this.sharedDropLayer, PICKUP_SIZE, PICKUP_SIZE, false)
      this.drawPanel(node, PICKUP_SIZE, PICKUP_SIZE, new Color(62, 221, 190, 230), new Color(190, 255, 242, 255), 8)
      entry = { node, itemId }
      this.pickups.push(entry)
    }
    if (!entry) return
    entry.itemId = itemId
    entry.node.active = true
    const offset = this.pickups.indexOf(entry) * 7
    entry.node.setPosition(finite(origin?.x, -80) + offset, finite(origin?.y, -20) + offset * 0.5, 0)
  }

  private updatePickups(deltaSeconds: number): void {
    const target = this.resolvePlayerTarget()
    if (!target) return
    const targetX = finite(target.position?.x)
    const targetY = finite(target.position?.y)
    const step = Math.min(1, deltaSeconds * PICKUP_SPEED)
    for (const entry of this.pickups) {
      if (!entry.node.active) continue
      const currentX = finite(entry.node.position?.x)
      const currentY = finite(entry.node.position?.y)
      const nextX = currentX + (targetX - currentX) * step
      const nextY = currentY + (targetY - currentY) * step
      entry.node.setPosition(nextX, nextY, 0)
      if (Math.hypot(targetX - nextX, targetY - nextY) <= PICKUP_RECYCLE_DISTANCE) entry.node.active = false
    }
  }

  private resolvePlayerTarget(): Node | null {
    return this.playerTarget
      ?? this.sharedActorLayer?.getChildByName('Player')
      ?? this.sharedActorLayer?.getChildByName('PlayerActor')
      ?? null
  }

  private showEquipmentToast(equipment: { icon: string; rarity: string; name: string }): void {
    if (!this.toastLayer) return
    const capacity = Number.isSafeInteger(this.toastCapacity) && this.toastCapacity > 0 ? this.toastCapacity : 4
    let entry = this.toasts.find((candidate) => !candidate.node.active)
    if (!entry && this.toasts.length < capacity) {
      const node = this.createPanel('DungeonEquipmentToast', this.toastLayer, new Color(8, 25, 37, 242), new Color(89, 212, 196, 255), false)
      const toastLabel = this.createLabel('DungeonToastLabel', node, '', 22)
      entry = { node, label: toastLabel, remaining: 0 }
      this.toasts.push(entry)
    }
    if (!entry) return
    entry.label.string = `${equipment.icon}  ${equipment.rarity}  ${equipment.name}`
    entry.remaining = TOAST_DURATION_SECONDS
    entry.node.active = true
    this.layoutToasts()
  }

  private updateToasts(deltaSeconds: number): void {
    let changed = false
    for (const entry of this.toasts) {
      if (!entry.node.active) continue
      entry.remaining -= deltaSeconds
      if (entry.remaining <= 0) {
        entry.remaining = 0
        entry.node.active = false
        changed = true
      }
    }
    if (changed) this.layoutToasts()
  }

  private layoutToasts(): void {
    const active = this.toasts.filter((entry) => entry.node.active)
    active.forEach((entry, index) => {
      this.resizeAndPlace(entry.node, { centerX: 0, centerY: 70 - index * 62, width: 430, height: 52 })
      this.resizeAndPlace(entry.label.node, { centerX: 0, centerY: 0, width: 410, height: 48 })
    })
  }

  private showSettlement(event: Extract<DungeonRunEvent, { type: 'extraction-completed' }>): void {
    if (!this.settlement) return
    if (this.settlementTitle) this.settlementTitle.string = event.exitKind === 'full' ? '完整撤离' : '受损撤离'
    if (this.settlementBody) {
      const explored = Math.round(Math.min(1, Math.max(0, event.explorationRate)) * 100)
      this.settlementBody.string = `${event.exitKind === 'full' ? '完整撤离' : '受损撤离'}\n探索率 ${explored}%\n${event.bossDefeated ? 'Boss 已击败' : 'Boss 未击败'}`
    }
    this.settlement.active = true
  }

  private openMap(): void {
    if (!this.mapOverlay || this.mapOverlay.active) return
    this.mapOverlay.active = true
    this.controller?.setMapOverlayOpen(true)
  }

  private closeMap(): void {
    if (!this.mapOverlay || !this.mapOverlay.active) return
    this.mapOverlay.active = false
    this.controller?.setMapOverlayOpen(false)
  }

  private closeSettlement(): void {
    if (this.settlement) this.settlement.active = false
  }

  private createPanel(name: string, parent: Node, fill: Color, stroke: Color, track = true): Node {
    const node = this.createNode(name, parent, 0, 0, track)
    this.drawPanel(node, 1, 1, fill, stroke, 6)
    return node
  }

  private createNode(name: string, parent: Node, width = 0, height = 0, track = true): Node {
    const node = new Node(name)
    node.layer = UI_LAYER
    node.parent = parent
    node.addComponent(UITransform).setContentSize(width, height)
    if (track && parent === this.node) this.ownedNodes.push(node)
    return node
  }

  private createLabel(name: string, parent: Node, text: string, fontSize: number): Label {
    const node = this.createNode(name, parent)
    const label = node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = fontSize + 6
    label.color = new Color(238, 247, 245, 255)
    label.horizontalAlign = HorizontalTextAlignment.CENTER
    label.verticalAlign = VerticalTextAlignment.CENTER
    label.overflow = Label.Overflow.SHRINK
    return label
  }

  private drawPanel(node: Node, width: number, height: number, fill: Color, stroke: Color, radius: number): void {
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = fill
    graphics.roundRect(-width / 2, -height / 2, width, height, radius)
    graphics.fill()
    graphics.strokeColor = stroke
    graphics.lineWidth = 2
    graphics.roundRect(-width / 2 + 1, -height / 2 + 1, Math.max(0, width - 2), Math.max(0, height - 2), Math.max(0, radius - 1))
    graphics.stroke()
  }

  private resizeAndPlace(node: Node | null, rect: { centerX: number; centerY: number; width: number; height: number }): void {
    if (!node) return
    node.getComponent(UITransform)?.setContentSize(rect.width, rect.height)
    node.setPosition(rect.centerX, rect.centerY, 0)
    const graphics = node.getComponent(Graphics)
    if (graphics) this.redrawCurrentPanel(graphics, rect.width, rect.height)
  }

  private fitChildLabel(parent: Node | null, childName: string, inset = 8): void {
    if (!parent) return
    const transform = parent.getComponent(UITransform)
    const child = parent.getChildByName(childName)
    if (!transform || !child) return
    this.resizeAndPlace(child, {
      centerX: 0,
      centerY: 0,
      width: Math.max(0, transform.width - inset * 2),
      height: Math.max(0, transform.height - inset * 2),
    })
  }

  private redrawCurrentPanel(graphics: Graphics, width: number, height: number): void {
    graphics.clear()
    graphics.roundRect(-width / 2, -height / 2, width, height, 6)
    graphics.fill()
    graphics.roundRect(-width / 2 + 1, -height / 2 + 1, Math.max(0, width - 2), Math.max(0, height - 2), 5)
    graphics.stroke()
  }

  private setFillRatio(fill: Node | null, ratio: number): void {
    const transform = fill?.getComponent(UITransform)
    if (!fill || !transform) return
    const parentWidth = fill.parent?.getComponent(UITransform)?.width ?? transform.width
    const width = Math.max(0, parentWidth - 4) * ratio
    transform.setContentSize(width, transform.height)
    fill.setPosition(-parentWidth / 2 + 2 + width / 2, fill.position.y, 0)
    const graphics = fill.getComponent(Graphics)
    if (graphics) this.redrawCurrentPanel(graphics, width, transform.height)
  }

  private clearReferences(): void {
    this.worldLayer = null
    this.hud = null
    this.pressureBar = null
    this.pressureFill = null
    this.mapButton = null
    this.mapOverlay = null
    this.mapCloseButton = null
    this.interactionHint = null
    this.pursuitWarning = null
    this.finalBossBar = null
    this.finalBossFill = null
    this.settlement = null
    this.settlementCloseButton = null
    this.toastLayer = null
    this.healthLabel = null
    this.floorLabel = null
    this.pressureLabel = null
    this.lootLabel = null
    this.hintLabel = null
    this.bossLabel = null
    this.settlementTitle = null
    this.settlementBody = null
  }
}
