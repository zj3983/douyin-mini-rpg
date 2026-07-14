import { _decorator, Component, Node, Vec3 } from 'cc'
import type { BattleRect, Point2 } from '../Combat/CombatTypes'
import {
  BossBrainState,
  createBambooWardenBrain,
  defeatBambooWarden,
  hurtBambooWarden,
  interruptBambooWarden,
  setBossHealthRatio,
  stepBambooWarden,
} from '../Combat/BossBrain'
import {
  createEnemyBrain,
  defeatEnemyBrain,
  EnemyBrainState,
  hurtEnemyBrain,
  interruptEnemyBrain,
  mapEnemyAnimationAction,
  stepEnemyBrain,
} from '../Combat/EnemyBrain'
import type { EnemyCommand, OrdinaryEnemyKind } from '../Combat/EnemyBrain'
import { BattleEnemy } from '../Core/BattleRuntime'
import { EnemyFacing, updateEnemyFacing } from '../Core/EnemyFacingRuntime'

const { ccclass, property } = _decorator

export interface EnemyNeighborSnapshot {
  readonly id: number
  readonly position: Readonly<Point2>
  readonly alive: boolean
}

export interface EnemyBrainBinding {
  readonly kind: OrdinaryEnemyKind | 'bamboo-warden'
  readonly seed: number
  readonly battleBounds: () => Readonly<BattleRect>
  readonly neighbors: () => readonly EnemyNeighborSnapshot[]
}

@ccclass('EnemyController')
export class EnemyController extends Component {
  @property moveSpeed = 90
  @property attackRange = 70
  @property bossActionInterval = 1.8
  @property facingDeadZone = 4

  private target: Vec3 | null = null
  private targetNode: Node | null = null
  private lockTargetY = false
  private runtimeEnemy: BattleEnemy | null = null
  private brain: EnemyBrainState | null = null
  private bossBrain: BossBrainState | null = null
  private brainBinding: EnemyBrainBinding | null = null
  private boundMaxHealth = 1
  private moving = false
  private facing: EnemyFacing = -1
  private bossActionLeft = 0
  private eventsBound = false
  private combatPaused = false

  onEnable() {
    this.bindEvents()
  }

  onDisable() {
    this.unbindEvents()
  }

  bindRuntimeEnemy(enemy: BattleEnemy, binding?: EnemyBrainBinding) {
    this.resetRuntimeState()
    this.runtimeEnemy = enemy
    this.boundMaxHealth = Math.max(1, enemy.hp)
    this.brainBinding = binding ?? null
    if (binding) {
      const spawn = this.node.position
      if (binding.kind === 'bamboo-warden') {
        this.bossBrain = createBambooWardenBrain(enemy.id, { x: spawn.x, y: spawn.y }, binding.seed)
      } else {
        this.brain = createEnemyBrain(binding.kind, enemy.id, { x: spawn.x, y: spawn.y }, binding.seed)
      }
    }
    this.bindEvents()
    this.syncRuntimePosition()
  }

  prepareForPool() {
    this.unbindEvents()
    this.resetRuntimeState()
    this.runtimeEnemy = null
  }

  setCombatPaused(paused: boolean) {
    this.combatPaused = paused
  }

  setTarget(worldPosition: Vec3) {
    this.target = worldPosition.clone()
    this.targetNode = null
  }

  setTargetNode(targetNode: Node, lockY: boolean) {
    this.targetNode = targetNode
    this.lockTargetY = lockY
    this.target = targetNode.position.clone()
  }

  enemyNeighborSnapshot(): Readonly<EnemyNeighborSnapshot> | null {
    if (!this.runtimeEnemy || !this.brain) return null
    const position = this.node.position
    return Object.freeze({
      id: this.runtimeEnemy.id,
      position: Object.freeze({ x: position.x, y: position.y }),
      alive: this.runtimeEnemy.alive && this.node.activeInHierarchy,
    })
  }

  update(deltaTime: number) {
    if (this.combatPaused) return
    if (!this.target || !this.runtimeEnemy?.alive) return
    if ((!this.brain && !this.bossBrain) || !this.brainBinding) {
      this.updateBossPresentation(deltaTime)
      return
    }

    const liveTarget = this.targetNode?.position ?? this.target
    const context = {
      now: (this.brain?.elapsed ?? this.bossBrain?.elapsed ?? 0)
        + (Number.isFinite(deltaTime) && deltaTime > 0 ? Math.min(deltaTime, 0.25) : 0),
      player: {
        id: 'player',
        position: { x: liveTarget.x, y: liveTarget.y },
        alive: this.targetNode?.activeInHierarchy ?? true,
      },
      neighbors: this.brainBinding.neighbors(),
      battleBounds: this.brainBinding.battleBounds(),
    }
    const commands = this.brain
      ? stepEnemyBrain(this.brain, context, deltaTime)
      : stepBambooWarden(this.bossBrain as BossBrainState, context, deltaTime)
    this.consumeCommands(commands)
    this.syncRuntimePosition()
  }

