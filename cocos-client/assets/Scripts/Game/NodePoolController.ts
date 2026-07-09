import { _decorator, Component, instantiate, Node, Prefab } from 'cc'
import { createPoolState, despawnFromPool, PoolState, spawnFromPool } from '../Core/PoolingRuntime'
import { PoolableActor } from './PoolableActor'

const { ccclass, property } = _decorator

@ccclass('NodePoolController')
export class NodePoolController extends Component {
  @property
  poolKey = 'default'

  @property
  capacity = 80

  @property(Prefab)
  prefab: Prefab | null = null

  private state: PoolState = createPoolState('default', 0)
  private nodes = new Map<number, Node>()

  onLoad() {
    this.state = createPoolState(this.poolKey, this.capacity)
  }

  spawn() {
    if (!this.prefab) return null

    const result = spawnFromPool(this.state)
    if (!result.ok || result.id === null) return null

    let node = this.nodes.get(result.id)
    if (!node) {
      node = instantiate(this.prefab)
      this.node.addChild(node)
      this.nodes.set(result.id, node)
      node.on('pool-despawn-requested', this.despawnByEvent, this)
    }

    const poolable = node.getComponent(PoolableActor)
    if (poolable) {
      poolable.poolKey = this.poolKey
      poolable.onSpawn(result.id)
    } else {
      node.active = true
    }

    return node
  }

  despawn(node: Node) {
    const poolable = node.getComponent(PoolableActor)
    if (!poolable) {
      node.active = false
      return
    }

    despawnFromPool(this.state, poolable.poolId)
    poolable.onDespawn()
  }

  private despawnByEvent(poolKey: string, poolId: number, node: Node) {
    if (poolKey !== this.poolKey) return
    despawnFromPool(this.state, poolId)
    const poolable = node.getComponent(PoolableActor)
    if (poolable) poolable.onDespawn()
    else node.active = false
  }
}
