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
    const resolution = Ui.tokens.designResolution
    this.node.getComponent(UITransform)?.setContentSize(resolution.width, resolution.height)
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
    const { designResolution, color, gallery, typeSize, component, space } = Ui.tokens
    const layout = gallery.layout
    const sizes = gallery.sampleSize
    const tokenColor = (name: string) => Ui.color(color[name as keyof typeof color] as string)
    const text = (name: string, value: string, y: number, size: number, tint = tokenColor('ink'), width = designResolution.width - space.xl * 2) =>
      Ui.label(root, name, value, width, size + space.sm, size, tint, 0, y)
    const section = (name: string, title: string, y: number) =>
      text(name, title, y, typeSize.section, tokenColor('jadePrimary'), designResolution.width - space.xl * 2)

    const backdrop = Ui.box(root, 'GalleryBackdrop', designResolution.width, designResolution.height)
    const bg = backdrop.addComponent(Graphics)
    bg.fillColor = tokenColor('galleryBackdrop')
    bg.rect(-designResolution.width / 2, -designResolution.height / 2, designResolution.width, designResolution.height)
    bg.fill()
    backdrop.setSiblingIndex(0)

    text('GalleryEyebrow', 'UI FOUNDATION  ·  COMPONENT GALLERY', layout.eyebrowY, typeSize.caption, tokenColor('jadePrimary'))
    text('GalleryTitle', '虚境试炼 · 修仙 UI 组件', layout.titleY, typeSize.title)

    section('ButtonSection', '操作按钮  /  Primary · Secondary · Quiet', layout.sectionY.buttons)
    const primary = this.placePrefab(root, this.primaryButtonPrefab!, 'PrimaryButtonSample', layout.buttons.x[0], layout.buttons.y)
    this.setLabel(primary, 'Title', '继续破境')
    const secondary = this.placePrefab(root, this.primaryButtonPrefab!, 'SecondaryButtonSample', layout.buttons.x[1], layout.buttons.y)
    this.setSpriteColor(secondary, null, tokenColor(component.titleBar.fill))
    this.setSpriteColor(secondary, 'Frame', tokenColor(component.panelFrame.border))
    this.setLabel(secondary, 'Title', '查看详情')
    const quiet = this.placePrefab(root, this.primaryButtonPrefab!, 'QuietButtonSample', layout.buttons.x[2], layout.buttons.y)
    this.setSpriteColor(quiet, null, tokenColor(component.resourceChip.fill))
    this.setSpriteColor(quiet, 'Frame', tokenColor('softBorder'))
    this.setLabel(quiet, 'Title', '稍后再说')
    this.setLabelColor(quiet, 'Title', tokenColor(component.titleBar.fill))

    section('PanelSection', '玉简面板  /  PanelFrame · TitleBar', layout.sectionY.panel)
    const titleBar = this.placePrefab(root, this.titleBarPrefab!, 'TitleBarSample', 0, layout.titleBarY)
    this.setLabel(titleBar, 'Title', '青岚剑宗 · 试炼进度')
    const panel = this.placePrefab(root, this.panelFramePrefab!, 'PanelFrameSample', 0, layout.panelY)
    this.resizePrefab(panel, sizes.panel.width, sizes.panel.height)
    Ui.label(panel, 'PanelDescription', '雾竹林道 · 第三重', component.panelFrame.width, space.lg, typeSize.body, tokenColor('muted'), 0, 0)

    section('ResourceSection', '资源与进度  /  ResourceChip · ProgressBar', layout.sectionY.resources)
    const stone = this.placePrefab(root, this.resourceChipPrefab!, 'SpiritStoneChip', layout.resources.x[0], layout.resources.y)
    const pass = this.placePrefab(root, this.resourceChipPrefab!, 'DungeonPassChip', layout.resources.x[1], layout.resources.y)
    const essence = this.placePrefab(root, this.resourceChipPrefab!, 'ArtifactEssenceChip', layout.resources.x[2], layout.resources.y)
    this.setLabel(stone, 'Title', '灵石  2,685')
    this.setLabel(pass, 'Title', '副本卷  3')
    this.setLabel(essence, 'Title', '法宝精华  12')
    Ui.label(root, 'HealthLabel', '气血', sizes.progressLabel.width, sizes.progressLabel.height, sizes.progressLabelFontSize, tokenColor('muted'), layout.progress.labelX, layout.progress.y[0])
    const health = this.placePrefab(root, this.progressBarPrefab!, 'HealthProgressSample', layout.progress.x, layout.progress.y[0])
    health.getComponent(ProgressBar)!.progress = 0.72
    this.setSpriteColor(health, 'ProgressFill', tokenColor('progressHealth'))
    Ui.label(root, 'ManaLabel', '灵力', sizes.progressLabel.width, sizes.progressLabel.height, sizes.progressLabelFontSize, tokenColor('muted'), layout.progress.labelX, layout.progress.y[1])
    const mana = this.placePrefab(root, this.progressBarPrefab!, 'ManaProgressSample', layout.progress.x, layout.progress.y[1])
    mana.getComponent(ProgressBar)!.progress = 0.54
    this.setSpriteColor(mana, 'ProgressFill', tokenColor('progressMana'))
    Ui.label(root, 'SoulLabel', '魂魄', sizes.progressLabel.width, sizes.progressLabel.height, sizes.progressLabelFontSize, tokenColor('muted'), layout.progress.labelX, layout.progress.y[2])
    const soul = this.placePrefab(root, this.progressBarPrefab!, 'SoulProgressSample', layout.progress.x, layout.progress.y[2])
    soul.getComponent(ProgressBar)!.progress = 0.66
    this.setSpriteColor(soul, 'ProgressFill', tokenColor('progressSoul'))

    section('QualitySection', '品质框  /  QualityFrame', layout.sectionY.qualities)
    const qualities = [
      ['common', '凡品'], ['spirit', '灵品'], ['mystic', '玄品'],
      ['earth', '地品'], ['heaven', '天品'], ['immortal', '仙品'],
    ] as const
    qualities.forEach(([quality, title], index) => {
      const x = layout.qualityX.firstX + index * layout.qualityX.stepX
      const frame = this.placePrefab(root, this.qualityFramePrefab!, `${title}QualityFrame`, x, layout.qualityY)
      this.resizePrefab(frame, sizes.quality.width, sizes.quality.height)
      this.setSpriteColor(frame, 'Frame', tokenColor(color.quality[quality]))
      this.setLabel(frame, 'Title', title)
    })

    section('StatusSection', '角色状态  /  HeroStatus', layout.sectionY.hero)
    const hero = this.placePrefab(root, this.panelFramePrefab!, 'HeroStatusSample', 0, layout.heroY)
    this.resizePrefab(hero, sizes.hero.width, sizes.hero.height)
    const portrait = Ui.panel(hero, 'PortraitBadge', sizes.portrait.width, sizes.portrait.height, { x: sizes.portrait.x, fill: tokenColor('portraitFill'), border: tokenColor('portraitBorder'), radius: component.navItem.radius })
    Ui.label(portrait, 'PortraitGlyph', '剑', component.navItem.iconWidth, component.navItem.iconHeight, typeSize.icon, tokenColor('goldHighlight'))
    Ui.label(hero, 'RealmLabel', '筑基三重', component.primaryButton.width - space.xl * 2, space.lg, typeSize.label, tokenColor('ink'), layout.heroLabels.realmX, layout.heroLabels.realmY)
    Ui.label(hero, 'HeroNameLabel', '青岚剑修 · 气血充盈 · 灵力 24', component.panelFrame.width - space.xl * 2, typeSize.caption + space.sm, typeSize.caption, tokenColor('muted'), layout.heroLabels.descriptionX, layout.heroLabels.descriptionY)

    section('StageSection', '关卡条目  /  StageCard', layout.sectionY.stage)
    const stage = this.placePrefab(root, this.panelFramePrefab!, 'StageCardSample', 0, layout.stageY)
    this.resizePrefab(stage, sizes.stage.width, sizes.stage.height)
    this.setSpriteColor(stage, 'Frame', tokenColor('stageBorder'))
    Ui.label(stage, 'StageTitle', '雾竹林道', component.panelFrame.width - space.xl * 2, typeSize.label + space.sm, typeSize.label, tokenColor('ink'), layout.stageLabels.titleX, layout.stageLabels.titleY)
    Ui.label(stage, 'StageDescription', '击败守关 Boss 后可前往下一境', component.panelFrame.width - space.xl * 2, typeSize.caption + space.sm, typeSize.caption, tokenColor('muted'), layout.stageLabels.descriptionX, layout.stageLabels.descriptionY)
    const stageBadge = this.placePrefab(stage, this.primaryButtonPrefab!, 'StageNumberBadge', layout.stageLabels.badgeX, 0)
    this.resizePrefab(stageBadge, sizes.stageBadge.width, sizes.stageBadge.height)
    this.setLabel(stageBadge, 'Title', '第 12 关')

    section('NavigationSection', '底部导航  /  NavItem', layout.sectionY.navigation)
    const navItems = [['剑', '战斗'], ['境', '副本'], ['印', '抽卡'], ['器', '装备'], ['囊', '背包'], ['宝', '法宝']]
    navItems.forEach(([glyph, title], index) => {
      const item = this.placePrefab(root, this.navItemPrefab!, `NavItem${index + 1}`, layout.navigation.firstX + index * layout.navigation.stepX, layout.navigation.y)
      this.setLabel(item, 'Icon', glyph)
      this.setLabel(item, 'Subtitle', title)
      if (index !== 0) this.setSpriteColor(item, null, tokenColor('cream'))
    })
  }

  private setLabelColor(node: Node, childName: string, color: Color) {
    const label = node.getChildByName(childName)?.getComponent(Label)
    if (label) label.color = color
  }

}
