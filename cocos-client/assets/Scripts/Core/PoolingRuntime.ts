export interface PoolState {
  kind: string
  capacity: number
  nextId: number
  created: number
  overflow: number
  items: Array<{
    id: number
    active: boolean
  }>
}

export function createPoolState(kind: string, capacity: number): PoolState {
  return {
    kind,
    capacity: Math.max(0, Math.floor(capacity)),
    nextId: 1,
    created: 0,
    overflow: 0,
    items: [],
  }
}

export function spawnFromPool(pool: PoolState) {
  const inactive = pool.items.find((item) => !item.active)
  if (inactive) {
    inactive.active = true
    return { ok: true, id: inactive.id, reused: true }
  }

  if (pool.created >= pool.capacity) {
    pool.overflow += 1
    return { ok: false, id: null, reused: false }
  }

  const item = { id: pool.nextId, active: true }
  pool.nextId += 1
  pool.created += 1
  pool.items.push(item)
  return { ok: true, id: item.id, reused: false }
}

export function despawnFromPool(pool: PoolState, id: number) {
  const item = pool.items.find((entry) => entry.id === id)
  if (!item) return false
  item.active = false
  return true
}

export function despawnAllFromPool(pool: PoolState) {
  const activeIds = pool.items.filter((item) => item.active).map((item) => item.id)
  for (const item of pool.items) item.active = false
  return activeIds
}

export function poolStats(pool: PoolState) {
  return {
    kind: pool.kind,
    capacity: pool.capacity,
    created: pool.created,
    active: pool.items.filter((item) => item.active).length,
    inactive: pool.items.filter((item) => !item.active).length,
    overflow: pool.overflow,
  }
}
