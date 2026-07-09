import { _decorator, Component } from 'cc'
import { AtlasAnimator } from './AtlasAnimator'

const { ccclass, property } = _decorator

@ccclass('EnemyVisualController')
export class EnemyVisualController extends Component {
  @property(AtlasAnimator)
  animator: AtlasAnimator | null = null

  @property
  deathDuration = 0.45

  onEnable() {
    this.node.on('enemy-hit', this.onEnemyHit, this)
    this.node.on('enemy-defeated', this.onEnemyDefeated, this)
  }

  onDisable() {
    this.node.off('enemy-hit', this.onEnemyHit, this)
    this.node.off('enemy-defeated', this.onEnemyDefeated, this)
  }

  private onEnemyHit(event: unknown) {
    this.animator?.play('hurt')
    this.node.emit('enemy-visual-hit', event)
  }

  private onEnemyDefeated(enemyId: number) {
    this.animator?.play('death')
    this.node.emit('enemy-visual-death', enemyId)
    this.scheduleOnce(() => {
      this.node.emit('enemy-despawn-ready', enemyId)
    }, this.deathDuration)
  }
}
