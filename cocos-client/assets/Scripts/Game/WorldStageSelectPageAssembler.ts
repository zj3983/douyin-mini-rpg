import {
  Button,
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Layers,
  Mask,
  Node,
  ScrollView,
  UITransform,
  VerticalTextAlignment,
} from 'cc'
import { WorldStageSelectController } from './WorldStageSelectController'
import {
  computeWorldStageSelectLayout,
  type WorldStageSelectLayout,
  type WorldStageSelectLayoutInput,
} from './WorldStageSelectLayout.ts'
import type { WorldEncounterKind } from '../Core/World/WorldRegion.ts'

const UI_LAYER = Layers.Enum.UI_2D

export interface WorldStageSelectDisplayEntry {
  readonly id: number
  readonly name: string
  readonly encounter: WorldEncounterKind
}

export interface WorldStageSelectPageOptions {
  readonly parent: Node
  readonly battleRoot: Node
  readonly entryNode: Node
  readonly metrics: WorldStageSelectLayoutInput
  readonly getHighestClearedWorldStage: () => number
  readonly advanceToStage: (stageId: number) => { readonly ok?: boolean } | null | undefined
}

export interface WorldStageSelectPage {
  readonly root: Node
  bind(stages: readonly WorldStageSelectDisplayEntry[]): void
  open(): void
  close(): void
  relayout(metrics: WorldStageSelectLayoutInput): void
  destroy(): void
}

interface ItemParts {
  readonly root: Node
  readonly button: Button
  readonly title: Label
  readonly badgeRoot: Node
  readonly badge: Label
  readonly lock: Label
  readonly click: () => void
  selectable: boolean
}

function createNode(name: string, parent: Node, width = 0, height = 0): Node {
  const node = new Node(name)
  node.layer = UI_LAYER
  node.parent = parent
  const transform = node.addComponent(UITransform)
  transform.setContentSize(width, height)
  return node
}

function createLabel(name: string, parent: Node, text = ''): Label {
  const node = createNode(name, parent)
  const label = node.addComponent(Label)
  label.string = text
  label.horizontalAlign = HorizontalTextAlignment.CENTER
  label.verticalAlign = VerticalTextAlignment.CENTER
  label.overflow = Label.Overflow.SHRINK
  return label
}

function drawPanel(node: Node, width: number, height: number, fill: Color, border: Color, radius: number): void {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics)
  graphics.clear()
  graphics.fillColor = fill
  graphics.roundRect(-width / 2, -height / 2, width, height, radius)
  graphics.fill()
  graphics.strokeColor = border
  graphics.lineWidth = Math.max(1, radius / 3)
  graphics.roundRect(-width / 2, -height / 2, width, height, radius)
  graphics.stroke()
}

class RuntimeWorldStageSelectPage implements WorldStageSelectPage {
  readonly root: Node
  private readonly options: WorldStageSelectPageOptions
  private readonly battleRoot: Node
  private readonly header: Node
  private readonly title: Label
  private readonly subtitle: Label
  private readonly closeNode: Node
  private readonly closeIcon: Label
  private readonly scrollNode: Node
  private readonly viewport: Node
  private readonly content: Node
  private readonly grid: Node
  private readonly status: Label
  private readonly controller: WorldStageSelectController
  private readonly items: ItemParts[]
  private stages: readonly WorldStageSelectDisplayEntry[] = []
  private layout: WorldStageSelectLayout
  private destroyed = false

