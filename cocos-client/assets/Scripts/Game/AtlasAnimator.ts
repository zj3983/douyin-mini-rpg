import { _decorator, Component, JsonAsset, Rect, Sprite, SpriteFrame, Texture2D, resources } from 'cc'
import { AtlasAction, AnimationAtlasManifest, findActorAtlas, findAtlasAction } from '../Core/AnimationAtlas'
import { frameIndexAtTime, resourcePathForPng, shouldAdvanceAnimation } from '../Core/StripAnimationRuntime'
import {
  acceptAnimationLoad,
  beginAnimationLoad,
  createVisualResetState,
  prepareVisualForPool,
  VisualResetState,
} from '../Core/VisualResetRuntime'

const { ccclass, property } = _decorator

@ccclass('AtlasAnimator')
export class AtlasAnimator extends Component {
  @property(JsonAsset)
  animationManifest: JsonAsset | null = null

  @property(Sprite)
  targetSprite: Sprite | null = null

  @property
  actorId = 'qinglan-sword-cultivator'

  @property
  visibleForAnimation = true

  @property
  distanceToCamera = 0

  @property
  maxActiveDistance = 900

  @property
  updateInterval = 0.033

  private action: AtlasAction | null = null
  private texture: Texture2D | null = null
  private frames: SpriteFrame[] = []
  private elapsed = 0
  private accumulatedTime = 0
  private frameIndex = 0
  private playing = false
  private loadGeneration = 0
  private resetState: VisualResetState = createVisualResetState()
  private frameCache = new Map<string, SpriteFrame[]>()
  private destroyed = false

  setActor(actorId: string) {
    if (this.actorId === actorId) return
    this.actorId = actorId
    this.stop()
  }

  stop() {
    this.loadGeneration += 1
    this.resetState = prepareVisualForPool(this.resetState)
    this.action = null
    this.texture = null
    this.frames = []
    this.elapsed = 0
    this.accumulatedTime = 0
    this.frameIndex = 0
    this.playing = false
    if (this.targetSprite?.isValid) this.targetSprite.spriteFrame = null
  }

  onDestroy() {
    this.destroyed = true
    this.loadGeneration += 1
    this.resetState = prepareVisualForPool(this.resetState)
    this.playing = false
    this.action = null
    this.frames = []
    if (this.targetSprite?.isValid) this.targetSprite.spriteFrame = null
    for (const frames of this.frameCache.values()) {
      for (const frame of frames) frame.destroy()
    }
    this.frameCache.clear()
  }

  reset(actionName = 'move') {
    this.frameIndex = 0
    this.play(actionName)
  }

  play(actionName: string) {
    if (this.destroyed) return
    const manifest = this.animationManifest?.json as AnimationAtlasManifest | undefined
    if (!manifest) return

    const actor = findActorAtlas(manifest, this.actorId)
    const action = findAtlasAction(actor, actionName)
    const request = beginAnimationLoad(this.resetState, this.actorId, actionName)
    this.resetState = request.state
    this.loadGeneration = request.token.generation
    this.action = action
    this.elapsed = 0
    this.accumulatedTime = 0
    this.frameIndex = 0
    this.playing = false

    resources.load(resourcePathForPng(actor.atlas), Texture2D, (error, texture) => {
      if (
        error
        || !texture
        || this.destroyed
        || !this.node.isValid
        || !this.targetSprite?.isValid
        || !this.targetSprite.node.isValid
        || !acceptAnimationLoad(this.resetState, request.token)
      ) return
      this.texture = texture
      this.frames = this.buildFrames(texture, this.actorId, actor.atlas, action)
      this.playing = this.frames.length > 0
      this.applyFrame()
    })
  }

  update(deltaTime: number) {
    if (!this.playing || !this.action || this.frames.length <= 1) return

    this.accumulatedTime += deltaTime
    if (!shouldAdvanceAnimation({
      visible: this.visibleForAnimation,
      distanceToCamera: this.distanceToCamera,
      maxActiveDistance: this.maxActiveDistance,
      accumulatedTime: this.accumulatedTime,
      updateInterval: this.updateInterval,
    })) {
      return
    }

    this.elapsed += deltaTime
    this.accumulatedTime = 0
    this.frameIndex = frameIndexAtTime({
      elapsed: this.elapsed,
      framesPerSecond: this.action.fps,
      frameCount: this.action.order.length,
      loop: this.action.loop,
    })
    if (!this.action.loop && this.frameIndex >= this.action.order.length - 1) this.playing = false
    this.applyFrame()
  }

  private buildFrames(texture: Texture2D, actorId: string, atlas: string, action: AtlasAction) {
    const cacheKey = this.frameCacheKey(actorId, atlas, action.name)
    const cached = this.frameCache.get(cacheKey)
    if (cached) return cached
    const frames = action.order.map((frameIndex) => {
      const rect = action.frames[frameIndex]
      const frame = new SpriteFrame()
      frame.texture = texture
      frame.rect = new Rect(rect.x, rect.y, rect.w, rect.h)
      return frame
    })
    this.frameCache.set(cacheKey, frames)
    return frames
  }

  private frameCacheKey(actorId: string, atlas: string, actionName: string) {
    return `${actorId}:${atlas}:${actionName}`
  }

  private applyFrame() {
    if (!this.targetSprite || this.frames.length === 0) return
    this.targetSprite.spriteFrame = this.frames[this.frameIndex]
  }
}
