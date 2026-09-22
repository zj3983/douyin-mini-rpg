import { Asset, AudioClip, resources, SpriteFrame, Texture2D } from 'cc'
import {
  DUNGEON_AUDIO_PATHS,
  DUNGEON_EFFECT_PATHS,
  dungeonActorAtlasPaths,
  dungeonFloorVisualFor,
  type MistVaultFloor,
} from '../Core/Dungeon/DungeonVisualCatalog'

export type DungeonResourceKind = 'spriteFrame' | 'texture' | 'audioClip'

export interface DungeonResourceDescriptor {
  readonly path: string
  readonly kind: DungeonResourceKind
}

export interface DungeonResourceAdapter<T> {
  load(descriptor: DungeonResourceDescriptor): Promise<T>
  release(descriptor: DungeonResourceDescriptor, resource: T): void
  showFloor(floor: MistVaultFloor, resources: ReadonlyMap<string, T>): void | Promise<void>
}

export type DungeonResourceStatus =
  | { readonly state: 'idle' | 'loading' | 'ready' | 'destroyed' }
  | { readonly state: 'retry'; readonly error: string }

interface ResourceEntry<T> {
  readonly descriptor: DungeonResourceDescriptor
  readonly resource: T
  refs: number
}

interface ResourceBatch<T> {
  readonly floor: MistVaultFloor | null
  readonly descriptors: readonly DungeonResourceDescriptor[]
  readonly entries: readonly ResourceEntry<T>[]
}

const floorDescriptorList = (floor: MistVaultFloor, actorIds?: readonly string[]): DungeonResourceDescriptor[] => {
  const visual = dungeonFloorVisualFor('mist-vault', floor)
  const roster = actorIds ?? visual.monsterActorIds
  return uniqueDescriptors([
    { path: visual.farPath, kind: 'spriteFrame' },
    { path: visual.midPath, kind: 'spriteFrame' },
    ...roster.flatMap((actorId) => dungeonActorAtlasPaths(actorId).map((path) => ({ path, kind: 'texture' as const }))),
  ])
}

const commonDescriptorList = (): DungeonResourceDescriptor[] => uniqueDescriptors([
  ...DUNGEON_EFFECT_PATHS.map((path) => ({ path, kind: 'spriteFrame' as const })),
  ...DUNGEON_AUDIO_PATHS.map((path) => ({ path, kind: 'audioClip' as const })),
])

function uniqueDescriptors(descriptors: readonly DungeonResourceDescriptor[]): DungeonResourceDescriptor[] {
  const byPath = new Map<string, DungeonResourceDescriptor>()
  for (const descriptor of descriptors) {
    const existing = byPath.get(descriptor.path)
    if (existing && existing.kind !== descriptor.kind) throw new Error(`Resource kind mismatch: ${descriptor.path}`)
    byPath.set(descriptor.path, Object.freeze({ ...descriptor }))
  }
  return Array.from(byPath.values())
}

export class DungeonResourceController<T = Asset> {
  private readonly loaded = new Map<string, ResourceEntry<T>>()
  private readonly inFlight = new Map<string, Promise<ResourceEntry<T>>>()
  private readonly prefetched = new Map<MistVaultFloor, ResourceBatch<T>>()
  private commonBatch: ResourceBatch<T> | null = null
  private preparedFloor: ResourceBatch<T> | null = null
  private activeFloor: ResourceBatch<T> | null = null
  private preparation: Promise<boolean> | null = null
  private presentationTail: Promise<void> = Promise.resolve()
  private lastEntryActors: readonly string[] = []
  private resourceStatus: DungeonResourceStatus = Object.freeze({ state: 'idle' })
  private activationGeneration = 0
  private prefetchGeneration = 0
  private destroyed = false

  constructor(private readonly adapter: DungeonResourceAdapter<T> = createCocosAdapter() as DungeonResourceAdapter<T>) {}

  isReady() {
    return this.resourceStatus.state === 'ready' && !this.destroyed
  }

  status(): DungeonResourceStatus {
    return this.resourceStatus
  }

  prepareEntry(currentRoomActorIds: readonly string[] = dungeonFloorVisualFor('mist-vault', 1).monsterActorIds) {
    if (this.destroyed) return Promise.resolve(false)
    if (this.isReady()) return Promise.resolve(true)
    if (this.preparation) return this.preparation
    this.lastEntryActors = [...currentRoomActorIds]
    this.resourceStatus = Object.freeze({ state: 'loading' })
    this.preparation = this.prepareEntryInternal(this.lastEntryActors).finally(() => {
      this.preparation = null
    })
    return this.preparation
  }

