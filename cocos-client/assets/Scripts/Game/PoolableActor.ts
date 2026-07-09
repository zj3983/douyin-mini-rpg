import { _decorator, Component } from 'cc'

const { ccclass, property } = _decorator

@ccclass('PoolableActor')
export class PoolableActor extends Component {
  @property
  poolKey = 'default'

  poolId = 0

  onSpawn(poolId: number) {
    this.poolId = poolId
    this.node.active = true
    this.node.emit('pool-spawned', poolId)
  }

  despawn() {
    this.node.emit('pool-despawn-requested', this.poolKey, this.poolId, this.node)
  }

  onDespawn() {
    this.node.active = false
    this.node.emit('pool-despawned', this.poolId)
  }
}
