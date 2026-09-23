import { _decorator, Color, Component, Graphics, Label, Layers, Node, Prefab, ProgressBar, Sprite, UITransform, instantiate } from 'cc'
import { CultivationUiFactory as Ui } from './CultivationUiFactory'

const { ccclass, property } = _decorator
const UI_LAYER = Layers.Enum.UI_2D

@ccclass('UIShowcaseController')
export class UIShowcaseController extends Component {
  @property(Prefab)
  primaryButtonPrefab: Prefab | null = null

  @property(Prefab)
  panelFramePrefab: Prefab | null = null

  @property(Prefab)
  titleBarPrefab: Prefab | null = null

  @property(Prefab)
  resourceChipPrefab: Prefab | null = null

  @property(Prefab)
  progressBarPrefab: Prefab | null = null

  @property(Prefab)
  navItemPrefab: Prefab | null = null

  @property(Prefab)
  qualityFramePrefab: Prefab | null = null

  onLoad() {
    this.node.layer = UI_LAYER
    this.node.getComponent(UITransform)?.setContentSize(750, 1334)
    if (!this.hasAllPrefabs()) return
    this.buildGallery()
  }

  private hasAllPrefabs() {
    return Boolean(
      this.primaryButtonPrefab && this.panelFramePrefab && this.titleBarPrefab
      && this.resourceChipPrefab && this.progressBarPrefab && this.navItemPrefab && this.qualityFramePrefab,
    )
  }

  private placePrefab(parent: Node, prefab: Prefab, name: string, x: number, y: number) {
    const instance = instantiate(prefab)
    instance.name = name
    instance.layer = parent.layer
    instance.setPosition(x, y, 0)
    parent.addChild(instance)
    return instance
  }

  private resizePrefab(node: Node, width: number, height: number) {
    const rootTransform = node.getComponent(UITransform)
    if (!rootTransform) return
    const scaleX = width / rootTransform.contentSize.width
    const scaleY = height / rootTransform.contentSize.height
    rootTransform.setContentSize(width, height)
    const resizeChildren = (parent: Node) => {
      for (const child of parent.children) {
        const transform = child.getComponent(UITransform)
        if (transform) {
          transform.setContentSize(transform.contentSize.width * scaleX, transform.contentSize.height * scaleY)
        }
        resizeChildren(child)
      }
    }
    resizeChildren(node)
  }

  private setLabel(node: Node, childName: string, value: string) {
    const label = node.getChildByName(childName)?.getComponent(Label)
    if (label) label.string = value
  }

  private setSpriteColor(node: Node, childName: string | null, value: Color) {
    const target = childName ? node.getChildByName(childName) : node
    const sprite = target?.getComponent(Sprite)
    if (sprite) sprite.color = value
  }