  retryPreparation() {
    if (this.preparation) return this.preparation
    if (this.resourceStatus.state !== 'retry') return Promise.resolve(this.isReady())
    return this.prepareEntry(this.lastEntryActors)
  }

  async activateFloor(floor: MistVaultFloor, roomActorIds?: readonly string[]) {
    if (!this.isReady()) return false
    const requested = floorDescriptorList(floor, roomActorIds)
    if (this.activeFloor?.floor === floor && sameDescriptors(this.activeFloor.descriptors, requested)) return true
    const generation = ++this.activationGeneration
    let candidate: ResourceBatch<T> | null = null
    try {
      if (floor === 1 && this.preparedFloor && sameDescriptors(this.preparedFloor.descriptors, requested)) {
        candidate = this.preparedFloor
        this.preparedFloor = null
      } else {
        const prefetched = this.prefetched.get(floor)
        if (prefetched && sameDescriptors(prefetched.descriptors, requested)) {
          candidate = prefetched
          this.prefetched.delete(floor)
        } else {
          candidate = await this.acquireBatch(floor, requested)
        }
      }

      if (this.destroyed || generation !== this.activationGeneration) {
        this.releaseBatch(candidate)
        return false
      }
      const presented = await this.presentFloor(generation, floor, candidate)
      if (!presented) {
        this.releaseBatch(candidate)
        return false
      }

      const previous = this.activeFloor
      this.activeFloor = candidate
      if (previous && previous !== candidate) this.releaseBatch(previous)
      if (this.preparedFloor && this.preparedFloor !== candidate) {
        this.releaseBatch(this.preparedFloor)
        this.preparedFloor = null
      }
      this.releaseUnusedPrefetches(floor < 3 ? floor + 1 as MistVaultFloor : null)
      const prefetchGeneration = ++this.prefetchGeneration
      if (floor < 3) void this.prefetchFloor(floor + 1 as MistVaultFloor, prefetchGeneration)
      return true
    } catch (error) {
      if (candidate) this.releaseBatch(candidate)
      if (!this.destroyed && generation === this.activationGeneration) {
        this.resourceStatus = Object.freeze({ state: 'retry', error: errorMessage(error) })
      }
      return false
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.activationGeneration += 1
    this.prefetchGeneration += 1
    this.resourceStatus = Object.freeze({ state: 'destroyed' })
    if (this.activeFloor) this.releaseBatch(this.activeFloor)
    if (this.preparedFloor) this.releaseBatch(this.preparedFloor)
    if (this.commonBatch) this.releaseBatch(this.commonBatch)
    for (const batch of this.prefetched.values()) this.releaseBatch(batch)
    this.activeFloor = null
    this.preparedFloor = null
    this.commonBatch = null
    this.prefetched.clear()
  }

  snapshot() {
    return {
      activeFloor: this.activeFloor?.floor ?? null,
      retainedFloors: Array.from(new Set([
        this.activeFloor?.floor,
        this.preparedFloor?.floor,
        ...Array.from(this.prefetched.keys()),
      ].filter((floor): floor is MistVaultFloor => floor !== undefined && floor !== null))).sort(),
      prefetchedFloors: Array.from(this.prefetched.keys()).sort(),
      pendingFloors: this.inFlight.size > 0 ? [-1] : [],
      loadedPaths: Array.from(this.loaded.keys()).sort(),
      destroyed: this.destroyed,
    }
  }

  private async prepareEntryInternal(actorIds: readonly string[]) {
    let common: ResourceBatch<T> | null = null
    let floor: ResourceBatch<T> | null = null
    try {
      const settled = await Promise.allSettled([
        this.acquireBatch(null, commonDescriptorList()),
        this.acquireBatch(1, floorDescriptorList(1, actorIds)),
      ])
      const [commonResult, floorResult] = settled
      if (commonResult.status === 'rejected') {
        if (floorResult.status === 'fulfilled') this.releaseBatch(floorResult.value)
        throw commonResult.reason
      }
      if (floorResult.status === 'rejected') {
        this.releaseBatch(commonResult.value)
        throw floorResult.reason
      }
      common = commonResult.value
      floor = floorResult.value
      if (this.destroyed) {
        this.releaseBatch(common)
        this.releaseBatch(floor)
        return false
      }
      if (this.commonBatch) this.releaseBatch(this.commonBatch)
      if (this.preparedFloor) this.releaseBatch(this.preparedFloor)
      this.commonBatch = common
      this.preparedFloor = floor
      this.resourceStatus = Object.freeze({ state: 'ready' })
      return true
    } catch (error) {
      if (common) this.releaseBatch(common)
      if (floor) this.releaseBatch(floor)
      if (!this.destroyed) this.resourceStatus = Object.freeze({ state: 'retry', error: errorMessage(error) })
      return false
    }
  }

  private async prefetchFloor(floor: MistVaultFloor, generation: number) {
    if (this.destroyed || this.prefetched.has(floor) || this.activeFloor?.floor === floor) return false
    try {
      const batch = await this.acquireBatch(floor, floorDescriptorList(floor))
      if (
        this.destroyed
        || generation !== this.prefetchGeneration
        || this.activeFloor?.floor === floor
        || this.prefetched.has(floor)
      ) {
        this.releaseBatch(batch)
        return false
      }
      this.prefetched.set(floor, batch)
      return true
    } catch {
      return false
    }
  }

  private async acquireBatch(floor: MistVaultFloor | null, descriptors: readonly DungeonResourceDescriptor[]) {
    const settled = await Promise.allSettled(descriptors.map((descriptor) => this.acquire(descriptor)))
    const entries = settled.filter((result): result is PromiseFulfilledResult<ResourceEntry<T>> => result.status === 'fulfilled')
      .map(({ value }) => value)
    const failure = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failure) {
      this.releaseEntries(entries)
      throw failure.reason
    }
    return { floor, descriptors, entries } as ResourceBatch<T>
  }

