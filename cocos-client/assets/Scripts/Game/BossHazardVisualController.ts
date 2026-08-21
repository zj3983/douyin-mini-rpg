import { _decorator, Color, Component, Graphics, Sprite, SpriteFrame, UITransform } from 'cc'
import type { BossVfxLayerLayout, BossVfxLayout } from '../Core/BossTelegraphVisualProfile.ts'

const { ccclass, property } = _decorator
const DEFAULT_LAYER_SIZE = 1
const MIN_LAYER_SIZE = 0.001
const RESET_COLOR = new Color(255, 255, 255, 0)

function positiveDimension(value: number): number {
  return Number.isFinite(value) && value > 0
    ? Math.max(MIN_LAYER_SIZE, value)
    : DEFAULT_LAYER_SIZE
}

function resetLayer(sprite: Sprite | null): void {
  if (!sprite) return

  sprite.spriteFrame = null
  sprite.color = RESET_COLOR
  sprite.enabled = true
  sprite.node.active = false
  sprite.node.getComponent(UITransform)?.setContentSize(DEFAULT_LAYER_SIZE, DEFAULT_LAYER_SIZE)
  sprite.node.setPosition(0, 0, 0)
  sprite.node.setScale(1, 1, 1)
  sprite.node.setRotationFromEuler(0, 0, 0)
}

function setLayerSize(
  sprite: Sprite | null,
  width: number,
  height: number,
  spec: BossVfxLayerLayout,
  vertical: boolean,
): void {
  const orientedWidth = vertical ? height : width
  const orientedHeight = vertical ? width : height
  sprite?.node.getComponent(UITransform)?.setContentSize(
    Math.max(spec.minWidth, orientedWidth * spec.widthScale),
    Math.max(spec.minHeight, orientedHeight * spec.heightScale),
  )
}

@ccclass('BossHazardVisualController')
export class BossHazardVisualController extends Component {
  @property(Graphics)
  graphics: Graphics | null = null

  @property(Sprite)
  mainShape: Sprite | null = null

  @property(Sprite)
  accent: Sprite | null = null

  @property(Sprite)
  particleNear: Sprite | null = null

  @property(Sprite)
  particleFar: Sprite | null = null

  resetVisual(): void {
    this.graphics?.clear()
    resetLayer(this.mainShape)
    resetLayer(this.accent)
    resetLayer(this.particleNear)
    resetLayer(this.particleFar)
  }

  setLayerFrames(
    main: SpriteFrame | null,
    accent: SpriteFrame | null,
    particle: SpriteFrame | null,
  ): void {
    if (this.mainShape) this.mainShape.spriteFrame = main
    if (this.accent) this.accent.spriteFrame = accent
    if (this.particleNear) this.particleNear.spriteFrame = particle
    if (this.particleFar) this.particleFar.spriteFrame = particle
  }

  setLayerLayout(width: number, height: number, layout: BossVfxLayout, vertical: boolean): void {
    const safeWidth = positiveDimension(width)
    const safeHeight = positiveDimension(height)
    setLayerSize(this.mainShape, safeWidth, safeHeight, layout.layers.mainShape, vertical)
    setLayerSize(this.accent, safeWidth, safeHeight, layout.layers.accent, vertical)
    setLayerSize(this.particleNear, safeWidth, safeHeight, layout.layers.particleNear, vertical)
    setLayerSize(this.particleFar, safeWidth, safeHeight, layout.layers.particleFar, vertical)
  }
}
