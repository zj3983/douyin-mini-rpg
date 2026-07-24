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
import {
  BATTLE_DESIGN_WIDTH,
  BATTLE_MIN_VISIBLE_HEIGHT,
  BATTLE_NAVIGATION_HEIGHT,
  BATTLE_TOP_HUD_RESERVE,
  ORDINARY_ENEMY_FRAME_HEIGHT,
  ORDINARY_ENEMY_FRAME_WIDTH,
  PLAYER_DISPLAY_SCALE,
  PLAYER_FRAME_HEIGHT,
  PLAYER_FRAME_WIDTH,
  computeBattleViewportState,
} from '../Combat/BattleLayout.ts'
import type { BattleLayout, BattleResolutionMode } from '../Combat/BattleLayout.ts'
import { BOSS_HAZARD_POOL_CAPACITY } from '../Combat/BossBrain.ts'
import type { PlayerActionToken } from '../Combat/PlayerMotor.ts'
import { AtlasAnimator } from './AtlasAnimator'
import { BattleHudController } from './BattleHudController'
import { BattleInputController } from './BattleInputController'
import { BattleRuntimeController } from './BattleRuntimeController'
import { BossHazardVisualController } from './BossHazardVisualController'
import { BossTelegraphPresenter } from './BossTelegraphPresenter'
import { CombatAudioController } from './CombatAudioController'
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
import { DualModeGameController } from './DualModeGameController'
import { DungeonRunController } from './DungeonRunController'
import type { DungeonExtractionEvent } from '../Core/Dungeon/DungeonTypes.ts'
import { StageBackgroundController } from './StageBackgroundController'
import { StageResourceController } from './StageResourceController'
import { createDefaultViewportMetricsProvider } from './ViewportMetrics.ts'
import type { ViewportMetrics, ViewportMetricsProvider } from './ViewportMetrics.ts'

