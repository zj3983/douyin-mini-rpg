import {
  _decorator,
  Camera,
  Button,
  Canvas,
  Color,
  Component,
  Graphics,
  HorizontalTextAlignment,
  JsonAsset,
  Label,
  Layers,
  Node,
  ProgressBar,
  ResolutionPolicy,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
  VerticalTextAlignment,
  resources,
  view,
} from 'cc'
import { AtlasAnimator } from './AtlasAnimator'
import { BattleHudController } from './BattleHudController'
import { BattleInputController } from './BattleInputController'
import { BattleRuntimeController } from './BattleRuntimeController'
import { EnemySpawner } from './EnemySpawner'
import { EnemyController } from './EnemyController'
import { EnemyVisualController } from './EnemyVisualController'
import { FlyingSwordSkill } from './FlyingSwordSkill'
import { NodePoolController } from './NodePoolController'
import { PlayerController } from './PlayerController'
import { PoolableActor } from './PoolableActor'
import { SoulOrbController } from './SoulOrbController'
import { StageClearPanelController } from './StageClearPanelController'
import { DamageNumberController } from './DamageNumberController'

const { ccclass } = _decorator
const WIDTH = 750
const HEIGHT = 1334
const NAV_HEIGHT = 104
const TOP_HUD_OFFSET = 83
const BOSS_HUD_OFFSET = 179
const UI_LAYER = Layers.Enum.UI_2D

interface BarParts {
  root: Node
  progress: ProgressBar
}

type RuntimeLoadState =
  | { status: 'loading' }
  | { status: 'ready'; runtime: BattleRuntimeController }
  | { status: 'failed' }

@ccclass('PortraitBattleBootstrap')
export class PortraitBattleBootstrap extends Component {
  private fullHeightNodes: Node[] = []
  private farBackground: Node | null = null
  private midBackground: Node | null = null
  private inputLayer: Node | null = null
  private topHud: Node | null = null
  private bossHud: Node | null = null
  private bottomNavigation: Node | null = null
  private midDriftElapsed = 0
  private loadErrorLabel: Label | null = null
  private bindRuntimeCallback: (() => void) | null = null
  private destroyed = false
  private assembled = false

  onLoad() {
    view.setDesignResolutionSize(750, 1334, ResolutionPolicy.FIXED_WIDTH)
    this.assembleScene()
    view.on('canvas-resize', this.relayoutVisibleArea, this)
  }

  onDestroy() {
    this.destroyed = true
    this.stopRuntimeBinding()
    view.off('canvas-resize', this.relayoutVisibleArea, this)
  }

  update(deltaTime: number) {
    if (!this.midBackground) return
    this.midDriftElapsed += Math.min(Math.max(deltaTime, 0), 0.05)
    this.midBackground.setPosition(Math.sin(this.midDriftElapsed * 0.22) * 8, 0, 0)
  }

