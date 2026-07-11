import { _decorator, Component, instantiate, Node, Prefab } from 'cc'
import {
  createPoolState,
  despawnAllFromPool,
  despawnFromPool,
  poolStats,
  PoolState,
  spawnFromPool,
} from '../Core/PoolingRuntime'
import { PoolableActor } from './PoolableActor'

const { ccclass, property } = _decorator

@ccclass('NodePoolController')
export class NodePoolController extends Component {
  @property
  poolKey = 'default'

  @property
  capacity = 18

  @property(Prefab)
  prefab: Prefab | null = null

  private state: PoolState = createPoolState('default', 0)
  private nodes = new Map<number, Node>()
  private factory: ((poolId: number) => Node) | null = null

  onLoad() {
    this.state = createPoolState(this.poolKey, this.capacity)
  }

  configure(poolKey: string, capacity: number) {
    this.poolKey = poolKey
    this.capacity = Math.max(1, Math.floor(capacity))
    this.state = createPoolState(this.poolKey, this.capacity)
  }

  setFactory(factory: (poolId: number) => Node) {
    this.factory = factory
  }

  hasAvailableSlot() {
    return poolStats(this.state).active < this.capacity
  }

  spawn(activate = true) {
    if (!this.prefab && !this.factory) return null

    const result = spawnFromPool(this.state)
    if (!result.ok || result.id === null) return null

    let node = this.nodes.get(result.id)
    if (!node) {
      node = this.factory?.(result.id) ?? (this.prefab ? instantiate(this.prefab) : null)
      if (!node) {
        despawnFromPool(this.state, result.id)
        return null
      }
      if (!activate) node.active = false
      if (!node.parent) this.node.addChild(node)
      this.nodes.set(result.id, node)
      node.on('pool-despawn-requested', this.despawnByEvent, this)
    }

    const poolable = node.getComponent(PoolableActor)
    if (poolable) {
      poolable.poolKey = this.poolKey
      poolable.poolId = result.id
    }
    if (activate) this.activateNode(node)

    return node
  }

  activateNode(node: Node) {
    const poolable = node.getComponent(PoolableActor)
    if (poolable) poolable.onSpawn(poolable.poolId)
    else node.active = true
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

  despawnAll() {
    const activeIds = new Set(despawnAllFromPool(this.state))
    for (const [poolId, node] of this.nodes) {
      if (!activeIds.has(poolId)) continue
      const poolable = node.getComponent(PoolableActor)
      if (poolable) poolable.onDespawn()
      else node.active = false
    }
    return activeIds.size
  }

  private despawnByEvent(poolKey: string, poolId: number, node: Node) {
    if (poolKey !== this.poolKey) return
    despawnFromPool(this.state, poolId)
    const poolable = node.getComponent(PoolableActor)
    if (poolable) poolable.onDespawn()
    else node.active = false
  }
}
