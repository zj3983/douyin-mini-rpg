import { resources, Sprite, SpriteFrame } from 'cc'
import { StageBackgroundRuntime } from '../Core/StageBackgroundRuntime'
import { stageVisualFor } from '../Core/StageVisualCatalog'

export class StageBackgroundController {
  private driftElapsed = 0
  private warnedStages = new Set<number>()
  private readonly runtime: StageBackgroundRuntime<SpriteFrame>

  constructor(
    private readonly farSprite: Sprite,
    private readonly midSprite: Sprite,
  ) {
    this.runtime = new StageBackgroundRuntime<SpriteFrame>({
      load: (path, resolve, reject) => {
        resources.load(path, SpriteFrame, (error, asset) => {
          if (error || !asset) {
            reject(error ?? new Error(`Missing SpriteFrame: ${path}`))
            return
          }
          asset.addRef()
          resolve(asset)
        })
      },
      apply: (_visual, far, mid) => {
        this.farSprite.spriteFrame = far
        this.farSprite.sizeMode = Sprite.SizeMode.CUSTOM
        if (mid) {
          this.midSprite.spriteFrame = mid
          this.midSprite.sizeMode = Sprite.SizeMode.CUSTOM
          this.midSprite.node.active = true
        } else {
          this.midSprite.spriteFrame = null
          this.midSprite.node.active = false
        }
      },
      release: (_path, resource) => resource.decRef(),
      clear: () => {
        this.farSprite.spriteFrame = null
        this.midSprite.spriteFrame = null
        this.midSprite.node.active = false
      },
      warn: (path, error) => console.warn(`[StageBackgroundController] load failed: ${path}`, error),
    })
  }

  showStage(stageId: number) {
    try {
      return this.runtime.request(stageVisualFor(stageId))
    } catch (error) {
      if (!this.warnedStages.has(stageId)) {
        this.warnedStages.add(stageId)
        console.warn(`[StageBackgroundController] unknown stage: ${stageId}`, error)
      }
      return false
    }
  }

  update(deltaTime: number) {
    if (!this.midSprite.node.active) return
    this.driftElapsed += Math.min(Math.max(deltaTime, 0), 0.05)
    this.midSprite.node.setPosition(Math.sin(this.driftElapsed * 0.22) * 8, 0, 0)
  }

  destroy() {
    this.runtime.destroy()
  }
}
