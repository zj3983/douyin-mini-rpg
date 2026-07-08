import { _decorator, Component, Label } from 'cc'
import { applyLevelUp, artifactMutationOptions, dungeonClearReward, realmName } from '../Core/CultivationRules'
import { HeroStats } from '../Core/CultivationTypes'

const { ccclass, property } = _decorator

@ccclass('BattleSceneController')
export class BattleSceneController extends Component {
  @property(Label)
  public statusLabel: Label | null = null

  private hero: HeroStats = {
    level: 1,
    realm: realmName(1),
    attack: 24,
    health: 160,
    mana: 12,
  }

  start() {
    this.refreshStatus()
  }

  public debugLevelUp() {
    this.hero = applyLevelUp(this.hero)
    this.refreshStatus()
  }

  public previewFlyingSwordMutation() {
    return artifactMutationOptions('flyingSword', 6)
  }

  public previewDungeonReward() {
    return dungeonClearReward(5, true, 'flyingSword')
  }

  private refreshStatus() {
    if (!this.statusLabel) return
    this.statusLabel.string = `${this.hero.realm} | 攻击 ${this.hero.attack} | 生命 ${this.hero.health} | 法力 ${this.hero.mana}`
  }
}