  private assembleScene() {
    if (this.assembled) return
    this.assembled = true

    const visibleSize = view.getVisibleSize()
    const visibleHeight = Math.max(HEIGHT, visibleSize.height)
    const backgroundScale = visibleHeight / HEIGHT
    const backgroundWidth = WIDTH * backgroundScale

    const canvasNode = this.createNode('Canvas', this.node, WIDTH, visibleHeight)
    const canvas = canvasNode.addComponent(Canvas)
    const cameraNode = this.createNode('UICamera', canvasNode)
    const camera = cameraNode.addComponent(Camera)
    camera.projection = Camera.ProjectionType.ORTHO
    camera.visibility = UI_LAYER
    camera.priority = 100
    canvas.cameraComponent = camera
    const battleRoot = this.createNode('BattleRoot', canvasNode, WIDTH, visibleHeight)
    const worldLayer = this.createNode('WorldLayer', battleRoot, WIDTH, visibleHeight)
    const actorLayer = this.createNode('ActorLayer', battleRoot, WIDTH, visibleHeight)
    const effectLayer = this.createNode('EffectLayer', battleRoot, WIDTH, visibleHeight)
    const dropLayer = this.createNode('DropLayer', battleRoot, WIDTH, visibleHeight)
    const inputLayer = this.createNode('InputLayer', battleRoot, WIDTH, visibleHeight - NAV_HEIGHT)
    inputLayer.setPosition(0, NAV_HEIGHT / 2, 0)
    const hudLayer = this.createNode('HudLayer', battleRoot, WIDTH, visibleHeight)
    this.fullHeightNodes = [canvasNode, battleRoot, worldLayer, actorLayer, effectLayer, dropLayer, hudLayer]
    this.inputLayer = inputLayer

    this.createWorld(worldLayer, backgroundWidth, visibleHeight)
    const { player, controller, animator } = this.createPlayer(actorLayer)
    const enemyPool = this.createRuntimePool(actorLayer, 'EnemyPool', 'enemy', 18, () => this.createEnemyNode())
    const enemySpawner = this.createNode('EnemySpawner', actorLayer).addComponent(EnemySpawner)
    enemySpawner.enemyPool = enemyPool
    enemySpawner.playerTarget = player
    const soulOrbPool = this.createRuntimePool(dropLayer, 'SoulOrbPool', 'soul-orb', 24, () => this.createSoulOrbNode())
    const damageNumberPool = this.createRuntimePool(effectLayer, 'DamageNumberPool', 'damage-number', 24, () => this.createDamageNumberNode())
    const bossEffectPool = this.createRuntimePool(effectLayer, 'BossEffectPool', 'boss-effect', 4, () => this.createBossEffectNode())
    const hudParts = this.createHud(hudLayer, visibleHeight)
    const runtime = this.loadRuntime(battleRoot, {
      enemySpawner,
      soulOrbPool,
      damageNumberPool,
      bossEffectPool,
      player,
      hud: hudParts.hud,
      stageClearPanel: hudParts.stageClearPanel,
    })
    this.createFlyingSword(effectLayer, runtime, animator, visibleHeight)
    this.createInput(inputLayer, controller)

    player.setSiblingIndex(0)
  }

  private relayoutVisibleArea() {
    const visibleHeight = Math.max(HEIGHT, view.getVisibleSize().height)
    const backgroundWidth = WIDTH * (visibleHeight / HEIGHT)

    for (const node of this.fullHeightNodes) this.resizeNode(node, WIDTH, visibleHeight)
    this.resizeNode(this.farBackground, backgroundWidth, visibleHeight)
    this.resizeNode(this.midBackground, backgroundWidth, visibleHeight)
    this.resizeNode(this.inputLayer, WIDTH, visibleHeight - NAV_HEIGHT)
    this.inputLayer?.setPosition(0, NAV_HEIGHT / 2, 0)
    this.topHud?.setPosition(0, visibleHeight / 2 - TOP_HUD_OFFSET, 0)
    this.bossHud?.setPosition(0, visibleHeight / 2 - BOSS_HUD_OFFSET, 0)
    this.bottomNavigation?.setPosition(0, -visibleHeight / 2 + NAV_HEIGHT / 2, 0)
  }

  private resizeNode(node: Node | null, width: number, height: number) {
    node?.getComponent(UITransform)?.setContentSize(width, height)
  }

  private createWorld(parent: Node, backgroundWidth: number, visibleHeight: number) {
    const far = this.createSpriteNode('FarBackground', parent, backgroundWidth, visibleHeight)
    const mid = this.createSpriteNode('MidBackground', parent, backgroundWidth, visibleHeight)
    mid.sprite.color = new Color(255, 255, 255, 168)
    this.farBackground = far.node
    this.midBackground = mid.node
    this.loadSprite('Assets/World/MistBamboo/far/spriteFrame', far.sprite)
    this.loadSprite('Assets/World/MistBamboo/mid/spriteFrame', mid.sprite)
  }