  constructor(options: WorldStageSelectPageOptions) {
    this.options = options
    this.battleRoot = options.battleRoot
    this.layout = computeWorldStageSelectLayout(options.metrics)
    this.root = createNode('WorldStageSelectRoot', options.parent)
    this.controller = this.root.addComponent(WorldStageSelectController)
    this.header = createNode('WorldStageHeader', this.root)
    this.title = createLabel('WorldStageTitle', this.header, '云卷路引')
    this.subtitle = createLabel('WorldStageSubtitle', this.header, '十境行程')
    this.closeNode = createNode('WorldStageCloseButton', this.header)
    this.closeNode.addComponent(Button)
    this.closeIcon = createLabel('WorldStageCloseIcon', this.closeNode, '×')

    this.scrollNode = createNode('WorldStageScrollView', this.root)
    const scrollView = this.scrollNode.addComponent(ScrollView)
    scrollView.horizontal = false
    scrollView.vertical = true
    scrollView.elastic = false
    scrollView.inertia = true
    this.viewport = createNode('WorldStageViewport', this.scrollNode)
    const mask = this.viewport.addComponent(Mask)
    mask.type = Mask.Type.GRAPHICS_RECT
    this.content = createNode('WorldStageContent', this.viewport)
    this.grid = createNode('WorldStageGrid', this.content)
    scrollView.content = this.content

    this.items = Array.from({ length: 10 }, (_, index) => {
      const stageId = index + 1
      const root = createNode(`WorldStageItem${stageId}`, this.grid)
      const button = root.addComponent(Button)
      button.interactable = false
      const title = createLabel(`WorldStageItem${stageId}Label`, root)
      title.horizontalAlign = HorizontalTextAlignment.LEFT
      const badgeRoot = createNode(`WorldStageItem${stageId}BadgeRoot`, root)
      badgeRoot.addComponent(Graphics)
      const badge = createLabel(`WorldStageItem${stageId}BadgeLabel`, badgeRoot)
      const lock = createLabel(`WorldStageItem${stageId}Lock`, root)
      const click = () => {
        this.controller.select(stageId)
      }
      root.on(Button.EventType.CLICK, click, this)
      return { root, button, title, badgeRoot, badge, lock, click, selectable: false }
    })
    this.status = createLabel('WorldStageStatusLabel', this.root)
    this.status.color = new Color(213, 164, 91, 255)

    this.root.on('world-stage-selected', this.onSelected, this)
    this.root.on('world-stage-selection-rejected', this.onRejected, this)
    options.entryNode.on(Button.EventType.CLICK, this.open, this)
    this.closeNode.on(Button.EventType.CLICK, this.close, this)
    this.relayout(options.metrics)
    this.root.active = false
  }

  bind(stages: readonly WorldStageSelectDisplayEntry[]): void {
    if (this.destroyed) return
    this.stages = stages
    this.controller.bind(
      stages,
      this.options.getHighestClearedWorldStage(),
      this.items.map((item) => item.button),
      this.items.map((item) => item.title),
      this.items.map((item) => item.badge),
      this.items.map((item) => item.lock),
    )
    this.items.forEach((item, index) => {
      item.selectable = item.button.interactable === true
      item.button.interactable = stages[index] !== undefined
    })
    this.styleItems()
  }

  open = (): void => {
    if (this.destroyed) return
    this.bind(this.stages)
    this.status.string = this.stages.length === 10 ? '' : '路引载入中'
    this.battleRoot.active = false
    this.root.active = true
  }

  close = (): void => {
    if (this.destroyed) return
    this.root.active = false
    this.battleRoot.active = true
  }

  relayout(metrics: WorldStageSelectLayoutInput): void {
    if (this.destroyed) return
    const page = computeWorldStageSelectLayout(metrics)
    this.layout = page
    const px = (value: number) => value / page.physicalScale
    const rootTransform = this.root.getComponent(UITransform)
    rootTransform?.setContentSize(page.width, page.height)
    drawPanel(this.root, page.width, page.height, new Color(8, 21, 23, 255), new Color(8, 21, 23, 255), 0)

    this.header.getComponent(UITransform)?.setContentSize(page.header.width, page.header.height)
    this.header.setPosition(page.header.centerX, page.header.centerY, 0)
    drawPanel(this.header, page.header.width, page.header.height, new Color(13, 31, 32, 255), new Color(45, 70, 67, 255), px(6))
    this.configureLabel(this.title, page.header.width - px(80), px(34), px(24))
    this.title.horizontalAlign = HorizontalTextAlignment.LEFT
    this.title.node.setPosition(-px(28), px(10), 0)
    this.title.color = new Color(226, 215, 174, 255)
    this.configureLabel(this.subtitle, page.header.width - px(80), px(24), px(15))
    this.subtitle.horizontalAlign = HorizontalTextAlignment.LEFT
    this.subtitle.node.setPosition(-px(28), -px(20), 0)
    this.subtitle.color = new Color(125, 158, 151, 255)

    this.closeNode.getComponent(UITransform)?.setContentSize(page.closeButton.width, page.closeButton.height)
    this.closeNode.setPosition(
      page.closeButton.centerX - page.header.centerX,
      page.closeButton.centerY - page.header.centerY,
      0,
    )
    drawPanel(this.closeNode, page.closeButton.width, page.closeButton.height, new Color(17, 38, 39, 255), new Color(67, 96, 91, 255), px(6))
    this.configureLabel(this.closeIcon, page.closeButton.width, page.closeButton.height, px(28))
    this.closeIcon.color = new Color(201, 214, 207, 255)

    this.scrollNode.getComponent(UITransform)?.setContentSize(page.scrollView.width, page.scrollView.height)
    this.scrollNode.setPosition(page.scrollView.centerX, page.scrollView.centerY, 0)
    this.viewport.getComponent(UITransform)?.setContentSize(page.viewport.width, page.viewport.height)
    this.viewport.setPosition(0, 0, 0)
    const contentHeight = Math.max(page.content.height, page.viewport.height)
    const contentTransform = this.content.getComponent(UITransform)
    contentTransform?.setContentSize(page.content.width, contentHeight)
    contentTransform?.setAnchorPoint(0.5, 1)
    this.content.setPosition(0, page.viewport.height / 2, 0)
    const gridTransform = this.grid.getComponent(UITransform)
    gridTransform?.setContentSize(page.grid.width, page.grid.height)
    gridTransform?.setAnchorPoint(0.5, 1)
    this.grid.setPosition(0, 0, 0)

    page.items.forEach((itemLayout, index) => {
      const item = this.items[index]
      item.root.getComponent(UITransform)?.setContentSize(itemLayout.width, itemLayout.height)
      item.root.setPosition(itemLayout.centerX, itemLayout.centerY, 0)
      const titleCenterX = -itemLayout.width / 2 + px(10) + page.itemTitleWidth / 2
      const badgeCenterX = itemLayout.width / 2 - px(10) - page.badgeWidth / 2
      this.configureLabel(item.title, page.itemTitleWidth, px(42), px(18))
      item.title.node.setPosition(titleCenterX, 0, 0)
      item.badgeRoot.getComponent(UITransform)?.setContentSize(page.badgeWidth, px(24))
      item.badgeRoot.setPosition(badgeCenterX, px(16), 0)
      this.configureLabel(item.badge, page.badgeWidth, px(24), px(13))
      item.badge.node.setPosition(0, 0, 0)
      this.configureLabel(item.lock, page.badgeWidth, px(22), px(12))
      item.lock.node.setPosition(badgeCenterX, -px(17), 0)
      item.lock.color = new Color(131, 148, 141, 255)
    })
    this.configureLabel(this.status, page.status.width, page.status.height, px(14))
    this.status.node.setPosition(page.status.centerX, page.status.centerY, 0)
    this.styleItems()
  }

