export function createPoolState(kind, capacity) {
  return {
    kind,
    capacity: Math.max(0, Math.floor(capacity)),
    nextId: 1,
    created: 0,
    overflow: 0,
    items: [],
  }
}

export function spawnFromPool(pool) {
  const inactive = pool.items.find((item) => !item.active)
  if (inactive) {
    inactive.active = true
    return { ok: true, id: inactive.id, reused: true }
  }

  if (pool.created >= pool.capacity) {
    pool.overflow += 1
    return { ok: false, id: null, reused: false }
  }

  const item = { id: pool.nextId++, active: true }
  pool.items.push(item)
  pool.created += 1
  return { ok: true, id: item.id, reused: false }
}

export function despawnFromPool(pool, id) {
  const item = pool.items.find((entry) => entry.id === id)
  if (!item) return false
  item.active = false
  return true
}

export function poolStats(pool) {
  return {
    kind: pool.kind,
    capacity: pool.capacity,
    created: pool.created,
    active: pool.items.filter((item) => item.active).length,
    inactive: pool.items.filter((item) => !item.active).length,
    overflow: pool.overflow,
  }
}
