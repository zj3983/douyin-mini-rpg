import {
  Button,
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Node,
  UITransform,
  Vec3,
  VerticalTextAlignment,
} from 'cc'
import { uiTokens } from '../Theme/ui-theme.generated'

export type UiButtonTone = 'primary' | 'secondary' | 'quiet'
export type UiQuality = typeof uiTokens.qualityOrder[number]

const palette = {
  ink: Color.fromHEX(new Color(), uiTokens.color.ink),
  muted: Color.fromHEX(new Color(), uiTokens.color.muted),
  cream: Color.fromHEX(new Color(), uiTokens.color.cream),
  panel: Color.fromHEX(new Color(), uiTokens.color.panelSurface),
  panelRaised: Color.fromHEX(new Color(), uiTokens.color.panelSurfaceRaised),
  jade: Color.fromHEX(new Color(), uiTokens.color.jadePrimary),
  jadeDeep: Color.fromHEX(new Color(), uiTokens.color.jadeDeep),
  jadeLine: Color.fromHEX(new Color(), uiTokens.color.jadeBorder),
  gold: Color.fromHEX(new Color(), uiTokens.color.goldAccent),
  goldLight: Color.fromHEX(new Color(), uiTokens.color.goldHighlight),
  white: Color.fromHEX(new Color(), uiTokens.color.textPrimary),
  progressBg: Color.fromHEX(new Color(), uiTokens.color.progressTrack),
  quality: Object.fromEntries(uiTokens.qualityOrder.map((quality) => [
    quality,
    Color.fromHEX(new Color(), uiTokens.color.quality[quality]),
  ])) as Record<UiQuality, Color>,
}

export class CultivationUiFactory {
  static readonly tokens = uiTokens

  static color(hex: string) {
    return Color.fromHEX(new Color(), hex)
  }

  static panel(parent: Node, name: string, width: number, height: number, options: {
    x?: number
    y?: number
    fill?: Color
    border?: Color
    radius?: number
  } = {}) {
    const style = uiTokens.component.panelFrame
    const node = this.box(parent, name, width, height, options.x ?? 0, options.y ?? 0)
    this.rounded(node, width, height, options.radius ?? style.radius, options.fill ?? palette.panel, options.border ?? palette.jadeLine, style.stroke)
    return node
  }

  static button(parent: Node, name: string, title: string, width: number, tone: UiButtonTone, x = 0, y = 0) {
    const style = uiTokens.component.primaryButton
    const height = style.height
    const fill = tone === 'primary' ? this.tokenColor(style.fill) : tone === 'secondary' ? palette.jadeDeep : palette.cream
    const border = tone === 'primary' ? this.tokenColor(style.border) : tone === 'secondary' ? palette.jadeLine : this.tokenColor('softBorder')
    const node = this.box(parent, name, width, height, x, y)
    this.rounded(node, width, height, style.radius, fill, border, style.stroke)
    node.addComponent(Button)
    const textColor = tone === 'quiet' ? palette.jadeDeep : this.tokenColor(style.text)
    this.label(node, 'TitleLabel', title, width - uiTokens.space.md, height, uiTokens.typeSize[style.fontSize], textColor)
    return node
  }

  static chip(parent: Node, name: string, title: string, value: string, x: number, y: number) {
    const style = uiTokens.component.resourceChip
    const width = Math.max(style.minimumWidth, (title.length + value.length) * style.characterAdvance + style.horizontalPadding * 2)
    const node = this.box(parent, name, width, style.height, x, y)
    this.rounded(node, width, style.height, style.radius, palette.cream, this.tokenColor(style.border), style.stroke)
    this.label(node, 'ValueLabel', `${title}  ${value}`, width - uiTokens.space.sm, style.height, uiTokens.typeSize[style.fontSize], palette.ink)
    return node
  }

