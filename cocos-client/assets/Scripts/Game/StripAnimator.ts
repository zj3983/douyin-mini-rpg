import { _decorator, Component, Rect, Sprite, SpriteFrame, Texture2D } from 'cc'
import { frameIndexAtTime, shouldAdvanceAnimation } from '../Core/StripAnimationRuntime'

const { ccclass, property } = _decorator

@ccclass('StripAnimator')
export class StripAnimator extends Component {
  @property(Sprite)
  targetSprite: Sprite | null = null

  @property
  frameCount = 4

  @property
  framesPerSecond = 8

  @property
  loop = true

  @property
  visibleForAnimation = true

  @property
  distanceToCamera = 0

  @property
  maxActiveDistance = 900

  @property
  updateInterval = 0.033

  private frames: SpriteFrame[] = []
  private elapsed = 0
  private accumulatedTime = 0
  private frameIndex = 0
  private playing = false

  play(texture: Texture2D, frameCount = this.frameCount, framesPerSecond = this.framesPerSecond) {
    this.frameCount = Math.max(1, Math.floor(frameCount))
    this.framesPerSecond = Math.max(1, framesPerSecond)
    this.frames = this.buildFrames(texture, this.frameCount)
    this.elapsed = 0
    this.accumulatedTime = 0
    this.frameIndex = 0
    this.playing = this.frames.length > 0
    this.applyFrame()
  }

  stop() {
    this.playing = false
    this.elapsed = 0
  }

  update(deltaTime: number) {
    if (!this.playing || this.frames.length <= 1) return

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
      framesPerSecond: this.framesPerSecond,
      frameCount: this.frames.length,
      loop: this.loop,
    })
    if (!this.loop && this.frameIndex >= this.frames.length - 1) this.playing = false
    this.applyFrame()
  }

  private buildFrames(texture: Texture2D, frameCount: number) {
    const width = texture.width / frameCount
    const height = texture.height
    const frames: SpriteFrame[] = []

    for (let index = 0; index < frameCount; index += 1) {
      const frame = new SpriteFrame()
      frame.texture = texture
      frame.rect = new Rect(index * width, 0, width, height)
      frames.push(frame)
    }

    return frames
  }

  private applyFrame() {
    if (!this.targetSprite || this.frames.length === 0) return
    this.targetSprite.spriteFrame = this.frames[this.frameIndex]
  }
}
