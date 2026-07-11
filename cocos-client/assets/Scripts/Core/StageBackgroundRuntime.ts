import { StageVisual } from './StageVisualCatalog'

export interface StageBackgroundAdapter<T> {
  load(path: string, resolve: (resource: T) => void, reject: (error: unknown) => void): void
  apply(visual: StageVisual, far: T, mid: T | null): void
  release(path: string, resource: T): void
  clear?(): void
  warn?(path: string, error: unknown): void
}

interface LoadedResource<T> {
  readonly path: string
  readonly resource: T
  released: boolean
}

interface PendingBackground<T> {
  readonly generation: number
  readonly visual: StageVisual
  far: LoadedResource<T> | null
  mid: LoadedResource<T> | null
  midFailed: boolean
}

interface ActiveBackground<T> {
  readonly visual: StageVisual
  readonly far: LoadedResource<T>
  readonly mid: LoadedResource<T> | null
}

function sameVisual(left: StageVisual | null | undefined, right: StageVisual | null | undefined) {
  return Boolean(left && right && left.farPath === right.farPath && left.midPath === right.midPath)
}

export class StageBackgroundRuntime<T> {
  private generation = 0
  private destroyed = false
  private pending: PendingBackground<T> | null = null
  private active: ActiveBackground<T> | null = null
  private warnedPaths = new Set<string>()

  constructor(private readonly adapter: StageBackgroundAdapter<T>) {}

  request(visual: StageVisual) {
    if (this.destroyed || sameVisual(this.pending?.visual, visual)) return false
    if (sameVisual(this.active?.visual, visual)) {
      this.generation += 1
      this.cancelPending()
      return false
    }

    this.generation += 1
    this.cancelPending()
    const generation = this.generation
    this.pending = { generation, visual, far: null, mid: null, midFailed: false }
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

  private startLoad(generation: number, slot: 'far' | 'mid', path: string) {
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

  private resolve(generation: number, slot: 'far' | 'mid', path: string, resource: T) {
    const loaded: LoadedResource<T> = { path, resource, released: false }
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

  private reject(generation: number, slot: 'far' | 'mid', path: string, error: unknown) {
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

  private applyPending(pending: PendingBackground<T>) {
    if (this.destroyed || this.pending !== pending || !pending.far) return
    const previous = this.active
    this.adapter.apply(pending.visual, pending.far.resource, pending.mid?.resource ?? null)
    this.active = { visual: pending.visual, far: pending.far, mid: pending.mid }
    this.pending = null
    this.releaseLoaded(previous?.far)
    this.releaseLoaded(previous?.mid)
  }

  private cancelPending() {
    const pending = this.pending
    this.pending = null
    this.releaseLoaded(pending?.far)
    this.releaseLoaded(pending?.mid)
  }

  private releaseLoaded(loaded: LoadedResource<T> | null | undefined) {
    if (!loaded || loaded.released) return
    loaded.released = true
    this.adapter.release(loaded.path, loaded.resource)
  }

  private warnOnce(path: string, error: unknown) {
    if (this.warnedPaths.has(path)) return
    this.warnedPaths.add(path)
    this.adapter.warn?.(path, error)
  }
}