  static progress(parent: Node, name: string, width: number, ratio: number, fill: Color, x = 0, y = 0) {
    const style = uiTokens.component.progressBar
    const node = this.box(parent, name, width, style.height, x, y)
    this.rounded(node, width, style.height, style.radius, palette.progressBg, this.tokenColor(style.border), style.stroke)
    const value = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0))
    if (value > 0) {
      const fillWidth = Math.max(style.height, width * value)
      const fillNode = this.box(node, 'ProgressFill', fillWidth, style.height - style.stroke, -width / 2 + fillWidth / 2, 0)
      this.rounded(fillNode, fillWidth, style.height - style.stroke, style.radius, fill, fill, 0)
    }
    return node
  }

  static qualityFrame(parent: Node, name: string, width: number, height: number, quality: UiQuality, x = 0, y = 0) {
    const style = uiTokens.component.qualityFrame
    const node = this.box(parent, name, width, height, x, y)
    const tone = palette.quality[quality]
    this.rounded(node, width, height, style.radius, palette.cream, tone, style.stroke)
    const inset = this.box(node, 'QualityInset', width - uiTokens.space.xs, height - uiTokens.space.xs, 0, 0)
    this.rounded(inset, width - uiTokens.space.xs, height - uiTokens.space.xs, style.radius - uiTokens.stroke.emphasis, new Color(0, 0, 0, 0), tone, uiTokens.stroke.hairline)
    return node
  }

  static navItem(parent: Node, name: string, glyph: string, title: string, active: boolean, x: number, y: number) {
    const style = uiTokens.component.navItem
    const node = this.box(parent, name, style.width, style.height, x, y)
    const fill = this.tokenColor(active ? style.activeFill : style.inactiveFill)
    const border = this.tokenColor(active ? style.activeBorder : style.inactiveBorder)
    this.rounded(node, style.width, style.height, style.radius, fill, border, style.stroke)
    this.label(node, 'IconLabel', glyph, style.width, style.iconHeight, style.iconFontSize, this.tokenColor(active ? style.activeText : style.inactiveText), 0, style.iconY)
    this.label(node, 'TitleLabel', title, style.width, style.titleHeight, uiTokens.typeSize[style.titleFontSize], this.tokenColor(active ? style.activeText : style.inactiveText), 0, style.titleY)
    if (active) {
      const markerWidth = style.width - style.markerInset
      const marker = this.box(node, 'ActiveMarker', markerWidth, style.markerHeight, 0, -style.height / 2 + style.markerOffset)
      this.rounded(marker, markerWidth, style.markerHeight, uiTokens.radius.sm / 4, palette.gold, palette.gold, 0)
    }
    return node
  }

  static label(parent: Node, name: string, value: string, width: number, height: number, fontSize: number, color: Color, x = 0, y = 0) {
    const node = this.box(parent, name, width, height, x, y)
    const label = node.addComponent(Label)
    label.string = value
    label.fontSize = fontSize
    label.lineHeight = fontSize + uiTokens.space.xs
    label.color = color
    label.horizontalAlign = HorizontalTextAlignment.CENTER
    label.verticalAlign = VerticalTextAlignment.CENTER
    label.overflow = Label.Overflow.SHRINK
    return node
  }

  static box(parent: Node, name: string, width: number, height: number, x = 0, y = 0) {
    const node = new Node(name)
    node.layer = parent.layer
    node.setPosition(new Vec3(x, y, 0))
    node.addComponent(UITransform).setContentSize(width, height)
    parent.addChild(node)
    return node
  }

  private static tokenColor(name: string) {
    return this.color(uiTokens.color[name as keyof typeof uiTokens.color] as string)
  }

  private static rounded(node: Node, width: number, height: number, radius: number, fill: Color, border: Color, lineWidth: number) {
    const graphics = node.addComponent(Graphics)
    graphics.clear()
    graphics.lineWidth = lineWidth
    graphics.fillColor = fill
    graphics.strokeColor = border
    graphics.roundRect(-width / 2, -height / 2, width, height, radius)
    if (fill.a > 0) graphics.fill()
    if (lineWidth > 0) graphics.stroke()
  }
}
