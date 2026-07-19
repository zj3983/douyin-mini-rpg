import { _decorator, Button, Color, Component, Graphics, Label, Node, UITransform, Vec3 } from 'cc'
import type { EventTouch } from 'cc'
import { createBattleSession, requestSettleContinue, tickBattleSession } from '../Core/Battle/BattleSession.ts'
import type { BattleSession, SessionEvent } from '../Core/Battle/BattleSession.ts'
import type { FanSpec } from '../Core/Battle/Geometry.ts'
import { setMoveTarget } from '../Core/Battle/PlayerMotor.ts'
import { STAGE_ONE } from '../Core/Battle/StageOneConfig.ts'

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
    if (this.settlePanel) this.settlePanel.active = false
    if (this.defeatPanel) this.defeatPanel.active = false
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
    buttonNode.addComponent(Button)
    const buttonLabel = this.makeLabel(buttonNode, 'ContinueLabel', 30, Color.WHITE)
    buttonLabel.string = '继续'
    buttonNode.setPosition(0, -90, 0)
    buttonNode.on(Button.EventType.CLICK, () => {
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
    buttonNode.addComponent(Button)
    const buttonLabel = this.makeLabel(buttonNode, 'RestartLabel', 30, Color.WHITE)
    buttonLabel.string = '重新开始'
    buttonNode.setPosition(0, -50, 0)
    buttonNode.on(Button.EventType.CLICK, () => {
      this.rebuildSession()
    }, this)
    panel.active = false
    return panel
  }

  private handleSessionEvent(event: SessionEvent) {
    switch (event.type) {
      case 'enemy-spawn': {
        const color = event.enemy.kind === 'wolf' ? COLOR_WOLF : COLOR_MOTH
        const node = this.makeCircle(this.actorLayer ?? this.node, `Enemy${event.enemy.id}`, event.enemy.radius, color)
        this.enemyNodes.set(event.enemy.id, node)
        break
      }
      case 'enemy-death': {
        const node = this.enemyNodes.get(event.enemyId)
        if (node) node.active = false
        this.spawnFloatingText(event.position, `${event.kind} 击破`, COLOR_SOUL)
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
    this.syncSettleCountdown()
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

  private syncSettleCountdown() {
    if (!this.settleCountdown || this.session.phase !== 'settle') return
    this.settleCountdown.string = `${Math.max(0, 3 - this.session.settleElapsed).toFixed(1)} 秒后自动继续`
  }
}