  private createPlayer(parent: Node) {
    const player = this.createSpriteNode('Player', parent, 320, 512)
    player.node.setPosition(-210, -80, 0)
    player.node.setScale(0.8, 0.8, 1)
    const animator = player.node.addComponent(AtlasAnimator)
    animator.targetSprite = player.sprite
    animator.actorId = 'qinglan-sword-cultivator'
    const controller = player.node.addComponent(PlayerController)
    player.node.on('player-action-requested', (action: string) => animator.play(action), this)

    const atlasPath = 'Data/animation-atlas'
    resources.load(atlasPath, JsonAsset, (error, asset) => {
      if (error || !asset) {
        this.showLoadError(atlasPath)
        return
      }
      const manifestJson = JSON.parse(JSON.stringify(asset.json)) as {
        actors?: Array<{ id: string; atlas: string }>
      }
      const actor = manifestJson.actors?.find(({ id }) => id === 'qinglan-sword-cultivator')
      if (actor) actor.atlas = 'Assets/Combat/QinglanSwordCultivator/action-strip/texture.png'
      const runtimeManifest = new JsonAsset()
      runtimeManifest.json = manifestJson
      animator.animationManifest = runtimeManifest
      animator.play('sword_ride')
    })
    return { player: player.node, controller, animator }
  }

  private loadRuntime(parent: Node, bindings: {
    enemySpawner: EnemySpawner
    soulOrbPool: NodePoolController
    damageNumberPool: NodePoolController
    bossEffectPool: NodePoolController
    player: Node
    hud: BattleHudController
    stageClearPanel: StageClearPanelController
  }) {
    const runtimeNode = this.createNode('Runtime', parent)
    const designPath = 'Data/cultivation-design'
    let state: RuntimeLoadState = { status: 'loading' }
    resources.load(designPath, JsonAsset, (error, asset) => {
      if (this.destroyed) return
      if (error || !asset) {
        state = { status: 'failed' }
        this.showLoadError(designPath)
        return
      }
      const runtime = runtimeNode.addComponent(BattleRuntimeController)
      runtime.designData = asset
      runtime.enemySpawner = bindings.enemySpawner
      runtime.soulOrbPool = bindings.soulOrbPool
      runtime.damageNumberPool = bindings.damageNumberPool
      runtime.bossSkillEffectPool = bindings.bossEffectPool
      runtime.playerNode = bindings.player
      runtime.hud = bindings.hud
      runtime.stageClearPanel = bindings.stageClearPanel
      bindings.stageClearPanel.onContinue = (nextStageId) => runtime.advanceToStage(nextStageId)
      runtime.initialize()
      state = { status: 'ready', runtime }
    })
    return () => state
  }

  private createFlyingSword(
    parent: Node,
    getRuntime: () => RuntimeLoadState,
    animator: AtlasAnimator,
    visibleHeight: number,
  ) {
    const skillNode = this.createNode('FlyingSwordSkill', parent, WIDTH, visibleHeight)
    this.fullHeightNodes.push(skillNode)
    const sword = this.createSpriteNode('Sword', skillNode, 176, 44)
    sword.node.active = false
    this.loadSprite('Assets/Skills/FlyingSword/sword-projectile-v2/spriteFrame', sword.sprite)
    const skill = skillNode.addComponent(FlyingSwordSkill)
    skill.sword = sword.node
    skill.arcHeight = 104
    skillNode.on('player-action-requested', (action: string) => animator.play(action), this)
    const bindRuntime = () => {
      const state = getRuntime()
      if (this.destroyed || state.status === 'failed') {
        this.stopRuntimeBinding(bindRuntime)
        return
      }
      if (state.status !== 'ready') return
      skill.battleRuntime = state.runtime
      state.runtime.swordArcHeight = skill.arcHeight
      this.stopRuntimeBinding(bindRuntime)
    }
    this.bindRuntimeCallback = bindRuntime
    this.schedule(bindRuntime)
  }

