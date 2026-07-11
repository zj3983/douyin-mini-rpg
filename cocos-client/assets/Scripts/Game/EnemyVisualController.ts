import { _decorator, Color, Component, Sprite, Vec3 } from 'cc'
import { EnemyProfile } from '../Core/CultivationTypes'
import { AtlasAnimator } from './AtlasAnimator'

const { ccclass, property } = _decorator

@ccclass('EnemyVisualController')
export class EnemyVisualController extends Component {
  @property(AtlasAnimator)
  animator: AtlasAnimator | null = null

  @property
  deathDuration = 0.45
  private defeated = false
  private eventsBound = false

  onEnable() {
    this.bindEvents()
  }

  onDisable() {
    this.unbindEvents()
  }

  resetForSpawn(profile: EnemyProfile) {
    this.unscheduleAllCallbacks()
    this.defeated = false
    this.cleanVisualNode()
    this.bindEvents()
    this.animator?.setActor(profile.id)
    this.animator?.reset('move')
  }

  prepareForPool() {
    this.unscheduleAllCallbacks()
    this.defeated = false
    this.animator?.stop()
    this.unbindEvents()
    this.cleanVisualNode()
  }

  private bindEvents() {
    if (this.eventsBound) return
    this.node.on('enemy-hit', this.onEnemyHit, this)
    this.node.on('enemy-defeated', this.onEnemyDefeated, this)
    this.node.on('enemy-motion', this.onEnemyMotion, this)
    this.node.on('enemy-skill-cast', this.onEnemySkill, this)
    this.eventsBound = true
  }

  private unbindEvents() {
    if (!this.eventsBound) return
    this.node.off('enemy-hit', this.onEnemyHit, this)
    this.node.off('enemy-defeated', this.onEnemyDefeated, this)
    this.node.off('enemy-motion', this.onEnemyMotion, this)
    this.node.off('enemy-skill-cast', this.onEnemySkill, this)
    this.eventsBound = false
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

  private cleanVisualNode() {
    const visualNode = this.animator?.targetSprite?.node ?? this.node
    visualNode.setPosition(Vec3.ZERO)
    visualNode.setScale(Vec3.ONE)
    visualNode.setRotationFromEuler(Vec3.ZERO)
    const sprite = visualNode.getComponent(Sprite) ?? this.animator?.targetSprite
    if (sprite) sprite.color = Color.WHITE
  }
}
