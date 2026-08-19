import { _decorator, Component, Node } from 'cc'
import {
  ArtifactCommand,
  ArtifactRuntime,
  createArtifactRuntime,
  resetArtifact,
  setArtifactLevel,
  stepArtifact,
} from '../Combat/ArtifactRuntime.ts'
import { feedbackFor } from '../Combat/FeedbackTimeline.ts'
import { BattleRuntimeController } from './BattleRuntimeController'

const { ccclass, property } = _decorator

@ccclass('FlyingSwordSkill')
export class FlyingSwordSkill extends Component {
  @property(BattleRuntimeController)
  public battleRuntime: BattleRuntimeController | null = null

  @property(Node)
  public sword: Node | null = null

  @property
  public artifactLevel = 1

  private artifact: ArtifactRuntime | null = null
  private visiblePathId: string | null = null
  private casting = false
  private boundBattleRuntimeNode: Node | null = null

  onLoad() {
    this.artifact = createArtifactRuntime({
      artifactId: 'flying-sword',
      level: this.artifactLevel,
      ownerId: 'player',
    })
    this.hideSword()
  }

  onEnable() {
    this.bindBattleRuntimeEvents()
  }

  start() {
    this.bindBattleRuntimeEvents()
  }

  onDisable() {
    this.unbindBattleRuntimeEvents()
    this.cancelCast(true)
  }

  onDestroy() {
    this.unbindBattleRuntimeEvents()
  }

  update(deltaTime: number) {
    this.bindBattleRuntimeEvents()
    if (!this.battleRuntime || !this.artifact) return
    if (this.battleRuntime.isBattleFrozen()) {
      this.cancelCast(false)
      return
    }

    setArtifactLevel(this.artifact, this.artifactLevel)
    const commands = stepArtifact(this.artifact, {
      now: performance.now() / 1000,
      ownerPosition: this.battleRuntime.getCurrentPlayerPosition(),
      targets: this.battleRuntime.getLivingSwordTargets(),
      battleBounds: this.battleRuntime.getBattleBounds(),
    }, deltaTime)
    for (const command of commands) this.applyArtifactCommand(command)
  }

  resetForStage(generation: number) {
    if (!this.artifact) return
    resetArtifact(this.artifact, generation)
    this.cancelCast(true)
  }

  private applyArtifactCommand(command: ArtifactCommand) {
    switch (command.type) {
      case 'animate-owner':
        if (command.action === 'hand_seal' && !this.casting) {
          this.casting = true
          this.node.emit('sword-cast-started', { phase: 'handSeal' })
        }
        this.node.emit('player-action-requested', command.action)
        return
      case 'spawn-sword':
        if (!this.isCurrentArtifactPath(command.pathId)) return
        if (!this.visiblePathId) {
          this.visiblePathId = command.pathId
          if (this.sword) {
            this.sword.setPosition(command.origin.x, command.origin.y, 0)
            this.sword.active = true
          }
          const target = this.battleRuntime?.getLivingSwordTargets().find((entry) => entry.id === command.targetId)?.position
          this.node.emit('combat-feedback-requested', {
            quality: this.battleRuntime?.getCurrentVfxQuality() ?? 'full',
            requests: feedbackFor({
              type: 'artifact-cast',
              artifactId: 'qing-shuang-yujian',
              actorId: 'player',
              at: performance.now(),
              target,
            }, this.battleRuntime?.getCurrentVfxQuality() ?? 'full'),
          })
        }
        return
      case 'move-sword':
        if (this.isCurrentArtifactPath(command.pathId) && command.pathId === this.visiblePathId) {
          this.applySwordPose(command)
        }
        return
      case 'resolve-sword-hit':
        if (!this.isCurrentArtifactPath(command.pathId)) return
        this.node.emit('sword-pass-resolved', {
          phase: command.phase,
          result: this.battleRuntime?.resolveArtifactSwordHit(command.targetId),
        })
        return
      case 'despawn-sword':
        if (!this.isCurrentArtifactPath(command.pathId) || command.pathId !== this.visiblePathId) return
        this.visiblePathId = null
        this.finishCast()
        return
    }
  }

  private applySwordPose(command: Extract<ArtifactCommand, { type: 'move-sword' }>) {
    if (!this.sword) return
    const { from, to } = command
    const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI
    this.sword.setPosition(to.x, to.y, 0)
    this.sword.setRotationFromEuler(0, 0, angle)
  }

  private bindBattleRuntimeEvents() {
    const runtimeNode = this.battleRuntime?.node ?? null
    if (runtimeNode === this.boundBattleRuntimeNode) return
    this.unbindBattleRuntimeEvents()
    if (!runtimeNode) return
    runtimeNode.on('battle-generation-reset', this.onBattleGenerationReset, this)
    this.boundBattleRuntimeNode = runtimeNode
  }

  private unbindBattleRuntimeEvents() {
    this.boundBattleRuntimeNode?.off('battle-generation-reset', this.onBattleGenerationReset, this)
    this.boundBattleRuntimeNode = null
  }

  private onBattleGenerationReset(payload: { generation: number }) {
    if (!Number.isSafeInteger(payload?.generation) || payload.generation <= 0) return
    this.resetForStage(payload.generation)
  }

  private isCurrentArtifactPath(pathId: string) {
    if (!this.artifact) return false
    return pathId.startsWith(`${this.artifact.ownerId}-sword-${this.artifact.generation}-`)
  }

  private finishCast() {
    if (!this.casting) return
    this.casting = false
    this.node.emit('player-action-completed')
    this.hideSword()
  }

  private cancelCast(forceComplete: boolean) {
    this.visiblePathId = null
    if (this.casting || forceComplete) {
      this.casting = false
      this.node.emit('player-action-completed')
    }
    this.hideSword()
  }

  private hideSword() {
    if (!this.sword) return
    this.sword.setRotationFromEuler(0, 0, 0)
    this.sword.active = false
  }
}
