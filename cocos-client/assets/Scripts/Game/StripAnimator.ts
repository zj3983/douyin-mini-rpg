import { _decorator, Component, Rect, Sprite, SpriteFrame, Texture2D } from 'cc'

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

  private frames: SpriteFrame[] = []
  private elapsed = 0
  private frameIndex = 0
  private playing = false

  play(texture: Texture2D, frameCount = this.frameCount, framesPerSecond = this.framesPerSecond) {
    this.frameCount = Math.max(1, Math.floor(frameCount))
    this.framesPerSecond = Math.max(1, framesPerSecond)
    this.frames = this.buildFrames(texture, this.frameCount)
    this.elapsed = 0
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

    this.elapsed += deltaTime
    const nextIndex = Math.floor(this.elapsed * this.framesPerSecond)
    if (this.loop) {
      this.frameIndex = nextIndex % this.frames.length
    } else {
      this.frameIndex = Math.min(this.frames.length - 1, nextIndex)
      this.playing = this.frameIndex < this.frames.length - 1
    }
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