  private presentFloor(generation: number, floor: MistVaultFloor, batch: ResourceBatch<T>): Promise<boolean> {
    const presentation = this.presentationTail.catch(() => {}).then(async () => {
      if (this.destroyed || generation !== this.activationGeneration) return false
      await this.adapter.showFloor(floor, new Map(batch.entries.map((entry) => [entry.descriptor.path, entry.resource])))
      return !this.destroyed && generation === this.activationGeneration
    })
    this.presentationTail = presentation.then(() => {}, () => {})
    return presentation
  }

  private async acquire(descriptor: DungeonResourceDescriptor) {
    let entry = this.loaded.get(descriptor.path)
    if (!entry) {
      let request = this.inFlight.get(descriptor.path)
      if (!request) {
        request = this.adapter.load(descriptor).then((resource) => {
          if (this.destroyed) {
            this.adapter.release(descriptor, resource)
            throw new Error('Dungeon resources were destroyed during loading.')
          }
          const loaded = { descriptor, resource, refs: 0 }
          this.loaded.set(descriptor.path, loaded)
          return loaded
        }).finally(() => {
          this.inFlight.delete(descriptor.path)
        })
        this.inFlight.set(descriptor.path, request)
      }
      entry = await request
    }
    entry.refs += 1
    return entry
  }

  private releaseBatch(batch: ResourceBatch<T>) {
    this.releaseEntries(batch.entries)
  }

  private releaseEntries(entries: readonly ResourceEntry<T>[]) {
    for (const entry of entries) {
      if (entry.refs <= 0) continue
      entry.refs -= 1
      if (entry.refs > 0) continue
      if (this.loaded.get(entry.descriptor.path) === entry) this.loaded.delete(entry.descriptor.path)
      this.adapter.release(entry.descriptor, entry.resource)
    }
  }

  private releaseUnusedPrefetches(keep: MistVaultFloor | null) {
    for (const [floor, batch] of this.prefetched) {
      if (floor === keep) continue
      this.releaseBatch(batch)
      this.prefetched.delete(floor)
    }
  }
}

function sameDescriptors(left: readonly DungeonResourceDescriptor[], right: readonly DungeonResourceDescriptor[]) {
  return left.length === right.length && left.every((descriptor, index) => (
    descriptor.path === right[index].path && descriptor.kind === right[index].kind
  ))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function createCocosAdapter(): DungeonResourceAdapter<Asset> {
  return {
    load: (descriptor) => new Promise((resolve, reject) => {
      const assetType = descriptor.kind === 'spriteFrame'
        ? SpriteFrame
        : descriptor.kind === 'audioClip' ? AudioClip : Texture2D
      const fail = (error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error ?? 'asset missing')
        reject(new Error(`Failed dungeon resource ${descriptor.path} (${descriptor.kind}): ${detail}`))
      }
      try {
        resources.load(descriptor.path, assetType, (error: Error | null, asset: Asset | null) => {
          if (error || !asset) return fail(error)
          asset.addRef()
          resolve(asset)
        })
      } catch (error) {
        fail(error)
      }
    }),
    release: (_descriptor, resource) => resource.decRef(),
    showFloor: () => {},
  }
}