  private consumeCommands(commands: readonly EnemyCommand[]) {
    for (const command of commands) {
      switch (command.type) {
        case 'move': {
          const position = this.brain?.position ?? this.bossBrain?.position
          if (!position) break
          const current = this.node.position
          this.node.setPosition(position.x, position.y, current.z)
          const moving = Math.hypot(command.velocity.x, command.velocity.y) > 0.001
          if (moving !== this.moving) this.node.emit('enemy-motion', moving ? 'move' : 'idle')
          this.moving = moving
          break
        }
        case 'face':
          if (command.direction !== this.facing) {
            this.facing = command.direction
            this.node.emit('enemy-facing', this.facing)
          }
          break
        case 'animate': {
          const presentationAction = this.brain
            ? mapEnemyAnimationAction(this.brain.kind, command.action)
            : this.bossPresentationAction(command.action)
          this.node.emit('enemy-semantic-animation', command.action, presentationAction)
          this.node.emit('enemy-motion', presentationAction)
          break
        }
        case 'show-telegraph':
          this.node.emit('enemy-telegraph', this.runtimeEnemy?.id, command)
          break
        case 'activate-hitbox':
          if (this.bossBrain) this.node.emit('enemy-boss-skill', command)
          this.node.emit('enemy-hitbox-active', this.runtimeEnemy?.id, command)
          break
        case 'spawn-projectile':
          this.node.emit('enemy-projectile-spawned', this.runtimeEnemy?.id, command)
          break
      }
    }
  }

  private updateBossPresentation(deltaTime: number) {
    if (!this.target || !this.runtimeEnemy) return
    this.bossActionLeft = Math.max(0, this.bossActionLeft - Math.max(0, deltaTime))
    const current = this.node.position
    const liveTarget = this.targetNode?.position ?? this.target
    const nextFacing = updateEnemyFacing(this.facing, current.x, liveTarget.x, this.facingDeadZone)
    if (nextFacing !== this.facing) {
      this.facing = nextFacing
      this.node.emit('enemy-facing', this.facing)
    }
    const desiredTarget = liveTarget.clone()
    if (this.lockTargetY) desiredTarget.y = current.y
    const moveDistance = Vec3.distance(current, desiredTarget)
    const attackDistance = Vec3.distance(current, liveTarget)

    if (moveDistance > this.attackRange) {
      const direction = desiredTarget.subtract(current).normalize()
      const step = Math.min(moveDistance, this.moveSpeed * Math.max(0, deltaTime))
      this.node.setPosition(current.clone().add(direction.multiplyScalar(step)))
      if (!this.moving) this.node.emit('enemy-motion', 'move')
      this.moving = true
      this.syncRuntimePosition()
      return
    }

    if (attackDistance <= this.attackRange && this.bossActionLeft <= 0) {
      this.bossActionLeft = this.bossActionInterval
      this.moving = false
      this.node.emit('enemy-motion', 'attack')
      this.node.emit('enemy-skill-cast', this.runtimeEnemy)
    }
    this.syncRuntimePosition()
  }

  private onEnemyHit() {
    if (!this.runtimeEnemy) return
    if (this.bossBrain) {
      setBossHealthRatio(this.bossBrain, this.runtimeEnemy.hp / this.boundMaxHealth)
      const commands = hurtBambooWarden(this.bossBrain, this.bossBrain.elapsed)
      if (commands.length > 0) this.node.emit('enemy-attack-cancelled', this.runtimeEnemy.id)
      this.consumeCommands(commands)
      return
    }
    if (!this.brain) return
    this.node.emit('enemy-attack-cancelled', this.runtimeEnemy.id)
    this.consumeCommands(hurtEnemyBrain(this.brain, this.brain.elapsed))
    this.syncRuntimePosition()
  }

  private onEnemyInterrupted() {
    if (!this.runtimeEnemy) return
    const commands = this.brain
      ? interruptEnemyBrain(this.brain, this.brain.elapsed)
      : this.bossBrain
        ? interruptBambooWarden(this.bossBrain, this.bossBrain.elapsed)
        : Object.freeze([])
    if (commands.length > 0) this.node.emit('enemy-attack-cancelled', this.runtimeEnemy.id)
    this.consumeCommands(commands)
    this.syncRuntimePosition()
  }

  private onEnemyDefeated() {
    if (this.brain) this.consumeCommands(defeatEnemyBrain(this.brain, this.brain.elapsed))
    else if (this.bossBrain) this.consumeCommands(defeatBambooWarden(this.bossBrain, this.bossBrain.elapsed))
    this.syncRuntimePosition()
  }

  private bindEvents() {
    if (this.eventsBound) return
    this.node.on('enemy-hit', this.onEnemyHit, this)
    this.node.on('enemy-interrupted', this.onEnemyInterrupted, this)
    this.node.on('enemy-defeated', this.onEnemyDefeated, this)
    this.eventsBound = true
  }

  private unbindEvents() {
    if (!this.eventsBound) return
    this.node.off('enemy-hit', this.onEnemyHit, this)
    this.node.off('enemy-interrupted', this.onEnemyInterrupted, this)
    this.node.off('enemy-defeated', this.onEnemyDefeated, this)
    this.eventsBound = false
  }

  private syncRuntimePosition() {
    if (!this.runtimeEnemy) return
    const local = this.node.position
    this.runtimeEnemy.position = { x: local.x, y: local.y }
  }

  private resetRuntimeState() {
    this.target = null
    this.targetNode = null
    this.lockTargetY = false
    this.brain = null
    this.bossBrain = null
    this.brainBinding = null
    this.boundMaxHealth = 1
    this.bossActionLeft = 0
    this.moving = false
    this.facing = -1
    this.combatPaused = false
  }

  private bossPresentationAction(action: string): 'idle' | 'move' | 'attack' | 'hurt' | 'death' {
    if (action === 'boss-death') return 'death'
    if (action === 'boss-hurt' || action === 'boss-interrupted') return 'hurt'
    if (action === 'boss-recovery') return 'idle'
    return 'attack'
  }
}
