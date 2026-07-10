import { _decorator, Component, Label, Node, ProgressBar } from 'cc'
import { normalizeSoulHudCount } from '../Core/BattleRuntime'

const { ccclass, property } = _decorator

export interface HeroHudState {
  realm: string
  health: number
  maxHealth: number
  mana: number
  maxMana: number
}

@ccclass('BattleHudController')
export class BattleHudController extends Component {
  @property(Label)
  realmLabel: Label | null = null

  @property(Label)
  stageLabel: Label | null = null

  @property(ProgressBar)
  healthBar: ProgressBar | null = null

  @property(ProgressBar)
  manaBar: ProgressBar | null = null

  @property(ProgressBar)
  soulBar: ProgressBar | null = null

  @property(Label)
  soulLabel: Label | null = null

  @property(Node)
  bossRoot: Node | null = null

  @property(Label)
  bossNameLabel: Label | null = null

  @property(ProgressBar)
  bossHealthBar: ProgressBar | null = null

  updateHero({ realm, health, maxHealth, mana, maxMana }: HeroHudState) {
    if (this.realmLabel) this.realmLabel.string = realm
    this.setProgress(this.healthBar, health, maxHealth)
    this.setProgress(this.manaBar, mana, maxMana)
  }

  updateStage(stageName: string, stageNumber: number) {
    if (this.stageLabel) this.stageLabel.string = `第${stageNumber}关 ${stageName}`
  }

  updateSoul(current: number, required: number) {
    const display = normalizeSoulHudCount(current, required)
    this.setProgress(this.soulBar, display.current, display.required)
    if (this.soulLabel) this.soulLabel.string = `魂 ${display.current}/${display.required}`
  }

  showBoss(name: string, current: number, max: number) {
    if (this.bossRoot) this.bossRoot.active = true
    if (this.bossNameLabel) this.bossNameLabel.string = name
    this.setProgress(this.bossHealthBar, current, max)
  }

  hideBoss() {
    const { bossRoot } = this
    if (bossRoot) bossRoot.active = false
  }

  private setProgress(bar: ProgressBar | null, current: number, max: number) {
    if (!bar) return
    const ratio = max > 0 && Number.isFinite(current) && Number.isFinite(max) ? current / max : 0
    const progress = Math.min(1, Math.max(0, ratio))
    bar.progress = progress
    if (bar.barSprite) bar.barSprite.node.setScale(progress, 1, 1)
  }
}
