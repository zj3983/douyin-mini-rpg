import { Asset, resources, SpriteFrame, Texture2D } from 'cc'
import { StageResourceRuntime } from '../Core/StageResourceRuntime'
import { stageResourcePlanFor } from '../Core/StageVisualCatalog'
import { StageBackgroundController } from './StageBackgroundController'

export class StageResourceController {
  private readonly runtime: StageResourceRuntime<Asset>

  constructor(private readonly backgroundController: StageBackgroundController) {
    this.runtime = new StageResourceRuntime<Asset>({
      load: (asset, resolve, reject) => {
        const resourceType = asset.kind === 'spriteFrame' ? SpriteFrame : Texture2D
        resources.load(asset.path, resourceType, (error, loaded) => {
          if (error || !loaded) {
            reject(error ?? new Error(`Missing stage resource: ${asset.path}`))
            return
          }
          loaded.addRef()
          resolve(loaded)
        })
      },
      release: (_asset, resource) => resource.decRef(),
      ready: () => {},
      warn: (asset, error) => console.warn(`[StageResourceController] load failed: ${asset.path}`, error),
    })
  }

  activate(stageId: number) {
    this.backgroundController.showStage(stageId)
    try {
      return this.runtime.activate(stageResourcePlanFor(stageId))
    } catch {
      return false
    }
  }

  prefetchNext(stageId: number) {
    if (stageId < 1 || stageId >= 4) return false
    return this.runtime.prefetch(stageResourcePlanFor(stageId + 1))
  }

  destroy() {
    this.runtime.destroy()
  }
}
