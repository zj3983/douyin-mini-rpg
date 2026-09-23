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

export type UiButtonTone = 'primary' | 'secondary' | 'quiet'
export type UiQuality = 'common' | 'spirit' | 'mystic' | 'earth' | 'heaven' | 'immortal'

const palette = {
  ink: new Color(23, 54, 50, 255),
  muted: new Color(91, 116, 106, 255),
  cream: new Color(251, 250, 242, 255),
  panel: new Color(221, 235, 229, 244),
  panelRaised: new Color(240, 245, 237, 235),
  jade: new Color(36, 125, 112, 255),
  jadeDeep: new Color(22, 78, 74, 255),
  jadeLine: new Color(119, 184, 165, 255),
  gold: new Color(215, 174, 85, 255),
  goldLight: new Color(240, 217, 140, 255),
  white: new Color(244, 241, 223, 255),
  progressBg: new Color(179, 202, 188, 255),
  quality: {
    common: new Color(145, 157, 151, 255),
    spirit: new Color(99, 185, 141, 255),
    mystic: new Color(93, 168, 216, 255),
    earth: new Color(161, 123, 210, 255),
    heaven: new Color(215, 174, 85, 255),
    immortal: new Color(231, 140, 98, 255),
  },
} as const

export class CultivationUiFactory {
  static panel(parent: Node, name: string, width: number, height: number, options: {
    x?: number
    y?: number
    fill?: Color
    border?: Color
    radius?: number
  } = {}) {
    const node = this.box(parent, name, width, height, options.x ?? 0, options.y ?? 0)
    this.rounded(node, width, height, options.radius ?? 16, options.fill ?? palette.panel, options.border ?? palette.jadeLine, 2)
    return node
  }

  static button(parent: Node, name: string, title: string, width: number, tone: UiButtonTone, x = 0, y = 0) {
    const height = 52
    const fill = tone === 'primary' ? new Color(159, 121, 47, 255) : tone === 'secondary' ? palette.jadeDeep : palette.cream
    const border = tone === 'primary' ? palette.goldLight : tone === 'secondary' ? palette.jadeLine : new Color(168, 200, 186, 255)
    const node = this.box(parent, name, width, height, x, y)
    this.rounded(node, width, height, 10, fill, border, 2)
    node.addComponent(Button)
    const textColor = tone === 'quiet' ? palette.jadeDeep : palette.white
    this.label(node, 'TitleLabel', title, width - 20, height, 28, textColor)
    return node
  }

  static chip(parent: Node, name: string, title: string, value: string, x: number, y: number) {
    const width = Math.max(116, 42 + (title.length + value.length) * 23)
    const node = this.box(parent, name, width, 40, x, y)
    this.rounded(node, width, 40, 20, palette.cream, new Color(153, 185, 169, 255), 1)
    this.label(node, 'ValueLabel', `${title}  ${value}`, width - 14, 40, 22, palette.ink)
    return node
  }

  static progress(parent: Node, name: string, width: number, ratio: number, fill: Color, x = 0, y = 0) {
    const height = 12
    const node = this.box(parent, name, width, height, x, y)
    this.rounded(node, width, height, 6, palette.progressBg, new Color(140, 175, 157, 255), 1)
    const value = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0))
    if (value > 0) {
      const fillWidth = Math.max(height, width * value)
      const fillNode = this.box(node, 'ProgressFill', fillWidth, height - 2, -width / 2 + fillWidth / 2, 0)
      this.rounded(fillNode, fillWidth, height - 2, 5, fill, fill, 0)
    }
    return node
  }

  static qualityFrame(parent: Node, name: string, width: number, height: number, quality: UiQuality, x = 0, y = 0) {
    const node = this.box(parent, name, width, height, x, y)
    const tone = palette.quality[quality]
    this.rounded(node, width, height, 12, palette.cream, tone, 3)
    const inset = this.box(node, 'QualityInset', width - 8, height - 8, 0, 0)
    this.rounded(inset, width - 8, height - 8, 9, new Color(255, 255, 255, 0), tone, 1)
    return node
  }

  static navItem(parent: Node, name: string, glyph: string, title: string, active: boolean, x: number, y: number) {
    const width = 104
    const height = 82
    const node = this.box(parent, name, width, height, x, y)
    const fill = active ? new Color(220, 235, 227, 255) : palette.cream
    this.rounded(node, width, height, 12, fill, active ? palette.jadeLine : new Color(190, 207, 195, 255), 1)
    this.label(node, 'IconLabel', glyph, width, 42, 30, active ? palette.jade : palette.muted, 0, 12)
    this.label(node, 'TitleLabel', title, width, 28, 19, active ? palette.jadeDeep : palette.muted, 0, -22)
    if (active) {
      const marker = this.box(node, 'ActiveMarker', width - 22, 3, 0, -height / 2 + 3)
      this.rounded(marker, width - 22, 3, 2, palette.gold, palette.gold, 0)
    }
    return node
  }

  static label(parent: Node, name: string, value: string, width: number, height: number, fontSize: number, color: Color, x = 0, y = 0) {
    const node = this.box(parent, name, width, height, x, y)
    const label = node.addComponent(Label)
    label.string = value
    label.fontSize = fontSize
    label.lineHeight = fontSize + 8
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