  private stopRuntimeBinding(bindRuntime = this.bindRuntimeCallback) {
    if (!bindRuntime) return
    this.unschedule(bindRuntime)
    if (this.bindRuntimeCallback === bindRuntime) this.bindRuntimeCallback = null
  }

  private createInput(inputLayer: Node, player: PlayerController) {
    const inputArea = inputLayer.getComponent(UITransform)
    const input = inputLayer.addComponent(BattleInputController)
    input.player = player
    input.minX = -310
    input.maxX = 70
    input.minY = -430
    input.maxY = 430
    input.bindInputArea(inputArea)
  }

  private createHud(parent: Node, visibleHeight: number) {
    const topHud = this.createNode('TopHud', parent, WIDTH, 126)
    this.topHud = topHud
    topHud.setPosition(0, visibleHeight / 2 - TOP_HUD_OFFSET, 0)
    this.drawBand(topHud, WIDTH, 126, new Color(13, 24, 28, 214))
    const realmLabel = this.createLabel('RealmLabel', topHud, '筑基三重', 28, 190, 40)
    realmLabel.node.setPosition(-255, 34, 0)
    realmLabel.horizontalAlign = HorizontalTextAlignment.LEFT
    const stageLabel = this.createLabel('StageLabel', topHud, '第一关 青苔丘陵', 25, 340, 40)
    stageLabel.node.setPosition(174, 34, 0)
    stageLabel.horizontalAlign = HorizontalTextAlignment.RIGHT

    const health = this.createBar('HealthBar', topHud, new Color(208, 71, 71, 255), -205)
    const mana = this.createBar('ManaBar', topHud, new Color(68, 146, 216, 255), 0)
    const soul = this.createBar('SoulBar', topHud, new Color(199, 163, 79, 255), 205)
    for (const bar of [health.root, mana.root, soul.root]) bar.setPosition(bar.position.x, -28, 0)
    const soulLabel = this.createLabel('SoulLabel', soul.root, '魂 0/12', 18, 190, 28)

    const bossRoot = this.createNode('BossHud', parent, WIDTH, 62)
    this.bossHud = bossRoot
    bossRoot.setPosition(0, visibleHeight / 2 - BOSS_HUD_OFFSET, 0)
    this.drawBand(bossRoot, WIDTH, 62, new Color(35, 13, 17, 220))
    const bossNameLabel = this.createLabel('BossNameLabel', bossRoot, '', 22, 170, 32)
    bossNameLabel.node.setPosition(-260, 0, 0)
    const bossHealth = this.createBar('BossHealthBar', bossRoot, new Color(190, 48, 64, 255), 82, 430)
    bossHealth.root.setPosition(120, 0, 0)

    const bottomNavigation = this.createNode('BottomNavigation', parent, WIDTH, NAV_HEIGHT)
    this.bottomNavigation = bottomNavigation
    bottomNavigation.setPosition(0, -visibleHeight / 2 + NAV_HEIGHT / 2, 0)
    this.drawBand(bottomNavigation, WIDTH, NAV_HEIGHT, new Color(12, 22, 25, 238))
    const navLabels = ['战斗', '副本', '抽卡', '装备', '背包', '法宝']
    navLabels.forEach((text, index) => {
      const label = this.createLabel(`Nav${index + 1}`, bottomNavigation, text, 23, 125, NAV_HEIGHT)
      label.node.setPosition(-312.5 + index * 125, 0, 0)
      label.color = index === 0 ? new Color(230, 199, 112, 255) : new Color(205, 215, 211, 255)
    })

    const stageClear = this.createNode('StageClearPanel', parent, 520, 258)
    stageClear.setPosition(0, 12, 0)
    this.drawBand(stageClear, 520, 258, new Color(7, 18, 23, 246))
    const clearTitle = this.createLabel('ClearTitle', stageClear, '守关突破', 34, 470, 48)
    clearTitle.node.setPosition(0, 82, 0)
    clearTitle.color = new Color(244, 208, 103, 255)
    const rewardLabel = this.createLabel('RewardLabel', stageClear, '', 19, 470, 42)
    rewardLabel.node.setPosition(0, 22, 0)
    const continueNode = this.createNode('ContinueButton', stageClear, 270, 58)
    continueNode.setPosition(0, -71, 0)
    this.drawBand(continueNode, 270, 58, new Color(35, 129, 126, 255))
    const continueLabel = this.createLabel('ContinueLabel', continueNode, '前往下一关', 24, 250, 54)
    const continueButton = continueNode.addComponent(Button)
    const stageClearPanel = stageClear.addComponent(StageClearPanelController)
    stageClearPanel.panelRoot = stageClear
    stageClearPanel.titleLabel = clearTitle
    stageClearPanel.rewardLabel = rewardLabel
    stageClearPanel.nextStageLabel = continueLabel
    stageClearPanel.bindContinueButton(continueButton)
    stageClearPanel.hide()

    const hud = parent.addComponent(BattleHudController)
    hud.realmLabel = realmLabel
    hud.stageLabel = stageLabel
    hud.healthBar = health.progress
    hud.manaBar = mana.progress
    hud.soulBar = soul.progress
    hud.soulLabel = soulLabel
    hud.bossRoot = bossRoot
    hud.bossNameLabel = bossNameLabel
    hud.bossHealthBar = bossHealth.progress
    hud.updateHero({ realm: '筑基三重', health: 160, maxHealth: 160, mana: 12, maxMana: 12 })
    hud.updateStage('青苔丘陵', 1)
    hud.updateSoul(0, 12)
    hud.hideBoss()
    return { hud, stageClearPanel }
  }