  private buildGallery() {
    const root = this.node
    const text = (name: string, value: string, y: number, size: number, color = new Color(23, 54, 50, 255), width = 680) =>
      Ui.label(root, name, value, width, size + 12, size, color, 0, y)
    const section = (name: string, title: string, y: number) =>
      text(name, title, y, 23, new Color(36, 125, 112, 255), 690)

    const backdrop = Ui.box(root, 'GalleryBackdrop', 750, 1334)
    const bg = backdrop.addComponent(Graphics)
    bg.fillColor = new Color(237, 240, 231, 255)
    bg.rect(-375, -667, 750, 1334)
    bg.fill()
    backdrop.setSiblingIndex(0)

    text('GalleryEyebrow', 'UI FOUNDATION  ·  COMPONENT GALLERY', 612, 16, new Color(36, 125, 112, 255))
    text('GalleryTitle', '虚境试炼 · 修仙 UI 组件', 568, 36)

    section('ButtonSection', '操作按钮  /  Primary · Secondary · Quiet', 505)
    const primary = this.placePrefab(root, this.primaryButtonPrefab!, 'PrimaryButtonSample', -225, 447)
    this.setLabel(primary, 'Title', '继续破境')
    const secondary = this.placePrefab(root, this.primaryButtonPrefab!, 'SecondaryButtonSample', 0, 447)
    this.setSpriteColor(secondary, null, new Color(22, 78, 74, 255))
    this.setSpriteColor(secondary, 'Frame', new Color(119, 184, 165, 255))
    this.setLabel(secondary, 'Title', '查看详情')
    const quiet = this.placePrefab(root, this.primaryButtonPrefab!, 'QuietButtonSample', 225, 447)
    this.setSpriteColor(quiet, null, new Color(251, 250, 242, 255))
    this.setSpriteColor(quiet, 'Frame', new Color(168, 200, 186, 255))
    this.setLabel(quiet, 'Title', '稍后再说')
    this.setLabelColor(quiet, 'Title', new Color(22, 78, 74, 255))

    section('PanelSection', '玉简面板  /  PanelFrame · TitleBar', 410)
    const titleBar = this.placePrefab(root, this.titleBarPrefab!, 'TitleBarSample', 0, 360)
    this.setLabel(titleBar, 'Title', '青岚剑宗 · 试炼进度')
    const panel = this.placePrefab(root, this.panelFramePrefab!, 'PanelFrameSample', 0, 267)
    this.resizePrefab(panel, 690, 112)
    Ui.label(panel, 'PanelDescription', '雾竹林道 · 第三重', 620, 30, 19, new Color(91, 116, 106, 255), 0, 0)

    section('ResourceSection', '资源与进度  /  ResourceChip · ProgressBar', 192)
    const stone = this.placePrefab(root, this.resourceChipPrefab!, 'SpiritStoneChip', -220, 146)
    const pass = this.placePrefab(root, this.resourceChipPrefab!, 'DungeonPassChip', 0, 146)
    const essence = this.placePrefab(root, this.resourceChipPrefab!, 'ArtifactEssenceChip', 220, 146)
    this.setLabel(stone, 'Title', '灵石  2,685')
    this.setLabel(pass, 'Title', '副本卷  3')
    this.setLabel(essence, 'Title', '法宝精华  12')
    Ui.label(root, 'HealthLabel', '气血', 120, 26, 18, new Color(71, 99, 88, 255), -260, 91)
    const health = this.placePrefab(root, this.progressBarPrefab!, 'HealthProgressSample', 42, 91)
    health.getComponent(ProgressBar)!.progress = 0.72
    this.setSpriteColor(health, 'ProgressFill', new Color(82, 164, 117, 255))
    Ui.label(root, 'ManaLabel', '灵力', 120, 26, 18, new Color(71, 99, 88, 255), -260, 51)
    const mana = this.placePrefab(root, this.progressBarPrefab!, 'ManaProgressSample', 42, 51)
    mana.getComponent(ProgressBar)!.progress = 0.54
    this.setSpriteColor(mana, 'ProgressFill', new Color(83, 145, 181, 255))
    Ui.label(root, 'SoulLabel', '魂魄', 120, 26, 18, new Color(71, 99, 88, 255), -260, 11)
    const soul = this.placePrefab(root, this.progressBarPrefab!, 'SoulProgressSample', 42, 11)
    soul.getComponent(ProgressBar)!.progress = 0.66
    this.setSpriteColor(soul, 'ProgressFill', new Color(194, 151, 61, 255))

    section('QualitySection', '品质框  /  QualityFrame', -65)
    const qualities = [
      ['common', '凡品'], ['spirit', '灵品'], ['mystic', '玄品'],
      ['earth', '地品'], ['heaven', '天品'], ['immortal', '仙品'],
    ] as const
    qualities.forEach(([quality, title], index) => {
      const x = -285 + index * 114
      const frame = this.placePrefab(root, this.qualityFramePrefab!, `${title}QualityFrame`, x, -125)
      this.resizePrefab(frame, 100, 70)
      this.setSpriteColor(frame, 'Frame', this.qualityColor(quality))
      this.setLabel(frame, 'Title', title)
    })

    section('StatusSection', '角色状态  /  HeroStatus', -197)
    const hero = this.placePrefab(root, this.panelFramePrefab!, 'HeroStatusSample', 0, -260)
    this.resizePrefab(hero, 690, 84)
    const portrait = Ui.panel(hero, 'PortraitBadge', 54, 54, { x: -298, fill: new Color(36, 104, 91, 255), border: new Color(197, 154, 61, 255), radius: 12 })
    Ui.label(portrait, 'PortraitGlyph', '剑', 48, 48, 27, new Color(240, 217, 140, 255))
    Ui.label(hero, 'RealmLabel', '筑基三重', 210, 30, 24, new Color(23, 54, 50, 255), -138, 14)
    Ui.label(hero, 'HeroNameLabel', '青岚剑修 · 气血充盈 · 灵力 24', 420, 28, 17, new Color(91, 116, 106, 255), 66, -18)

    section('StageSection', '关卡条目  /  StageCard', -324)
    const stage = this.placePrefab(root, this.panelFramePrefab!, 'StageCardSample', 0, -385)
    this.resizePrefab(stage, 690, 82)
    this.setSpriteColor(stage, 'Frame', new Color(193, 164, 91, 255))
    Ui.label(stage, 'StageTitle', '雾竹林道', 280, 32, 24, new Color(23, 54, 50, 255), -160, 13)
    Ui.label(stage, 'StageDescription', '击败守关 Boss 后可前往下一境', 430, 26, 17, new Color(91, 116, 106, 255), -80, -17)
    const stageBadge = this.placePrefab(stage, this.primaryButtonPrefab!, 'StageNumberBadge', 255, 0)
    this.resizePrefab(stageBadge, 120, 44)
    this.setLabel(stageBadge, 'Title', '第 12 关')

    section('NavigationSection', '底部导航  /  NavItem', -454)
    const navItems = [['剑', '战斗'], ['境', '副本'], ['印', '抽卡'], ['器', '装备'], ['囊', '背包'], ['宝', '法宝']]
    navItems.forEach(([glyph, title], index) => {
      const item = this.placePrefab(root, this.navItemPrefab!, `NavItem${index + 1}`, -285 + index * 114, -555)
      this.setLabel(item, 'Icon', glyph)
      this.setLabel(item, 'Subtitle', title)
      if (index !== 0) this.setSpriteColor(item, null, new Color(251, 250, 242, 255))
    })
  }

  private setLabelColor(node: Node, childName: string, color: Color) {
    const label = node.getChildByName(childName)?.getComponent(Label)
    if (label) label.color = color
  }

  private qualityColor(quality: string) {
    const colors: Record<string, Color> = {
      common: new Color(145, 157, 151, 255),
      spirit: new Color(99, 185, 141, 255),
      mystic: new Color(93, 168, 216, 255),
      earth: new Color(161, 123, 210, 255),
      heaven: new Color(215, 174, 85, 255),
      immortal: new Color(231, 140, 98, 255),
    }
    return colors[quality] ?? colors.common
  }
}
