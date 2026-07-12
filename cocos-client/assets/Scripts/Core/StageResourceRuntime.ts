export interface StageResourceDescriptor {
  readonly path: string
  readonly kind: 'spriteFrame' | 'texture'
}

export interface StageResourcePlan {
  readonly stageId: number
  readonly assets: readonly StageResourceDescriptor[]
}

export interface StageResourceAdapter<T> {
  load(asset: StageResourceDescriptor, resolve: (resource: T) => void, reject: (error: unknown) => void): void
  release(asset: StageResourceDescriptor, resource: T): void
  ready(stageId: number): void
  warn?(asset: StageResourceDescriptor, error: unknown): void
}

interface LoadedResource<T> {
  readonly asset: StageResourceDescriptor
  readonly resource: T
  released: boolean
}

interface ResourceBatch<T> {
  readonly id: number
  readonly plan: StageResourcePlan
  readonly required: boolean
  readonly loaded: LoadedResource<T>[]
  remaining: number
  valid: boolean
}

interface RetainedStage<T> {
  readonly plan: StageResourcePlan
  readonly loaded: LoadedResource<T>[]
}

function samePlan(left: StageResourcePlan, right: StageResourcePlan) {
  return left.stageId === right.stageId
    && left.assets.length === right.assets.length
    && left.assets.every((asset, index) => {
      const other = right.assets[index]
      return asset.path === other.path && asset.kind === other.kind
    })
}

export class StageResourceRuntime<T> {
  private nextBatchId = 0
  private activeStageId: number | null = null
  private prefetchedStageId: number | null = null
  private destroyed = false
  private readonly pending = new Map<number, ResourceBatch<T>>()
  private readonly retained = new Map<number, RetainedStage<T>>()
  private readonly warnedPaths = new Set<string>()

  constructor(private readonly adapter: StageResourceAdapter<T>) {}

  activate(plan: StageResourcePlan) {
    if (this.destroyed) return false
    const retained = this.retained.get(plan.stageId)
    if (this.activeStageId === plan.stageId && retained && samePlan(retained.plan, plan)) return false

    this.cancelPending()
    if (retained && samePlan(retained.plan, plan)) {
      const previousStageId = this.activeStageId
      this.activeStageId = plan.stageId
      if (this.prefetchedStageId === plan.stageId) this.prefetchedStageId = null
      this.adapter.ready(plan.stageId)
      this.pruneRetained(new Set([previousStageId, plan.stageId].filter((value): value is number => value !== null)))
      return true
    }

    if (retained) this.releaseStage(plan.stageId)
    this.startBatch(plan, true)
    return true
  }

  prefetch(plan: StageResourcePlan) {
    if (this.destroyed || this.activeStageId === plan.stageId) return false
    const retained = this.retained.get(plan.stageId)
    if (retained && samePlan(retained.plan, plan)) return false
    if ([...this.pending.values()].some((batch) => samePlan(batch.plan, plan))) return false

    this.cancelPending()
    if (retained) this.releaseStage(plan.stageId)
    this.startBatch(plan, false)
    return true
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.cancelPending()
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

  private startBatch(plan: StageResourcePlan, required: boolean) {
    const batch: ResourceBatch<T> = {
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

  private resolve(batch: ResourceBatch<T>, asset: StageResourceDescriptor, resource: T) {
    const loaded: LoadedResource<T> = { asset, resource, released: false }
    if (this.destroyed || !batch.valid || this.pending.get(batch.id) !== batch) {
      this.releaseLoaded(loaded)
      return
    }

    batch.loaded.push(loaded)
    batch.remaining -= 1
    if (batch.remaining === 0) this.completeBatch(batch)
  }

  private reject(batch: ResourceBatch<T>, asset: StageResourceDescriptor, error: unknown) {
    if (this.destroyed || !batch.valid || this.pending.get(batch.id) !== batch) return
    this.warnOnce(asset, error)
    this.invalidateBatch(batch)
  }

  private completeBatch(batch: ResourceBatch<T>) {
    if (this.destroyed || !batch.valid || this.pending.get(batch.id) !== batch) return
    batch.valid = false
    this.pending.delete(batch.id)
    this.retained.set(batch.plan.stageId, { plan: batch.plan, loaded: batch.loaded })

    if (batch.required) {
      const previousStageId = this.activeStageId
      this.activeStageId = batch.plan.stageId
      if (this.prefetchedStageId === batch.plan.stageId) this.prefetchedStageId = null
      this.adapter.ready(batch.plan.stageId)
      this.pruneRetained(new Set([previousStageId, batch.plan.stageId].filter((value): value is number => value !== null)))
      return
    }

    this.prefetchedStageId = batch.plan.stageId
    this.pruneRetained(new Set([this.activeStageId, this.prefetchedStageId].filter((value): value is number => value !== null)))
  }

  private cancelPending() {
    for (const batch of [...this.pending.values()]) this.invalidateBatch(batch)
  }

  private invalidateBatch(batch: ResourceBatch<T>) {
    if (!batch.valid) return
    batch.valid = false
    this.pending.delete(batch.id)
    for (const loaded of batch.loaded) this.releaseLoaded(loaded)
  }

  private pruneRetained(keep: ReadonlySet<number>) {
    for (const stageId of [...this.retained.keys()]) {
      if (!keep.has(stageId)) this.releaseStage(stageId)
    }
  }

  private releaseStage(stageId: number) {
    const stage = this.retained.get(stageId)
    if (!stage) return
    this.retained.delete(stageId)
    for (const loaded of stage.loaded) this.releaseLoaded(loaded)
    if (this.prefetchedStageId === stageId) this.prefetchedStageId = null
  }

  private releaseLoaded(loaded: LoadedResource<T>) {
    if (loaded.released) return
    loaded.released = true
    this.adapter.release(loaded.asset, loaded.resource)
  }

  private warnOnce(asset: StageResourceDescriptor, error: unknown) {
    if (this.warnedPaths.has(asset.path)) return
    this.warnedPaths.add(asset.path)
    this.adapter.warn?.(asset, error)
  }
}
