function samePlan(left, right) {
  return left.stageId === right.stageId
    && left.assets.length === right.assets.length
    && left.assets.every((asset, index) => {
      const other = right.assets[index]
      return asset.path === other.path && asset.kind === other.kind
    })
}

export class StageResourceRuntime {
  constructor(adapter) {
    this.adapter = adapter
    this.nextBatchId = 0
    this.activeStageId = null
    this.prefetchedStageId = null
    this.destroyed = false
    this.pending = new Map()
    this.retained = new Map()
    this.warnedPaths = new Set()
  }

  activate(plan) {
    if (this.destroyed) return false
    const retained = this.retained.get(plan.stageId)
    if (this.activeStageId === plan.stageId && retained && samePlan(retained.plan, plan)) return false

    const reusable = [...this.pending.values()].find((batch) => samePlan(batch.plan, plan))
    const nextStageId = plan.stageId + 1
    this.cancelPending((batch) => batch !== reusable && (batch.required || batch.plan.stageId !== nextStageId))
    if (
      this.prefetchedStageId !== null
      && this.prefetchedStageId !== plan.stageId
      && this.prefetchedStageId !== nextStageId
    ) {
      this.releaseStage(this.prefetchedStageId)
    }

    if (reusable) {
      reusable.required = true
      return true
    }

    if (retained && samePlan(retained.plan, plan)) {
      this.activeStageId = plan.stageId
      if (this.prefetchedStageId === plan.stageId) this.prefetchedStageId = null
      this.adapter.ready(plan.stageId)
      this.pruneRetained(new Set([plan.stageId, this.prefetchedStageId].filter((value) => value !== null)))
      return true
    }

    if (retained) this.releaseStage(plan.stageId)
    this.startBatch(plan, true)
    return true
  }

  prefetch(plan) {
    if (this.destroyed || this.activeStageId === plan.stageId) return false
    const retained = this.retained.get(plan.stageId)
    if (retained && samePlan(retained.plan, plan)) return false
    if ([...this.pending.values()].some((batch) => samePlan(batch.plan, plan))) return false
    if ([...this.pending.values()].some((batch) => batch.required && batch.plan.stageId === plan.stageId)) return false

    this.cancelPending((batch) => !batch.required)
    if (retained) this.releaseStage(plan.stageId)
    this.startBatch(plan, false)
    return true
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.cancelPending(() => true)
    for (const stageId of [...this.retained.keys()]) this.releaseStage(stageId)
    this.activeStageId = null
    this.prefetchedStageId = null
  }

  snapshot() {
    return {
      activeStageId: this.activeStageId,
      prefetchedStageId: this.prefetchedStageId,
      pendingStageIds: [...new Set([...this.pending.values()].map(({ plan }) => plan.stageId))].sort((a, b) => a - b),
      retainedStageIds: [...this.retained.keys()].sort((a, b) => a - b),
      destroyed: this.destroyed,
    }
  }

  startBatch(plan, required) {
    const batch = {
      id: ++this.nextBatchId,
      plan,
      required,
      loaded: [],
      remaining: plan.assets.length,
      valid: true,
    }
    this.pending.set(batch.id, batch)
    if (plan.assets.length === 0) {
      this.completeBatch(batch)
      return
    }

    for (const asset of plan.assets) {
      try {
        this.adapter.load(
          asset,
          (resource) => this.resolve(batch, asset, resource),
          (error) => this.reject(batch, asset, error),
        )
      } catch (error) {
        this.reject(batch, asset, error)
      }
    }
  }

  resolve(batch, asset, resource) {
    const loaded = { asset, resource, released: false }
    if (this.destroyed || !batch.valid || this.pending.get(batch.id) !== batch) {
      this.releaseLoaded(loaded)
      return
    }

    batch.loaded.push(loaded)
    batch.remaining -= 1
    if (batch.remaining === 0) this.completeBatch(batch)
  }

  reject(batch, asset, error) {
    if (this.destroyed || !batch.valid || this.pending.get(batch.id) !== batch) return
    this.warnOnce(asset, error)
    this.invalidateBatch(batch)
  }

  completeBatch(batch) {
    if (this.destroyed || !batch.valid || this.pending.get(batch.id) !== batch) return
    batch.valid = false
    this.pending.delete(batch.id)
    this.retained.set(batch.plan.stageId, { plan: batch.plan, loaded: batch.loaded })

    if (batch.required) {
      this.activeStageId = batch.plan.stageId
      if (this.prefetchedStageId === batch.plan.stageId) this.prefetchedStageId = null
      this.adapter.ready(batch.plan.stageId)
      this.pruneRetained(new Set(
        [
          batch.plan.stageId,
          this.prefetchedStageId === batch.plan.stageId + 1 ? this.prefetchedStageId : null,
        ]
          .filter((value) => value !== null),
      ))
      return
    }

    this.prefetchedStageId = batch.plan.stageId
    this.pruneRetained(new Set([this.activeStageId, this.prefetchedStageId].filter((value) => value !== null)))
  }

  cancelPending(shouldCancel) {
    for (const batch of [...this.pending.values()]) {
      if (shouldCancel(batch)) this.invalidateBatch(batch)
    }
  }

  invalidateBatch(batch) {
    if (!batch.valid) return
    batch.valid = false
    this.pending.delete(batch.id)
    for (const loaded of batch.loaded) this.releaseLoaded(loaded)
  }

  pruneRetained(keep) {
    for (const stageId of [...this.retained.keys()]) {
      if (!keep.has(stageId)) this.releaseStage(stageId)
    }
  }

  releaseStage(stageId) {
    const stage = this.retained.get(stageId)
    if (!stage) return
    this.retained.delete(stageId)
    for (const loaded of stage.loaded) this.releaseLoaded(loaded)
    if (this.prefetchedStageId === stageId) this.prefetchedStageId = null
  }

  releaseLoaded(loaded) {
    if (loaded.released) return
    loaded.released = true
    this.adapter.release(loaded.asset, loaded.resource)
  }

  warnOnce(asset, error) {
    if (this.warnedPaths.has(asset.path)) return
    this.warnedPaths.add(asset.path)
    this.adapter.warn?.(asset, error)
  }
}
