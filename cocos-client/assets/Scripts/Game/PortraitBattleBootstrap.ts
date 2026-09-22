import {
  _decorator,
  Asset,
  AudioClip,
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
  Texture2D,
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
import { computeDungeonEntryNavLayout } from './DungeonEntryLayout.ts'
import type { BattleLayout, BattleResolutionMode } from '../Combat/BattleLayout.ts'
import { createWorldRegion, selectWorldStage } from '../Core/World/WorldRegion.ts'
import type { WorldEncounterKind } from '../Core/World/WorldRegion.ts'
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
import { DungeonRunPresenter } from './DungeonRunPresenter'
import { DungeonResourceController } from './DungeonResourceController'
import type { DungeonCommand, DungeonRunEvent } from '../Core/Dungeon/DungeonTypes.ts'
import { dungeonFloorVisualFor } from '../Core/Dungeon/DungeonVisualCatalog.ts'
import {
  planDungeonEncounter,
  planPursuitEncounter,
  type DungeonEncounterCatalog,
} from '../Core/Dungeon/DungeonEncounterDirector.ts'
import { startDungeonEncounterWithRecovery } from '../Core/Dungeon/DungeonEncounterStart.ts'
import { StageBackgroundController } from './StageBackgroundController'
import { StageResourceController } from './StageResourceController'
import { createDefaultViewportMetricsProvider } from './ViewportMetrics.ts'
import type { ViewportMetrics, ViewportMetricsProvider } from './ViewportMetrics.ts'
import { buildWorldStageSelectPage } from './WorldStageSelectPageAssembler'
import type { WorldStageSelectPage } from './WorldStageSelectPageAssembler'

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

interface WorldStageDesignEntry {
  readonly id: number
  readonly name: string
  readonly encounter: WorldEncounterKind
}

type RuntimeLoadState =
  | { status: 'loading' }
  | { status: 'ready'; runtime: BattleRuntimeController }
  | { status: 'failed' }

type DungeonAgentBridge = {
  ready: () => boolean
  resourceStatus: () => unknown
  uiLayout: () => unknown
  enterDungeon: (seed?: number) => boolean
  snapshot: () => unknown
  bossCombatStatus: () => unknown
  command: (command: DungeonCommand) => unknown
  advance: (seconds: number) => unknown
  completeEncounter: () => unknown
  closeSettlement: () => boolean
}

type DungeonAgentGlobal = typeof globalThis & {
  __M3_DUNGEON_AGENT__?: DungeonAgentBridge
}

@ccclass('PortraitBattleBootstrap')
export class PortraitBattleBootstrap extends Component {
  private fullHeightNodes: Node[] = []
  private farBackground: Node | null = null
  private midBackground: Node | null = null
  private inputLayer: Node | null = null
  private topHud: Node | null = null
  private bossHud: Node | null = null
  private bottomNavigation: Node | null = null
  private dungeonEntryNode: Node | null = null
  private worldDungeonStatusLabel: Label | null = null
  private loadErrorLabel: Label | null = null
  private bindRuntimeCallback: (() => void) | null = null
  private destroyed = false
  private assembled = false
  private runtimeNode: Node | null = null
  private battleRoot: Node | null = null
  private sharedCombatRoot: Node | null = null
  private worldPresentationRoot: Node | null = null
  private dungeonPresentationRoot: Node | null = null
  private battleRuntimeController: BattleRuntimeController | null = null
  private dungeonRunController: DungeonRunController | null = null
  private dungeonPresenter: DungeonRunPresenter | null = null
  private dungeonResources: DungeonResourceController | null = null
  private dungeonEncounterCatalog: DungeonEncounterCatalog | null = null
  private dungeonRuntimeRunId = ''
  private dungeonEncounterRoomId = ''
  private pendingPursuitHunt: 1 | 2 | 3 | null = null
  private dungeonFloorSyncKey = ''
  private dungeonFloorSyncPending = false
  private nextDungeonResourceRetryAt = 0
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
  private worldStageEntryNode: Node | null = null
  private worldStageSelectPage: WorldStageSelectPage | null = null
  private worldStageData: readonly WorldStageDesignEntry[] = []

  onLoad() {
    this.viewportMetricsProvider = createDefaultViewportMetricsProvider(() => view.getFrameSize())
    const initialMetrics = this.viewportMetricsProvider.read()
    const initialLayout = this.applyViewportMetrics(initialMetrics)
    this.assembleScene(initialLayout, initialMetrics)
    this.viewportMetricsCleanup = this.viewportMetricsProvider.subscribe((metrics) => this.relayoutVisibleArea(metrics))
    view.on('canvas-resize', this.onCanvasResize, this)
    this.installDungeonAgentBridge()
  }

  onDestroy() {
    this.destroyed = true
    const agentGlobal = globalThis as DungeonAgentGlobal
    if (agentGlobal.__M3_DUNGEON_AGENT__) delete agentGlobal.__M3_DUNGEON_AGENT__
    this.stopRuntimeBinding()
    this.runtimeNode?.off('battle-stage-changed', this.onStageChanged, this)
    this.runtimeNode?.off('battle-runtime-ready')
    this.playerController?.node.off('player-defeated', this.onDungeonPlayerDefeated, this)
    this.runtimeNode?.off('world-stage-cleared', this.dualModeController?.handleWorldCleared, this.dualModeController)
    this.worldStageSelectPage?.destroy()
    this.dungeonEntryNode?.off(Button.EventType.CLICK, this.enterDungeonFromWorld, this)
    this.dualModeController?.node.off('dungeon-entry-rejected', this.onDungeonEntryRejected, this)
    this.dualModeController?.node.off('dungeon-entry-accepted', this.onDungeonEntryAccepted, this)
    this.dualModeController?.node.off('dungeon-extraction-accepted', this.onDungeonTerminalAccepted, this)
    this.dualModeController?.node.off('dungeon-defeat-accepted', this.onDungeonTerminalAccepted, this)
    this.dualModeController?.node.off('dungeon-abandon-accepted', this.onDungeonTerminalAccepted, this)
    if (this.dungeonRunController) this.dungeonRunController.onRunEvent = null
    if (this.battleRuntimeController) this.battleRuntimeController.onDungeonEncounterCompleted = null
    this.dungeonPresenter?.bindController(null)
    this.dungeonResources?.destroy()
    this.dungeonResources = null
    this.stageResourceController?.destroy()
    this.stageBackgroundController?.destroy()
    this.viewportMetricsCleanup?.()
    this.viewportMetricsCleanup = null
    this.viewportMetricsProvider?.destroy()
    this.viewportMetricsProvider = null
    view.off('canvas-resize', this.onCanvasResize, this)
  }

  private installDungeonAgentBridge(): void {
    const query = new URLSearchParams(globalThis.location?.search ?? '')
    if (!query.has('gameAgent')) return
    const agentGlobal = globalThis as DungeonAgentGlobal
    agentGlobal.__M3_DUNGEON_AGENT__ = {
      ready: () => Boolean(this.dualModeController && this.dungeonRunController?.isReady()),
      resourceStatus: () => this.dungeonResources?.status() ?? { state: 'missing' },
      uiLayout: () => this.dungeonPresenter?.getLayoutSnapshot() ?? null,
      enterDungeon: (seed) => Boolean(this.dualModeController?.enterDungeon(seed)),
      snapshot: () => this.dungeonRunController?.getRunSnapshot() ?? null,
      bossCombatStatus: () => this.battleRuntimeController?.getBossAgentSnapshot() ?? null,
      command: (command) => this.applyDungeonCommand(command),
      advance: (seconds) => {
        const steps = Math.min(3000, Math.max(0, Math.ceil(Number(seconds) * 10)))
        for (let index = 0; index < steps; index += 1) this.dungeonRunController?.update(0.1)
        this.refreshDungeonPresentation()
        return this.dungeonRunController?.getRunSnapshot() ?? null
      },
      completeEncounter: () => {
        const phase = this.dungeonRunController?.getRunSnapshot()?.pursuer.phase
        if (phase === 'first-hunt' || phase === 'second-hunt') {
          return this.dungeonRunController?.handleBattleCompleted({ type: 'pursuer-damage', effectiveDamage: 600 }) ?? null
        }
        if (phase === 'final-fight') {
          return this.dungeonRunController?.handleBattleCompleted({ type: 'pursuer-damage', effectiveDamage: 1200 }) ?? null
        }
        this.battleRuntimeController?.enterDungeonExplorationMode()
        return { accepted: true, events: [] }
      },
      closeSettlement: () => this.dungeonRunController?.acknowledgeTerminalResult() ?? false,
    }
  }

  update(deltaTime: number) {
    this.stageBackgroundController?.update(deltaTime)
    this.attachSharedCombatToActiveMode()
    this.syncActiveDungeonMode()
  }

  private assembleScene(layout: BattleLayout, metrics: Readonly<ViewportMetrics>) {
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
    const sharedCombatRoot = this.createNode('SharedCombatRoot', canvasNode, WIDTH, visibleHeight)
    const actorLayer = this.createNode('SharedActorLayer', sharedCombatRoot, WIDTH, visibleHeight)
    this.movementCoordinateSpace = actorLayer.getComponent(UITransform)
    const effectLayer = this.createNode('SharedEffectLayer', sharedCombatRoot, WIDTH, visibleHeight)
    const dropLayer = this.createNode('SharedDropLayer', sharedCombatRoot, WIDTH, visibleHeight)
    const inputLayer = this.createNode('SharedInputLayer', sharedCombatRoot)
    this.configureInputLayer(inputLayer, layout)
    const worldRoot = this.createNode('WorldRoot', canvasNode, WIDTH, visibleHeight)
    const dungeonRoot = this.createNode('DungeonRoot', canvasNode, WIDTH, visibleHeight)
    dungeonRoot.active = false
    const worldLayer = this.createNode('WorldLayer', worldRoot, WIDTH, visibleHeight)
    const hudLayer = this.createNode('WorldHudLayer', worldRoot, WIDTH, visibleHeight)
    this.battleRoot = sharedCombatRoot
    this.sharedCombatRoot = sharedCombatRoot
    this.worldPresentationRoot = worldRoot
    this.dungeonPresentationRoot = dungeonRoot
    this.fullHeightNodes = [
      canvasNode,
      sharedCombatRoot,
      worldRoot,
      dungeonRoot,
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
    const dualMode = this.createDualModeControllers(
      canvasNode,
      worldRoot,
      dungeonRoot,
      actorLayer,
      effectLayer,
      dropLayer,
      inputLayer,
      player,
      metrics,
    )
    if (!this.worldStageEntryNode) throw new Error('World stage entry button was not assembled.')
    this.worldStageSelectPage = buildWorldStageSelectPage({
      parent: worldRoot,
      battleRoot: sharedCombatRoot,
      entryNode: this.worldStageEntryNode,
      metrics,
      getHighestClearedWorldStage: () => this.dualModeController?.getHighestClearedWorldStage() ?? 0,
      advanceToStage: (stageId) => this.battleRuntimeController?.advanceToStage(stageId),
    })
    const battleInput = this.createInput(inputLayer, controller, layout, this.movementCoordinateSpace)
    const runtime = this.loadRuntime(sharedCombatRoot, {
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
    if (this.runtimeNode) this.bindDungeonRuntime(this.runtimeNode)
    this.createFlyingSword(effectLayer, runtime, controller, visibleHeight)
    this.attachSharedCombatRoot(worldRoot)

    player.setSiblingIndex(actorLayer.children.length - 1)
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
    this.dungeonPresenter?.configureViewport(metrics)
    this.worldStageSelectPage?.relayout(metrics)
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

  private createDualModeControllers(
    parent: Node,
    worldRoot: Node,
    dungeonRoot: Node,
    actorLayer: Node,
    effectLayer: Node,
    dropLayer: Node,
    inputLayer: Node,
    player: Node,
    metrics: Readonly<ViewportMetrics>,
  ) {
    const dungeonNode = this.createNode('DungeonRunController', dungeonRoot)
    const dungeonRun = dungeonNode.addComponent(DungeonRunController)
    this.dungeonRunController = dungeonRun
    const presenter = dungeonRoot.addComponent(DungeonRunPresenter)
    presenter.sharedActorLayer = actorLayer
    presenter.sharedEffectLayer = effectLayer
    presenter.sharedDropLayer = dropLayer
    presenter.sharedInputLayer = inputLayer
    presenter.playerTarget = player
    presenter.bindController(dungeonRun)
    presenter.configureViewport(metrics)
    presenter.onSharedCombatPauseChanged = (paused) => {
      dungeonRun.setPaused(paused)
      this.battleInput?.setInputEnabled(!paused)
    }
    presenter.onCommandRequested = (command) => this.applyDungeonCommand(command)
    dungeonRun.onRunEvent = (event) => this.onDungeonRunEvent(event)
    this.dungeonPresenter = presenter
    this.dungeonResources = this.createDungeonResources(presenter)
    void this.dungeonResources.prepareEntry()

    const dualModeNode = this.createNode('DualModeGameController', parent)
    const dualMode = dualModeNode.addComponent(DualModeGameController)
    dualMode.worldRoot = worldRoot
    dualMode.dungeonRoot = dungeonRoot
    dualMode.dungeonRun = dungeonRun
    this.dualModeController = dualMode
    dualModeNode.on('dungeon-entry-rejected', this.onDungeonEntryRejected, this)
    dualModeNode.on('dungeon-entry-accepted', this.onDungeonEntryAccepted, this)
    dualModeNode.on('dungeon-extraction-accepted', this.onDungeonTerminalAccepted, this)
    dualModeNode.on('dungeon-defeat-accepted', this.onDungeonTerminalAccepted, this)
    dualModeNode.on('dungeon-abandon-accepted', this.onDungeonTerminalAccepted, this)

    const profilePath = 'Data/dual-mode-slice'
    resources.load(profilePath, JsonAsset, (error, asset) => {
      if (this.destroyed) return
      if (error || !asset) {
        this.showLoadError(profilePath)
        return
      }
      dungeonRun.profileData = asset
    })
    resources.load('Data/dungeon-encounters', JsonAsset, (error, asset) => {
      if (this.destroyed || error || !asset) return
      this.dungeonEncounterCatalog = asset.json as DungeonEncounterCatalog
      if (dungeonRoot.active) {
        this.syncActiveDungeonMode()
      }
    })
    return dualMode
  }

  private enterDungeonFromWorld() {
    if (this.worldDungeonStatusLabel) this.worldDungeonStatusLabel.string = ''
    this.dualModeController?.enterDungeon()
  }

  private onDungeonEntryRejected(payload: { reason?: string } | undefined) {
    if (this.worldDungeonStatusLabel) {
      this.worldDungeonStatusLabel.string = payload?.reason === 'missing-pass' ? 'Boss pass required' : 'Entry unavailable'
    }
  }

  private onDungeonEntryAccepted() {
    if (this.worldDungeonStatusLabel) this.worldDungeonStatusLabel.string = ''
    this.syncActiveDungeonMode()
  }

  private onDungeonTerminalAccepted() {
    this.resetDungeonModeSync()
    this.attachSharedCombatRoot(this.worldPresentationRoot)
    this.battleRuntimeController?.restoreWorldStage()
  }

  private applyDungeonCommand(command: DungeonCommand) {
    const result = this.dungeonRunController?.applyCommand(command)
    if (!result?.accepted) this.dungeonPresenter?.setInteractionHint('当前无法执行')
    this.refreshDungeonPresentation()
    return result ?? { accepted: false, reason: 'controller-not-ready', events: [] }
  }

  private onDungeonRunEvent(event: DungeonRunEvent) {
    this.dungeonPresenter?.presentRunEvent(event)
    if (event.type === 'room-entered') {
      this.dungeonEncounterRoomId = ''
      this.pendingPursuitHunt = null
      this.dungeonFloorSyncKey = ''
      this.beginDungeonRoomEncounter(event.roomId)
    }
    if (event.type === 'pursuer-hunt-started') this.beginPursuitEncounter(event.hunt)
    if (event.type === 'altar-activated') this.beginPursuitEncounter(3)
    this.refreshDungeonPresentation()
  }

  private refreshDungeonPresentation() {
    const snapshot = this.dungeonRunController?.getRunSnapshot()
    if (!snapshot) return
    const profile = this.dungeonRunController?.profileData?.json as {
      rooms?: Array<{ id: string; floor: 1 | 2 | 3; exits?: Array<{ id: string; to: string }> }>
    } | undefined
    const room = profile?.rooms?.find((candidate) => candidate.id === snapshot.map.currentRoomId)
    const floor = room?.floor ?? 1
    this.dungeonPresenter?.presentHud({
      health: 220,
      floor,
      pressure: snapshot.pressure.elapsedSeconds,
      carriedLootCount: snapshot.carriedLoot.reduce((sum, item) => sum + item.amount, 0),
    })
    const sealed = new Set(snapshot.map.sealedExitIds)
    const available = room?.exits?.filter((exit) => !sealed.has(exit.id)) ?? []
    const preferred = available.find((exit) => !snapshot.map.revealedRoomIds.includes(exit.to)) ?? available[0]
    this.dungeonPresenter?.setAvailableExit(preferred?.id ?? null)
  }

  private createDungeonResources(presenter: DungeonRunPresenter) {
    return new DungeonResourceController<Asset>({
      load: (descriptor) => new Promise((resolve, reject) => {
        const assetType = descriptor.kind === 'spriteFrame'
          ? SpriteFrame
          : descriptor.kind === 'audioClip' ? AudioClip : Texture2D
        resources.load(descriptor.path, assetType, (error: Error | null, asset: Asset | null) => {
          if (error || !asset) {
            reject(error ?? new Error(`Missing dungeon resource: ${descriptor.path}`))
            return
          }
          asset.addRef()
          resolve(asset)
        })
      }),
      release: (_descriptor, resource) => resource.decRef(),
      showFloor: (floor, loaded) => {
        const visual = dungeonFloorVisualFor('mist-vault', floor)
        presenter.showFloor(
          loaded.get(visual.farPath) as SpriteFrame | null,
          loaded.get(visual.midPath) as SpriteFrame | null,
        )
      },
    })
  }

  private bindDungeonRuntime(runtimeNode: Node) {
    const bind = () => {
      const runtime = runtimeNode.getComponent(BattleRuntimeController)
      if (!runtime) return false
      runtime.onDungeonEncounterCompleted = (result) => {
        if (result.completion === 'repel' || result.completion === 'kill') {
          this.dungeonRunController?.handleBattleCompleted({
            type: 'pursuer-damage',
            effectiveDamage: result.completion === 'kill' ? 1200 : 600,
          })
        }
        runtime.enterDungeonExplorationMode()
      }
      runtime.playerNode?.on('player-defeated', this.onDungeonPlayerDefeated, this)
      return true
    }
    if (!bind()) runtimeNode.once('battle-runtime-ready', bind, this)
  }

  private onDungeonPlayerDefeated() {
    if (this.dualModeController?.dungeonRoot?.active) {
      this.dungeonRunController?.handleBattleCompleted({ type: 'player-defeated' })
    }
  }

  private beginDungeonRoomEncounter(roomId: string) {
    const catalog = this.dungeonEncounterCatalog
    const snapshot = this.dungeonRunController?.getRunSnapshot()
    const runtime = this.battleRuntimeController
    if (!catalog || !snapshot || !runtime) return false
    const started = startDungeonEncounterWithRecovery(
      () => runtime.beginDungeonEncounter(planDungeonEncounter(catalog, roomId, snapshot.seed)),
      () => runtime.enterDungeonExplorationMode(),
    )
    if (!started) {
      this.dungeonPresenter?.setInteractionHint('战斗加载失败，正在重试')
      return false
    }
    this.dungeonEncounterRoomId = roomId
    return true
  }

  private async activateCurrentDungeonFloor(): Promise<boolean> {
    const resources = this.dungeonResources
    if (!resources) return false
    let prepared = resources.isReady() || await resources.prepareEntry()
    if (!prepared && resources.status().state === 'retry') prepared = await resources.retryPreparation()
    if (!prepared) {
      this.dungeonPresenter?.setInteractionHint('场景加载失败，请稍后重试')
      return false
    }
    if (!this.dungeonPresentationRoot?.active) return false
    const snapshot = this.dungeonRunController?.getRunSnapshot()
    const profile = this.dungeonRunController?.profileData?.json as {
      rooms?: Array<{ id: string; floor: 1 | 2 | 3 }>
    } | undefined
    const floor = profile?.rooms?.find((room) => room.id === snapshot?.map.currentRoomId)?.floor ?? 1
    return resources.activateFloor(floor)
  }

  private syncActiveDungeonMode() {
    if (!this.dungeonPresentationRoot?.active) return
    const snapshot = this.dungeonRunController?.getRunSnapshot()
    if (!snapshot) return
    this.attachSharedCombatRoot(this.dungeonPresentationRoot)
    this.refreshDungeonPresentation()

    const runtime = this.battleRuntimeController
    if (runtime && this.dungeonRuntimeRunId !== snapshot.runId) {
      runtime.enterDungeonExplorationMode()
      this.dungeonRuntimeRunId = snapshot.runId
      this.dungeonEncounterRoomId = ''
      this.pendingPursuitHunt = null
    }
    if (runtime && this.dungeonEncounterCatalog && this.dungeonEncounterRoomId !== snapshot.map.currentRoomId) {
      this.beginDungeonRoomEncounter(snapshot.map.currentRoomId)
    }
    if (runtime && this.pendingPursuitHunt !== null) this.tryStartPendingPursuitEncounter()

    const floorKey = `${snapshot.runId}:${snapshot.map.currentRoomId}`
    if (
      this.dungeonFloorSyncKey !== floorKey
      && !this.dungeonFloorSyncPending
      && Date.now() >= this.nextDungeonResourceRetryAt
    ) {
      this.dungeonFloorSyncPending = true
      void this.activateCurrentDungeonFloor().then((activated) => {
        if (activated) {
          this.dungeonFloorSyncKey = floorKey
          this.nextDungeonResourceRetryAt = 0
        } else {
          this.nextDungeonResourceRetryAt = Date.now() + 2000
        }
      }).finally(() => {
        this.dungeonFloorSyncPending = false
      })
    }
  }

  private resetDungeonModeSync() {
    this.dungeonRuntimeRunId = ''
    this.dungeonEncounterRoomId = ''
    this.pendingPursuitHunt = null
    this.dungeonFloorSyncKey = ''
    this.dungeonFloorSyncPending = false
    this.nextDungeonResourceRetryAt = 0
  }

  private attachSharedCombatToActiveMode() {
    if (this.dungeonPresentationRoot?.active) {
      this.attachSharedCombatRoot(this.dungeonPresentationRoot)
    } else if (this.worldPresentationRoot?.active) {
      this.attachSharedCombatRoot(this.worldPresentationRoot)
    }
  }

  private attachSharedCombatRoot(parent: Node | null) {
    const shared = this.sharedCombatRoot
    if (!shared || !parent) return
    if (shared.parent !== parent) shared.parent = parent
    const backgroundName = parent === this.dungeonPresentationRoot ? 'DungeonWorldLayer' : 'WorldLayer'
    const backgroundIndex = parent.children.findIndex((child) => child.name === backgroundName)
    shared.setSiblingIndex(Math.max(0, backgroundIndex + 1))
  }

  private beginPursuitEncounter(hunt: 1 | 2 | 3) {
    this.pendingPursuitHunt = hunt
    return this.tryStartPendingPursuitEncounter()
  }

  private tryStartPendingPursuitEncounter() {
    const hunt = this.pendingPursuitHunt
    const catalog = this.dungeonEncounterCatalog
    const runtime = this.battleRuntimeController
    if (hunt === null || !catalog || !runtime) return false
    const started = startDungeonEncounterWithRecovery(
      () => runtime.beginDungeonEncounter(planPursuitEncounter(catalog, hunt)),
      () => runtime.enterDungeonExplorationMode(),
    )
    if (!started) {
      this.dungeonPresenter?.setInteractionHint('追击战加载失败，正在重试')
      return false
    }
    this.pendingPursuitHunt = null
    return true
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
      const design = asset.json as { worldStages?: readonly WorldStageDesignEntry[] }
      this.worldStageData = Array.isArray(design.worldStages) ? design.worldStages : []
      const region = createWorldRegion('mist-frontier', this.worldStageData)
      runtime.canAdvanceToStage = (stageId) => selectWorldStage(
        region,
        dualMode.getHighestClearedWorldStage(),
        stageId,
      ).ok
      bindings.stageClearPanel.onContinue = (result) => {
        if (result.action.kind === 'region-complete') {
          if (dualMode.getHighestClearedWorldStage() < result.stageId) return false
          bindings.stageClearPanel.hide()
          return true
        }
        return runtime.advanceToStage(result.action.stageId).ok
      }
      bindings.stageClearPanel.onRetry = () => runtime.retryCurrentStage()
      this.battleRuntimeController = runtime
      runtimeNode.emit('battle-runtime-ready', runtime)
      this.worldStageSelectPage?.bind(this.worldStageData)
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
    const dungeonEntryLayout = computeDungeonEntryNavLayout(layout.navigationTop, NAV_HEIGHT)
    bottomNavigation.setPosition(0, dungeonEntryLayout.navigation.centerY, 0)
    this.drawBand(bottomNavigation, WIDTH, NAV_HEIGHT, new Color(12, 22, 25, 238))
    const navLabels = ['战斗', '副本', '抽卡', '装备', '背包', '法宝']
    navLabels.forEach((text, index) => {
      const isEntry = index <= 1
      const parentNode = index === 0
        ? this.createNode('WorldStageEntryButton', bottomNavigation, 125, NAV_HEIGHT)
        : index === 1
          ? this.createNode('DungeonEntryButton', bottomNavigation, 125, NAV_HEIGHT)
          : bottomNavigation
      if (isEntry) parentNode.setPosition(-312.5 + index * 125, 0, 0)
      if (index === 0) {
        this.worldStageEntryNode = parentNode
        parentNode.addComponent(Button)
      } else if (index === 1) {
        const dungeonEntryNode = parentNode
        this.dungeonEntryNode = dungeonEntryNode
        dungeonEntryNode.addComponent(Button)
        dungeonEntryNode.on(Button.EventType.CLICK, this.enterDungeonFromWorld, this)
      }
      const labelHeight = index === 1 ? dungeonEntryLayout.label.height : NAV_HEIGHT
      const label = this.createLabel(`Nav${index + 1}`, parentNode, text, 23, 125, labelHeight)
      const labelY = index === 1 ? dungeonEntryLayout.label.centerY - dungeonEntryLayout.navigation.centerY : 0
      label.node.setPosition(isEntry ? 0 : -312.5 + index * 125, labelY, 0)
      label.color = index === 0 ? new Color(230, 199, 112, 255) : new Color(205, 215, 211, 255)
      if (index === 1) {
        this.worldDungeonStatusLabel = this.createLabel(
          'DungeonEntryStatusLabel', parentNode, '', 14, 121, dungeonEntryLayout.status.height,
        )
        const statusY = dungeonEntryLayout.status.centerY - dungeonEntryLayout.navigation.centerY
        this.worldDungeonStatusLabel.node.setPosition(0, statusY, 0)
        this.worldDungeonStatusLabel.color = new Color(241, 169, 104, 255)
      }
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
    const mainShapeNode = new Node('MainShape')
    mainShapeNode.layer = UI_LAYER
    mainShapeNode.addComponent(UITransform).setContentSize(1, 1)
    const mainShape = mainShapeNode.addComponent(Sprite)
    mainShape.sizeMode = Sprite.SizeMode.CUSTOM
    node.addChild(mainShapeNode)
    const accentNode = new Node('Accent')
    accentNode.layer = UI_LAYER
    accentNode.addComponent(UITransform).setContentSize(1, 1)
    const accent = accentNode.addComponent(Sprite)
    accent.sizeMode = Sprite.SizeMode.CUSTOM
    node.addChild(accentNode)
    const particleNearNode = new Node('ParticleNear')
    particleNearNode.layer = UI_LAYER
    particleNearNode.addComponent(UITransform).setContentSize(1, 1)
    const particleNear = particleNearNode.addComponent(Sprite)
    particleNear.sizeMode = Sprite.SizeMode.CUSTOM
    node.addChild(particleNearNode)
    const particleFarNode = new Node('ParticleFar')
    particleFarNode.layer = UI_LAYER
    particleFarNode.addComponent(UITransform).setContentSize(1, 1)
    const particleFar = particleFarNode.addComponent(Sprite)
    particleFar.sizeMode = Sprite.SizeMode.CUSTOM
    node.addChild(particleFarNode)
    const visual = node.addComponent(BossHazardVisualController)
    visual.graphics = graphics
    visual.mainShape = mainShape
    visual.accent = accent
    visual.particleNear = particleNear
    visual.particleFar = particleFar
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

  private drawRoundedPanel(
    node: Node,
    width: number,
    height: number,
    fill: Color,
    stroke: Color,
    radius: number,
  ) {
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    graphics.clear()
    graphics.fillColor = fill
    graphics.roundRect(-width / 2, -height / 2, width, height, radius)
    graphics.fill()
    graphics.lineWidth = 2
    graphics.strokeColor = stroke
    graphics.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, Math.max(0, radius - 1))
    graphics.stroke()
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
