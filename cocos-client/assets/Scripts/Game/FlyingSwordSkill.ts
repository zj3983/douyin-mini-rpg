import { _decorator, Component, Node } from 'cc'
import {
  ArtifactCommand,
  ArtifactRuntime,
  createArtifactRuntime,
  resetArtifact,
  setArtifactLevel,
  stepArtifact,
} from '../Combat/ArtifactRuntime.ts'
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

  onLoad() {
    this.artifact = createArtifactRuntime({
      artifactId: 'flying-sword',
      level: this.artifactLevel,
      ownerId: 'player',
    })
    this.hideSword()
  }

  onDisable() {
    this.cancelCast(true)
  }

  update(deltaTime: number) {
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

  public resetForStage(generation: number) {
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
        if (!this.visiblePathId) {
          this.visiblePathId = command.pathId
          if (this.sword) {
            this.sword.setPosition(command.origin.x, command.origin.y, 0)
            this.sword.active = true
          }
        }
        return
      case 'move-sword':
        if (command.pathId === this.visiblePathId) this.applySwordPose(command)
        return
      case 'resolve-sword-hit':
        this.node.emit('sword-pass-resolved', {
          phase: command.phase,
          result: this.battleRuntime?.resolveArtifactSwordHit(command.targetId),
        })
        return
      case 'despawn-sword':
        if (command.pathId !== this.visiblePathId) return
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
