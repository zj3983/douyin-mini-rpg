function sameVisual(left, right) {
  return Boolean(left && right && left.farPath === right.farPath && left.midPath === right.midPath)
}

export class StageBackgroundRuntime {
  constructor(adapter) {
    this.adapter = adapter
    this.generation = 0
    this.destroyed = false
    this.pending = null
    this.active = null
    this.warnedPaths = new Set()
  }

  request(visual) {
    if (this.destroyed || sameVisual(this.pending?.visual, visual)) return false
    if (sameVisual(this.active?.visual, visual)) {
      this.generation += 1
      this.cancelPending()
      return false
    }

    this.generation += 1
    this.cancelPending()
    const generation = this.generation
    this.pending = {
      generation,
      visual,
      far: null,
      mid: null,
      midFailed: false,
    }
    this.startLoad(generation, 'far', visual.farPath)
    if (visual.midPath) this.startLoad(generation, 'mid', visual.midPath)
    return true
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.generation += 1
    this.cancelPending()
    const active = this.active
    this.active = null
    this.adapter.clear?.()
    this.releaseLoaded(active?.far)
    this.releaseLoaded(active?.mid)
  }

  snapshot() {
    return {
      destroyed: this.destroyed,
      generation: this.generation,
      activeStageId: this.active?.visual.stageId ?? null,
      requestedStageId: this.pending?.visual.stageId ?? null,
    }
  }

  startLoad(generation, slot, path) {
    try {
      this.adapter.load(
        path,
        (resource) => this.resolve(generation, slot, path, resource),
        (error) => this.reject(generation, slot, path, error),
      )
    } catch (error) {
      this.reject(generation, slot, path, error)
    }
  }

  resolve(generation, slot, path, resource) {
    const loaded = { path, resource, released: false }
    const pending = this.pending
    if (this.destroyed || !pending || pending.generation !== generation) {
      this.releaseLoaded(loaded)
      return
    }

    pending[slot] = loaded
    if (slot === 'far') {
      if (!pending.visual.midPath || pending.mid || pending.midFailed) this.applyPending(pending)
      return
    }
    if (pending.far) this.applyPending(pending)
  }

  reject(generation, slot, path, error) {
    const pending = this.pending
    if (this.destroyed || !pending || pending.generation !== generation) return
    this.warnOnce(path, error)
    if (slot === 'mid') {
      pending.midFailed = true
      if (pending.far) this.applyPending(pending)
      return
    }

    this.pending = null
    this.releaseLoaded(pending.mid)
  }

  applyPending(pending) {
    if (this.destroyed || this.pending !== pending || !pending.far) return
    const previous = this.active
    this.adapter.apply(pending.visual, pending.far.resource, pending.mid?.resource ?? null)
    this.active = {
      visual: pending.visual,
      far: pending.far,
      mid: pending.mid,
    }
    this.pending = null
    this.releaseLoaded(previous?.far)
    this.releaseLoaded(previous?.mid)
  }

  cancelPending() {
    const pending = this.pending
    this.pending = null
    this.releaseLoaded(pending?.far)
    this.releaseLoaded(pending?.mid)
  }

  releaseLoaded(loaded) {
    if (!loaded || loaded.released) return
    loaded.released = true
    this.adapter.release(loaded.path, loaded.resource)
  }

  warnOnce(path, error) {
    if (this.warnedPaths.has(path)) return
    this.warnedPaths.add(path)
    this.adapter.warn?.(path, error)
  }
}
