import { _decorator, Component, JsonAsset, Label } from 'cc'
import {
  AssetCatalogData,
  findArtifact,
  findCharacter,
  monstersForTheme,
  skillsForCharacter,
} from '../Core/AssetCatalog'

const { ccclass, property } = _decorator

@ccclass('AssetBindingController')
export class AssetBindingController extends Component {
  @property(JsonAsset)
  assetCatalog: JsonAsset | null = null

  @property(Label)
  debugLabel: Label | null = null

  selectedCharacterId = 'qinglan-sword-cultivator'
  selectedTheme = 'mist-bamboo'

  start() {
    this.previewBindings()
  }

  previewBindings() {
    if (!this.assetCatalog) return

    const catalog = this.assetCatalog.json as AssetCatalogData
    const character = findCharacter(catalog, this.selectedCharacterId)
    const skill = skillsForCharacter(catalog, character.id)[0]
    const artifact = findArtifact(catalog, character.startingArtifact)
    const monsters = monstersForTheme(catalog, this.selectedTheme)

    if (this.debugLabel) {
      this.debugLabel.string = `${character.name} / ${skill.name} / ${artifact.name} / 怪物${monsters.length}`
    }
  }
}