  private createRuntimePool(
    parent: Node,
    name: string,
    poolKey: string,
    capacity: number,
    factory: () => Node,
  ) {
    const root = this.createNode(name, parent)
    const pool = root.addComponent(NodePoolController)
    pool.configure(poolKey, capacity)
    pool.setFactory(() => factory())
    return pool
  }

  private createEnemyNode() {
    const node = new Node('EnemyActor')
    node.layer = UI_LAYER
    const transform = node.addComponent(UITransform)
    transform.setContentSize(210, 336)
    const sprite = node.addComponent(Sprite)
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    const animator = node.addComponent(AtlasAnimator)
    animator.targetSprite = sprite
    animator.updateInterval = 0.05
    const controller = node.addComponent(EnemyController)
    controller.moveSpeed = 78
    const visual = node.addComponent(EnemyVisualController)
    visual.animator = animator
    node.addComponent(PoolableActor)
    node.on('enemy-runtime-spawned', (_enemyId: number, profile: { id: string; role: string }) => {
      animator.actorId = profile.id
      controller.moveSpeed = profile.role === 'boss' ? 54 : profile.role === 'flying' ? 86 : 76
      this.bindAnimationManifest(animator, 'move')
    }, this)
    return node
  }

  private createSoulOrbNode() {
    const node = new Node('SoulOrb')
    node.layer = UI_LAYER
    node.addComponent(UITransform).setContentSize(34, 34)
    const glow = node.addComponent(Graphics)
    glow.fillColor = new Color(76, 235, 211, 210)
    glow.circle(0, 0, 13)
    glow.fill()
    glow.strokeColor = new Color(211, 255, 244, 255)
    glow.lineWidth = 3
    glow.circle(0, 0, 16)
    glow.stroke()
    node.addComponent(PoolableActor)
    const controller = node.addComponent(SoulOrbController)
    controller.magnetRadius = 900
    return node
  }

