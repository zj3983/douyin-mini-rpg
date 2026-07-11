import { _decorator, Color, Component, Sprite } from 'cc'
import { EnemyProfile } from '../Core/CultivationTypes'
import {
  acceptManifestLoad,
  beginManifestLoad,
  bindVisualListeners,
  createVisualResetState,
  ManifestLoadToken,
  prepareVisualForPool,
  resetVisualForSpawn,
  setVisualActionState,
  visualResetCommands,
  VisualResetState,
} from '../Core/VisualResetRuntime'
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
  private visualState: VisualResetState = createVisualResetState()

  onEnable() {
    this.bindEvents()
  }

  onDisable() {
    this.unbindEvents()
  }

  resetForSpawn(profile: EnemyProfile) {
    this.unscheduleAllCallbacks()
    this.visualState = resetVisualForSpawn(this.visualState, { actorId: profile.id, facing: -1 })
    this.applyVisualState()
    this.bindEvents()
  }

  prepareForPool() {
    this.unscheduleAllCallbacks()
    this.visualState = prepareVisualForPool(this.visualState)
    this.applyVisualState(false)
    this.animator?.stop()
    this.unbindEvents()
  }

  beginManifestLoad() {
    return beginManifestLoad(this.visualState)
  }

  acceptManifestLoad(token: ManifestLoadToken) {
    return acceptManifestLoad(this.visualState, token)
  }

  private bindEvents() {
    if (this.eventsBound) return
    const binding = bindVisualListeners(this.visualState)
    this.visualState = binding.state
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
    this.visualState = setVisualActionState(this.visualState, action)
    this.animator?.play(action)
  }

  private onEnemySkill() {
    this.visualState = setVisualActionState(this.visualState, 'attack')
    this.animator?.play('attack')
    this.node.emit('enemy-attack-visual')
  }

  private onEnemyHit(event: unknown) {
    this.visualState = setVisualActionState(this.visualState, 'hurt')
    this.animator?.play('hurt')
    this.node.emit('enemy-visual-hit', event)
    this.scheduleOnce(() => {
      if (!this.defeated && this.node.active) {
        this.visualState = setVisualActionState(this.visualState, 'move')
        this.animator?.play('move')
      }
    }, 0.18)
  }

  private onEnemyDefeated(enemyId: number) {
    this.visualState = setVisualActionState(this.visualState, 'death')
    this.defeated = this.visualState.defeated
    this.animator?.play('death')
    this.node.emit('enemy-visual-death', enemyId)
    this.scheduleOnce(() => {
      this.node.emit('enemy-despawn-ready', enemyId)
    }, this.deathDuration)
  }

  private applyVisualState(playAction = true) {
    const commands = visualResetCommands(this.visualState)
    this.defeated = commands.defeated
    const visualNode = this.animator?.targetSprite?.node ?? this.node
    visualNode.setPosition(commands.position.x, commands.position.y, commands.position.z)
    visualNode.setScale(commands.scale.x, commands.scale.y, commands.scale.z)
    visualNode.setRotationFromEuler(commands.rotation.x, commands.rotation.y, commands.rotation.z)
    const sprite = visualNode.getComponent(Sprite) ?? this.animator?.targetSprite
    if (sprite) sprite.color = new Color(commands.color.r, commands.color.g, commands.color.b, commands.color.a)
    if (!commands.actorId) return
    this.animator?.setActor(commands.actorId)
    if (playAction && commands.frameIndex === 0) this.animator?.reset(commands.action)
  }
}
