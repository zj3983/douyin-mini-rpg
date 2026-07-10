import { _decorator, Component } from 'cc'
import { AtlasAnimator } from './AtlasAnimator'

const { ccclass, property } = _decorator

@ccclass('EnemyVisualController')
export class EnemyVisualController extends Component {
  @property(AtlasAnimator)
  animator: AtlasAnimator | null = null

  @property
  deathDuration = 0.45
  private defeated = false

  onEnable() {
    this.node.on('enemy-hit', this.onEnemyHit, this)
    this.node.on('enemy-defeated', this.onEnemyDefeated, this)
    this.node.on('enemy-motion', this.onEnemyMotion, this)
    this.node.on('enemy-skill-cast', this.onEnemySkill, this)
    this.node.on('enemy-runtime-spawned', this.onEnemySpawned, this)
  }

  onDisable() {
    this.node.off('enemy-hit', this.onEnemyHit, this)
    this.node.off('enemy-defeated', this.onEnemyDefeated, this)
    this.node.off('enemy-motion', this.onEnemyMotion, this)
    this.node.off('enemy-skill-cast', this.onEnemySkill, this)
    this.node.off('enemy-runtime-spawned', this.onEnemySpawned, this)
  }

  private onEnemyMotion(action: string) {
    this.animator?.play(action)
  }

  private onEnemySkill() {
    this.animator?.play('attack')
    this.node.emit('enemy-attack-visual')
  }

  private onEnemyHit(event: unknown) {
    this.animator?.play('hurt')
    this.node.emit('enemy-visual-hit', event)
    this.scheduleOnce(() => {
      if (!this.defeated && this.node.active) this.animator?.play('move')
    }, 0.18)
  }

  private onEnemyDefeated(enemyId: number) {
    this.defeated = true
    this.animator?.play('death')
    this.node.emit('enemy-visual-death', enemyId)
    this.scheduleOnce(() => {
      this.node.emit('enemy-despawn-ready', enemyId)
    }, this.deathDuration)
  }

  private onEnemySpawned() {
    this.defeated = false
  }
}