const { ccclass } = _decorator
const WIDTH = BATTLE_DESIGN_WIDTH
const HEIGHT = BATTLE_MIN_VISIBLE_HEIGHT
const NAV_HEIGHT = BATTLE_NAVIGATION_HEIGHT
const TOP_HUD_RESERVE = BATTLE_TOP_HUD_RESERVE
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
  private loadErrorLabel: Label | null = null
  private bindRuntimeCallback: (() => void) | null = null
  private destroyed = false
  private assembled = false
  private runtimeNode: Node | null = null
  private dungeonRunController: DungeonRunController | null = null
  private dungeonExtractionRequest: ((payload: DungeonExtractionEvent) => boolean) | null = null
  private dualModeController: DualModeGameController | null = null
  private stageBackgroundController: StageBackgroundController | null = null
  private stageResourceController: StageResourceController | null = null
  private combatAudioController: CombatAudioController | null = null
  private playerController: PlayerController | null = null
  private battleInput: BattleInputController | null = null
  private movementCoordinateSpace: UITransform | null = null
  private viewportMetricsProvider: ViewportMetricsProvider | null = null
  private viewportMetricsCleanup: (() => void) | null = null
  private enemySpawner: EnemySpawner | null = null
  private currentStageId = 1
  private battleOperational = false
  private resolutionMode: BattleResolutionMode | null = null
  private appliedLayout: BattleLayout | null = null

  onLoad() {
    this.viewportMetricsProvider = createDefaultViewportMetricsProvider(() => view.getFrameSize())
    const initialMetrics = this.viewportMetricsProvider.read()
    const initialLayout = this.applyViewportMetrics(initialMetrics)
    this.assembleScene(initialLayout)
    this.viewportMetricsCleanup = this.viewportMetricsProvider.subscribe((metrics) => this.relayoutVisibleArea(metrics))
    view.on('canvas-resize', this.onCanvasResize, this)
  }

  onDestroy() {
    this.destroyed = true
    this.stopRuntimeBinding()
    this.runtimeNode?.off('battle-stage-changed', this.onStageChanged, this)
    this.runtimeNode?.off('world-stage-cleared', this.dualModeController?.handleWorldCleared, this.dualModeController)
    if (this.dungeonRunController?.onExtractionRequested === this.dungeonExtractionRequest) {
      this.dungeonRunController.onExtractionRequested = null
    }
    this.dungeonExtractionRequest = null
    this.stageResourceController?.destroy()
    this.stageBackgroundController?.destroy()
    this.viewportMetricsCleanup?.()
    this.viewportMetricsCleanup = null
    this.viewportMetricsProvider?.destroy()
    this.viewportMetricsProvider = null
    view.off('canvas-resize', this.onCanvasResize, this)
  }

  update(deltaTime: number) {
    this.stageBackgroundController?.update(deltaTime)
  }

  private assembleScene(layout: BattleLayout) {
    if (this.assembled) return
    this.assembled = true

    const visibleHeight = layout.visibleHeight
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
    const worldRoot = this.createNode('WorldRoot', canvasNode, WIDTH, visibleHeight)
    const dungeonRoot = this.createNode('DungeonRoot', canvasNode, WIDTH, visibleHeight)
    dungeonRoot.active = false
    const dualMode = this.createDualModeControllers(canvasNode, worldRoot, dungeonRoot)
    const battleRoot = this.createNode('BattleRoot', worldRoot, WIDTH, visibleHeight)
    const worldLayer = this.createNode('WorldLayer', battleRoot, WIDTH, visibleHeight)
    const actorLayer = this.createNode('ActorLayer', battleRoot, WIDTH, visibleHeight)
    this.movementCoordinateSpace = actorLayer.getComponent(UITransform)
    const effectLayer = this.createNode('EffectLayer', battleRoot, WIDTH, visibleHeight)
    const dropLayer = this.createNode('DropLayer', battleRoot, WIDTH, visibleHeight)
    const inputLayer = this.createNode('InputLayer', battleRoot)
    this.configureInputLayer(inputLayer, layout)
    const hudLayer = this.createNode('HudLayer', battleRoot, WIDTH, visibleHeight)
    this.fullHeightNodes = [
      canvasNode,
      worldRoot,
      dungeonRoot,
      battleRoot,
      worldLayer,
      actorLayer,
      effectLayer,
      dropLayer,
      hudLayer,
    ]
    this.inputLayer = inputLayer

    this.createWorld(worldLayer, backgroundWidth, visibleHeight)
    const { player, controller, animator } = this.createPlayer(actorLayer, layout)
    const enemyPool = this.createRuntimePool(actorLayer, 'EnemyPool', 'enemy', 18, () => this.createEnemyNode())
    const enemySpawner = this.createNode('EnemySpawner', actorLayer).addComponent(EnemySpawner)
    this.enemySpawner = enemySpawner
    enemySpawner.enemyPool = enemyPool
    enemySpawner.playerTarget = player
    enemySpawner.configureBattleLayout(layout)
    const soulOrbPool = this.createRuntimePool(dropLayer, 'SoulOrbPool', 'soul-orb', 24, () => this.createSoulOrbNode())
    const damageNumberPool = this.createRuntimePool(effectLayer, 'DamageNumberPool', 'damage-number', 24, () => this.createDamageNumberNode())
    const audioController = effectLayer.addComponent(CombatAudioController)
    this.combatAudioController = audioController
    const bossEffectPool = this.createRuntimePool(
      effectLayer,
      'BossEffectPool',
      'boss-effect',
      BOSS_HAZARD_POOL_CAPACITY,
      () => this.createBossEffectNode(),
    )
    const bossTelegraphPresenter = effectLayer.addComponent(BossTelegraphPresenter)
    bossTelegraphPresenter.telegraphPool = bossEffectPool
    const hudParts = this.createHud(hudLayer, layout)
    const battleInput = this.createInput(inputLayer, controller, layout, this.movementCoordinateSpace)
    const runtime = this.loadRuntime(battleRoot, {
      enemySpawner,
      soulOrbPool,
      damageNumberPool,
      bossEffectPool,
      bossTelegraphPresenter,
      player,
      hud: hudParts.hud,
      stageClearPanel: hudParts.stageClearPanel,
      battleInput,
      dualMode,
    })
    this.createFlyingSword(effectLayer, runtime, controller, visibleHeight)

    player.setSiblingIndex(0)
  }

  private relayoutVisibleArea(metrics: Readonly<ViewportMetrics>) {
    const layout = this.applyViewportMetrics(metrics)
    const visibleHeight = layout.visibleHeight
    const backgroundWidth = WIDTH * (visibleHeight / HEIGHT)

    this.enemySpawner?.configureBattleLayout(layout)
    for (const node of this.fullHeightNodes) this.resizeNode(node, WIDTH, visibleHeight)
    this.resizeNode(this.farBackground, backgroundWidth, visibleHeight)
    this.resizeNode(this.midBackground, backgroundWidth, visibleHeight)
    this.configureInputLayer(this.inputLayer, layout)
    this.topHud?.setPosition(0, this.topHudY(layout), 0)
    this.bossHud?.setPosition(0, this.bossHudY(layout), 0)
    this.bottomNavigation?.setPosition(0, layout.navigationTop - NAV_HEIGHT / 2, 0)
    this.playerController?.configureBounds(layout.movement)
    if (this.movementCoordinateSpace) this.battleInput?.configure(layout.movement, this.movementCoordinateSpace)
  }

  private onCanvasResize() {
    const metrics = this.viewportMetricsProvider?.read()
    if (metrics) this.relayoutVisibleArea(metrics)
  }

  private applyViewportMetrics(metrics: Readonly<ViewportMetrics>): BattleLayout {
    const state = computeBattleViewportState({
      designWidth: WIDTH,
      cssWidth: metrics.cssWidth,
      cssHeight: metrics.cssHeight,
      topInsetPx: metrics.topInsetPx,
      bottomInsetPx: metrics.bottomInsetPx,
      viewportSizeValid: metrics.viewportSizeValid,
      previousMode: this.resolutionMode ?? undefined,
      previousLayout: this.appliedLayout,
    })
    const resolutionChanged = state.resolution.mode !== this.resolutionMode
    this.resolutionMode = state.resolution.mode
    this.appliedLayout = state.layout
    if (resolutionChanged) {
      const policy = state.resolution.mode === 'show-all'
        ? ResolutionPolicy.SHOW_ALL
        : ResolutionPolicy.FIXED_WIDTH
      view.setDesignResolutionSize(state.resolution.designWidth, state.resolution.designHeight, policy)
    }
    return state.layout
  }

  private configureInputLayer(node: Node | null, layout: BattleLayout) {
    if (!node) return
    const height = layout.visibleHeight / 2 - layout.navigationTop
    const transform = node.getComponent(UITransform)
    transform?.setContentSize(WIDTH, height)
    transform?.setAnchorPoint(0.5, -layout.navigationTop / height)
    node.setPosition(0, 0, 0)
  }

  private topHudY(layout: BattleLayout) {
    return layout.actorSafeRect.maxY + TOP_HUD_RESERVE - TOP_HUD_OFFSET
  }

  private bossHudY(layout: BattleLayout) {
    return layout.actorSafeRect.maxY + TOP_HUD_RESERVE - BOSS_HUD_OFFSET
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
    this.stageBackgroundController = new StageBackgroundController(far.sprite, mid.sprite)
    this.stageResourceController = new StageResourceController(this.stageBackgroundController)
    this.stageResourceController.activate(1)
  }

  private createDualModeControllers(parent: Node, worldRoot: Node, dungeonRoot: Node) {
    this.drawBand(dungeonRoot, WIDTH, HEIGHT, new Color(15, 24, 27, 255))
    const roomLabel = this.createLabel('DungeonRoomLabel', dungeonRoot, '', 28, 560, 54)

    const dungeonNode = this.createNode('DungeonRunController', dungeonRoot)
    const dungeonRun = dungeonNode.addComponent(DungeonRunController)
    dungeonRun.roomLabel = roomLabel
    this.dungeonRunController = dungeonRun

    const dualModeNode = this.createNode('DualModeGameController', parent)
    const dualMode = dualModeNode.addComponent(DualModeGameController)
    dualMode.worldRoot = worldRoot
    dualMode.dungeonRoot = dungeonRoot
    dualMode.dungeonRun = dungeonRun
    this.dualModeController = dualMode
    this.dungeonExtractionRequest = (payload) => dualMode.handleDungeonExtracted(payload)
    dungeonRun.onExtractionRequested = this.dungeonExtractionRequest

    const profilePath = 'Data/dual-mode-slice'
    resources.load(profilePath, JsonAsset, (error, asset) => {
      if (this.destroyed) return
      if (error || !asset) {
        this.showLoadError(profilePath)
        return
      }
      dungeonRun.profileData = asset
    })
    return dualMode
  }

  private createPlayer(parent: Node, layout: BattleLayout) {
    const player = this.createSpriteNode('Player', parent, PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT)
    player.node.setPosition(-210, -80, 0)
    player.node.setScale(PLAYER_DISPLAY_SCALE, PLAYER_DISPLAY_SCALE, 1)
    const animator = player.node.addComponent(AtlasAnimator)
    animator.targetSprite = player.sprite
    animator.actorId = 'qinglan-sword-cultivator'
    const controller = player.node.addComponent(PlayerController)
    controller.configureMovement({ x: -210, y: -80 }, controller.moveSpeed, layout.movement)
    this.playerController = controller
    player.node.on('player-animation-requested', (action: string) => animator.play(action), this)

    const atlasPath = 'Data/animation-atlas'
    resources.load(atlasPath, JsonAsset, (error, asset) => {
      if (error || !asset) {
        this.showLoadError(atlasPath)
        return
      }
      animator.animationManifest = asset
      controller.replayPresentationAction()
    })
    return { player: player.node, controller, animator }
  }

  private loadRuntime(parent: Node, bindings: {
    enemySpawner: EnemySpawner
    soulOrbPool: NodePoolController
    damageNumberPool: NodePoolController
    bossEffectPool: NodePoolController
    bossTelegraphPresenter: BossTelegraphPresenter
    player: Node
    hud: BattleHudController
    stageClearPanel: StageClearPanelController
    battleInput: BattleInputController
    dualMode: DualModeGameController
  }) {
    const runtimeNode = this.createNode('Runtime', parent)
    const { dualMode } = bindings
    this.runtimeNode = runtimeNode
    this.combatAudioController?.bindFeedbackSource(runtimeNode)
    runtimeNode.on('battle-stage-changed', this.onStageChanged, this)
    runtimeNode.on('world-stage-cleared', dualMode.handleWorldCleared, dualMode)
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
      runtime.bossTelegraphPresenter = bindings.bossTelegraphPresenter
      runtime.playerNode = bindings.player
      runtime.hud = bindings.hud
      runtime.stageClearPanel = bindings.stageClearPanel
      runtime.battleInput = bindings.battleInput
      bindings.stageClearPanel.onContinue = (nextStageId) => runtime.advanceToStage(nextStageId)
      bindings.stageClearPanel.onRetry = () => runtime.retryCurrentStage()
      runtime.initialize()
      state = { status: 'ready', runtime }
    })
    return () => state
  }

  private onStageChanged(payload: { stageId: number; backgroundId: string; theme: string }) {
    this.currentStageId = payload.stageId
    this.stageResourceController?.activate(payload.stageId)
    if (!this.battleOperational) return
    this.stageResourceController?.prefetchNext(payload.stageId)
  }

  private createFlyingSword(
    parent: Node,
    getRuntime: () => RuntimeLoadState,
    controller: PlayerController,
    visibleHeight: number,
  ) {
    const skillNode = this.createNode('FlyingSwordSkill', parent, WIDTH, visibleHeight)
    this.combatAudioController?.bindFeedbackSource(skillNode)
    this.fullHeightNodes.push(skillNode)
    const sword = this.createSpriteNode('Sword', skillNode, 176, 44)
    sword.node.active = false
    this.loadSprite('Assets/Skills/FlyingSword/sword-projectile-v2/spriteFrame', sword.sprite)
    const skill = skillNode.addComponent(FlyingSwordSkill)
    skill.sword = sword.node
    let actionToken: Readonly<PlayerActionToken> | null = null
    skillNode.on('player-action-requested', (action: string) => {
      actionToken = controller.requestPresentationAction(action, 'flying-sword')
    }, this)
    skillNode.on('player-action-completed', () => {
      if (!actionToken) return
      const completedToken = actionToken
      actionToken = null
      controller.completePresentationAction(completedToken)
    }, this)
    const bindRuntime = () => {
      const state = getRuntime()
      if (this.destroyed || state.status === 'failed') {
        this.stopRuntimeBinding(bindRuntime)
        return
      }
      if (state.status !== 'ready') return
      skill.battleRuntime = state.runtime
      this.battleOperational = true
      this.stageResourceController?.prefetchNext(this.currentStageId)
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

  private createInput(
    inputLayer: Node,
    player: PlayerController,
    layout: BattleLayout,
    coordinateSpace: UITransform | null,
  ) {
    const inputArea = inputLayer.getComponent(UITransform)
    const input = inputLayer.addComponent(BattleInputController)
    input.player = player
    input.bindInputArea(inputArea)
    if (coordinateSpace) input.configure(layout.movement, coordinateSpace)
    this.battleInput = input
    return input
  }

  private createHud(parent: Node, layout: BattleLayout) {
    const topHud = this.createNode('TopHud', parent, WIDTH, 126)
    this.topHud = topHud
    topHud.setPosition(0, this.topHudY(layout), 0)
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
    bossRoot.setPosition(0, this.bossHudY(layout), 0)
    this.drawBand(bossRoot, WIDTH, 62, new Color(35, 13, 17, 220))
    const bossNameLabel = this.createLabel('BossNameLabel', bossRoot, '', 22, 170, 32)
    bossNameLabel.node.setPosition(-260, 0, 0)
    const bossHealth = this.createBar('BossHealthBar', bossRoot, new Color(190, 48, 64, 255), 82, 430)
    bossHealth.root.setPosition(120, 0, 0)

    const bottomNavigation = this.createNode('BottomNavigation', parent, WIDTH, NAV_HEIGHT)
    this.bottomNavigation = bottomNavigation
    bottomNavigation.setPosition(0, layout.navigationTop - NAV_HEIGHT / 2, 0)
    this.drawBand(bottomNavigation, WIDTH, NAV_HEIGHT, new Color(12, 22, 25, 238))
    const navLabels = ['战斗', '副本', '抽卡', '装备', '背包', '法宝']
    navLabels.forEach((text, index) => {
      const label = this.createLabel(`Nav${index + 1}`, bottomNavigation, text, 23, 125, NAV_HEIGHT)
      label.node.setPosition(-312.5 + index * 125, 0, 0)
      label.color = index === 0 ? new Color(230, 199, 112, 255) : new Color(205, 215, 211, 255)
    })

    const stageClear = this.createNode('StageClearPanel', parent, 472, 214)
    stageClear.setPosition(0, 8, 0)
    this.drawBand(stageClear, 472, 214, new Color(7, 18, 23, 240))
    const clearTitle = this.createLabel('ClearTitle', stageClear, '守关突破', 30, 430, 42)
    clearTitle.node.setPosition(0, 66, 0)
    clearTitle.color = new Color(244, 208, 103, 255)
    const rewardLabel = this.createLabel('RewardLabel', stageClear, '', 18, 430, 36)
    rewardLabel.node.setPosition(0, 16, 0)
    const continueNode = this.createNode('ContinueButton', stageClear, 238, 50)
    continueNode.setPosition(0, -58, 0)
    this.drawBand(continueNode, 238, 50, new Color(35, 129, 126, 255))
    const continueLabel = this.createLabel('ContinueLabel', continueNode, '前往下一关', 22, 222, 46)
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
    hud.updateHero({ realm: '筑基三重', health: 220, maxHealth: 220, mana: 12, maxMana: 12 })
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
    transform.setContentSize(ORDINARY_ENEMY_FRAME_WIDTH, ORDINARY_ENEMY_FRAME_HEIGHT)
    const visualNode = this.createSpriteNode(
      'Visual',
      node,
      ORDINARY_ENEMY_FRAME_WIDTH,
      ORDINARY_ENEMY_FRAME_HEIGHT,
    )
    const animator = visualNode.node.addComponent(AtlasAnimator)
    animator.targetSprite = visualNode.sprite
    animator.updateInterval = 0.05
    const controller = node.addComponent(EnemyController)
    controller.moveSpeed = 78
    const visual = node.addComponent(EnemyVisualController)
    visual.animator = animator
    node.addComponent(PoolableActor)
    node.on('enemy-runtime-spawned', (_enemyId: number, profile: { id: string; role: string }) => {
      controller.moveSpeed = profile.role === 'boss' ? 54 : profile.role === 'flying' ? 86 : 76
      this.bindAnimationManifest(visual, animator, 'move')
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
    node.addComponent(UITransform).setContentSize(1, 1)
    const graphics = node.addComponent(Graphics)
    const talismanNode = new Node('Talisman')
    talismanNode.layer = UI_LAYER
    talismanNode.addComponent(UITransform).setContentSize(112, 112)
    const talisman = talismanNode.addComponent(Sprite)
    node.addChild(talismanNode)
    const visual = node.addComponent(BossHazardVisualController)
    visual.graphics = graphics
    visual.talisman = talisman
    node.addComponent(PoolableActor)
    node.on('pool-despawned', visual.resetVisual, visual)
    visual.resetVisual()
    return node
  }

  private bindAnimationManifest(visual: EnemyVisualController, animator: AtlasAnimator, initialAction: string) {
    const token = visual.beginManifestLoad()
    resources.load('Data/animation-atlas', JsonAsset, (error, asset) => {
      if (error || !asset || !animator.node.isValid) return
      if (!visual.acceptManifestLoad(token)) return
      animator.animationManifest = asset
      visual.node.emit('enemy-visual-frame-ready', visual.node)
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