  private createDamageNumberNode() {
    const node = new Node('DamageNumber')
    node.layer = UI_LAYER
    node.addComponent(UITransform).setContentSize(110, 40)
    const label = node.addComponent(Label)
    label.fontSize = 26
    label.lineHeight = 32
    label.horizontalAlign = HorizontalTextAlignment.CENTER
    label.verticalAlign = VerticalTextAlignment.CENTER
    node.addComponent(PoolableActor)
    const controller = node.addComponent(DamageNumberController)
    controller.label = label
    return node
  }

  private createBossEffectNode() {
    const node = new Node('BossSkillEffect')
    node.layer = UI_LAYER
    node.addComponent(UITransform).setContentSize(190, 190)
    const effect = node.addComponent(Graphics)
    effect.fillColor = new Color(55, 190, 126, 72)
    effect.circle(0, 0, 88)
    effect.fill()
    effect.strokeColor = new Color(169, 255, 206, 230)
    effect.lineWidth = 7
    effect.circle(0, 0, 72)
    effect.stroke()
    node.addComponent(PoolableActor)
    return node
  }

  private bindAnimationManifest(animator: AtlasAnimator, initialAction: string) {
    resources.load('Data/animation-atlas', JsonAsset, (error, asset) => {
      if (error || !asset || !animator.node.isValid) return
      animator.animationManifest = asset
      animator.play(initialAction)
    })
  }

  private createNode(name: string, parent: Node, width = 0, height = 0) {
    const node = new Node(name)
    node.layer = UI_LAYER
    node.parent = parent
    const transform = node.addComponent(UITransform)
    transform.setContentSize(width, height)
    return node
  }

  private createSpriteNode(name: string, parent: Node, width: number, height: number) {
    const node = this.createNode(name, parent, width, height)
    const sprite = node.addComponent(Sprite)
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    return { node, sprite }
  }

  private createLabel(name: string, parent: Node, text: string, fontSize: number, width: number, height: number) {
    const node = this.createNode(name, parent, width, height)
    const label = node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = fontSize + 6
    label.color = new Color(238, 242, 235, 255)
    label.horizontalAlign = HorizontalTextAlignment.CENTER
    label.verticalAlign = VerticalTextAlignment.CENTER
    label.overflow = Label.Overflow.SHRINK
    return label
  }

  private createBar(name: string, parent: Node, color: Color, x: number, width = 190): BarParts {
    const root = this.createNode(name, parent, width, 18)
    root.setPosition(x, 0, 0)
    this.drawRect(root, -width / 2, -9, width, 18, new Color(4, 9, 11, 190))
    const fill = this.createSpriteNode('Fill', root, width - 4, 14)
    fill.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5)
    fill.node.setPosition(-width / 2 + 2, 0, 0)
    const visual = this.createNode('BarVisual', fill.node, width - 4, 14)
    this.drawRect(visual, 0, -7, width - 4, 14, color)
    const progress = root.addComponent(ProgressBar)
    progress.barSprite = fill.sprite
    progress.totalLength = width - 4
    return { root, progress }
  }

  private drawBand(node: Node, width: number, height: number, color: Color) {
    this.drawRect(node, -width / 2, -height / 2, width, height, color)
  }

  private drawRect(node: Node, x: number, y: number, width: number, height: number, color: Color) {
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = color
    graphics.rect(x, y, width, height)
    graphics.fill()
  }

  private loadSprite(path: string, sprite: Sprite) {
    resources.load(path, SpriteFrame, (error, asset) => {
      if (error || !asset) {
        this.showLoadError(path)
        return
      }
      sprite.spriteFrame = asset
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
    })
  }

  private showLoadError(path: string) {
    console.warn(`[PortraitBattleBootstrap] asset load failed: ${path}`)
    if (this.loadErrorLabel) return
    const canvas = this.node.getChildByName('Canvas')
    if (!canvas) return
    this.loadErrorLabel = this.createLabel('LoadErrorLabel', canvas, '资源加载失败', 22, 260, 44)
    this.loadErrorLabel.node.setPosition(0, 460, 0)
    this.loadErrorLabel.color = new Color(255, 201, 128, 255)
  }
}