  destroy(): void {
    if (this.destroyed) return
    this.root.off('world-stage-selected', this.onSelected, this)
    this.root.off('world-stage-selection-rejected', this.onRejected, this)
    this.options.entryNode.off(Button.EventType.CLICK, this.open, this)
    this.closeNode.off(Button.EventType.CLICK, this.close, this)
    this.items.forEach((item) => item.root.off(Button.EventType.CLICK, item.click, this))
    this.destroyed = true
  }

  private configureLabel(label: Label, width: number, height: number, fontSize: number): void {
    label.node.getComponent(UITransform)?.setContentSize(width, height)
    label.fontSize = fontSize
    label.lineHeight = height
  }

  private styleItems(): void {
    const page = this.layout
    this.items.forEach((item, index) => {
      const stage = this.stages[index]
      const interactable = item.selectable
      const encounter = stage?.encounter ?? 'normal'
      const fill = interactable ? new Color(20, 43, 44, 255) : new Color(13, 29, 30, 255)
      const border = encounter === 'region-boss'
        ? new Color(190, 151, 70, interactable ? 255 : 140)
        : encounter === 'elite'
          ? new Color(104, 157, 143, interactable ? 255 : 140)
          : new Color(55, 82, 78, interactable ? 255 : 125)
      const transform = item.root.getComponent(UITransform)
      drawPanel(item.root, transform?.width ?? 0, transform?.height ?? page.itemHeight, fill, border, page.itemCornerRadius)
      item.title.color = interactable ? new Color(224, 232, 224, 255) : new Color(111, 129, 124, 255)
      item.badge.color = encounter === 'region-boss'
        ? new Color(238, 202, 114, interactable ? 255 : 150)
        : new Color(150, 203, 188, interactable ? 255 : 150)
      const badgeTransform = item.badgeRoot.getComponent(UITransform)
      if (encounter === 'normal') item.badgeRoot.getComponent(Graphics)?.clear()
      else drawPanel(
        item.badgeRoot,
        badgeTransform?.width ?? page.badgeWidth,
        badgeTransform?.height ?? 0,
        new Color(15, 34, 34, 210),
        border,
        page.itemCornerRadius,
      )
    })
  }

  private onSelected(payload: unknown): void {
    const stageId = (payload as { stageId?: unknown } | null)?.stageId
    if (typeof stageId !== 'number' || !Number.isInteger(stageId)) {
      this.status.string = '关卡信息无效'
      return
    }
    const result = this.options.advanceToStage(stageId)
    if (result?.ok) this.close()
    else this.status.string = '当前关卡暂不可进入'
  }

  private onRejected(payload: unknown): void {
    const reason = (payload as { reason?: unknown } | null)?.reason
    this.status.string = reason === 'locked-stage' ? '此关尚未解锁' : '关卡信息无效'
  }
}

export function buildWorldStageSelectPage(options: WorldStageSelectPageOptions): WorldStageSelectPage {
  return new RuntimeWorldStageSelectPage(options)
}
