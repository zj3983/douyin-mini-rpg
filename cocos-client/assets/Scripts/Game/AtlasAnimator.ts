import { _decorator, Component, JsonAsset, Rect, Sprite, SpriteFrame, Texture2D, resources } from 'cc'
import { AtlasAction, AnimationAtlasManifest, findActorAtlas, findAtlasAction } from '../Core/AnimationAtlas'
import {
  actionDuration,
  actionCompleted,
  markersCrossed,
} from '../Core/AnimationEventRuntime'
import {
  consumeAnimationTime,
  frameIndexAtTime,
  resourcePathForPng,
  shouldAdvanceAnimation,
} from '../Core/StripAnimationRuntime'
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
  updateInterval = 1 / 60

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
  private completionEmitted = false

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
    this.completionEmitted = false
    if (this.targetSprite?.isValid) this.targetSprite.spriteFrame = null
  }

  onDestroy() {
    this.destroyed = true
    this.loadGeneration += 1
    this.resetState = prepareVisualForPool(this.resetState)
    this.playing = false
    this.action = null
    this.frames = []
    this.completionEmitted = false
    if (this.targetSprite?.isValid) this.targetSprite.spriteFrame = null
    for (const frames of this.frameCache.values()) {
      for (const frame of frames) frame.destroy()
    }
    this.frameCache.clear()
  }

  reset(actionName = 'move') {
    this.frameIndex = 0
    this.completionEmitted = false
    this.play(actionName)
  }

  currentFrameSize() {
    const rect = this.action?.frames[this.action.order[this.frameIndex]]
    if (rect && rect.w > 0 && rect.h > 0) return { width: rect.w, height: rect.h }
    const spriteRect = this.targetSprite?.spriteFrame?.rect
    if (spriteRect && spriteRect.width > 0 && spriteRect.height > 0) {
      return { width: spriteRect.width, height: spriteRect.height }
    }
    return null
  }

  currentFrameAspect() {
    const size = this.currentFrameSize()
    return size ? size.width / size.height : null
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
    this.completionEmitted = false

    const cacheKey = this.frameCacheKey(this.actorId, action.atlas, action.name)
    const cachedFrames = this.frameCache.get(cacheKey)
    if (cachedFrames) {
      this.frames = cachedFrames
      this.playing = cachedFrames.length > 0
      this.applyFrame()
      return
    }

    resources.load(resourcePathForPng(action.atlas), Texture2D, (error, texture) => {
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
      this.frames = this.buildFrames(texture, this.actorId, action.atlas, action)
      this.playing = this.frames.length > 0
      this.applyFrame()
    })
  }

  update(deltaTime: number) {
    if (!this.playing || !this.action || this.frames.length === 0) return

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

    const timing = consumeAnimationTime({
      accumulatedTime: this.accumulatedTime,
      updateInterval: this.updateInterval,
    })
    if (!timing.shouldAdvance) return

    const previousElapsed = this.elapsed
    this.elapsed += timing.elapsedDelta
    this.accumulatedTime = 0
    const action = this.action
    const actorId = this.actorId
    const loadGeneration = this.loadGeneration
    const duration = actionDuration(action.order.length, action.fps)
    const crossedMarkers = markersCrossed({
      previousElapsed,
      elapsed: this.elapsed,
      duration,
      loop: action.loop,
      markers: action.events ?? [],
      maxCatchUpCycles: 2,
    })
    const completed = !this.completionEmitted && actionCompleted({
      previousElapsed,
      elapsed: this.elapsed,
      duration,
      loop: action.loop,
    })
    const nextFrameIndex = frameIndexAtTime({
      elapsed: this.elapsed,
      framesPerSecond: action.fps,
      frameCount: action.order.length,
      loop: action.loop,
    })

    if (nextFrameIndex !== this.frameIndex) {
      this.frameIndex = nextFrameIndex
      this.applyFrame()
    }
    if (completed) {
      this.completionEmitted = true
      this.playing = false
    }

    for (const marker of crossedMarkers) {
      this.node.emit('atlas-animation-event', {
        actorId,
        action: action.name,
        marker: marker.name,
        normalizedTime: marker.at,
      })
      if (!this.isUpdateContextCurrent(action, loadGeneration)) return
    }

    if (completed) {
      this.node.emit('atlas-animation-complete', {
        actorId,
        action: action.name,
      })
      if (!this.isUpdateContextCurrent(action, loadGeneration)) return
    }
  }

  private isUpdateContextCurrent(action: AtlasAction, loadGeneration: number) {
    return !this.destroyed
      && this.isValid
      && this.node.isValid
      && this.loadGeneration === loadGeneration
      && this.action === action
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
