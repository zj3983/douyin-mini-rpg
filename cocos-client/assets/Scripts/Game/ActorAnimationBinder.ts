import { _decorator, Component, JsonAsset, Texture2D, resources } from 'cc'
import { AssetCatalogData, findCharacter, monstersForTheme } from '../Core/AssetCatalog'
import { resourcePathForPng } from '../Core/StripAnimationRuntime'
import { StripAnimator } from './StripAnimator'

const { ccclass, property } = _decorator

type CharacterMotion = 'idle' | 'move' | 'cast' | 'hurt'
type MonsterMotion = 'idle' | 'move' | 'attack' | 'hurt' | 'death'

@ccclass('ActorAnimationBinder')
export class ActorAnimationBinder extends Component {
  @property(JsonAsset)
  assetCatalog: JsonAsset | null = null

  @property(StripAnimator)
  animator: StripAnimator | null = null

  selectedCharacterId = 'qinglan-sword-cultivator'
  selectedMonsterTheme = 'mist-bamboo'
  selectedMonsterIndex = 0

  playCharacter(motion: CharacterMotion) {
    const catalog = this.assetCatalog?.json as AssetCatalogData | undefined
    if (!catalog || !this.animator) return

    const character = findCharacter(catalog, this.selectedCharacterId)
    this.loadStrip(character.motionFrames[motion])
  }

  playMonster(motion: MonsterMotion) {
    const catalog = this.assetCatalog?.json as AssetCatalogData | undefined
    if (!catalog || !this.animator) return

    const monsters = monstersForTheme(catalog, this.selectedMonsterTheme)
    const monster = monsters[this.selectedMonsterIndex % monsters.length]
    this.loadStrip(monster.motionFrames[motion])
  }

  private loadStrip(assetPath: string) {
    const resourcePath = resourcePathForPng(assetPath)
    resources.load(resourcePath, Texture2D, (error, texture) => {
      if (error || !texture || !this.animator) return
      this.animator.play(texture, 4, 8)
    })
  }
}
