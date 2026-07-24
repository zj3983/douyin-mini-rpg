import { _decorator, Component, Node, sys } from 'cc'
import type { RunLoot } from '../Core/Dungeon/DungeonTypes.ts'
import {
  applyExtractionLoot,
  consumeDungeonPass,
  createDefaultSave,
  migratePlayerSave,
} from '../Core/Progression/PlayerSave.ts'
import type { PlayerSaveV3 } from '../Core/Progression/PlayerSave.ts'
import { createJsonSaveRepository } from '../Core/Progression/SaveRepository.ts'
import type { SaveRepository } from '../Core/Progression/SaveRepository.ts'
import { applyWorldBossClear } from '../Core/World/WorldRewards.ts'
import { DungeonRunController } from './DungeonRunController'

const { ccclass, property } = _decorator
const DEFAULT_DUNGEON_SEED = 0
const MAX_UINT32 = 4294967295

@ccclass('DualModeGameController')
export class DualModeGameController extends Component {
  @property(Node)
  worldRoot: Node | null = null

  @property(Node)
  dungeonRoot: Node | null = null

  @property(DungeonRunController)
  dungeonRun: DungeonRunController | null = null

  private save: PlayerSaveV3 = createDefaultSave()
  private repository: SaveRepository | null = null

  onLoad() {
    this.repository = createJsonSaveRepository(sys.localStorage, 'cultivation-save-v3')
    this.save = this.repository.load() ?? createDefaultSave()
  }

  handleWorldCleared(payload: { stage: number; rewardId: string }) {
    const previous = this.save
    const next = applyWorldBossClear(previous, payload).save
    if (!this.didAcceptReward(previous, next)) return false
    this.persistSave(next)
    return true
  }

  enterDungeon(seed = DEFAULT_DUNGEON_SEED) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_UINT32) {
      return this.rejectDungeonEntry('invalid-seed')
    }

    const passResult = consumeDungeonPass(this.save)
    if (!passResult.ok) return this.rejectDungeonEntry('missing-pass')
    if (!this.dungeonRun) return this.rejectDungeonEntry('missing-dungeon-controller')
    if (!this.dungeonRun.begin(seed)) return this.rejectDungeonEntry('dungeon-begin-failed')

    this.persistSave(passResult.save)
    if (this.worldRoot) this.worldRoot.active = false
    if (this.dungeonRoot) this.dungeonRoot.active = true
    this.node.emit('dungeon-entry-accepted', { seed })
    return true
  }

  handleDungeonExtracted(payload: { runId: string; loot: RunLoot[] }) {
    const previous = this.save
    const next = applyExtractionLoot(previous, payload.runId, payload.loot)
    if (!this.didAcceptReward(previous, next)) return false

    this.persistSave(next)
    if (this.dungeonRoot) this.dungeonRoot.active = false
    if (this.worldRoot) this.worldRoot.active = true
    return true
  }

  getSaveSnapshot() {
    return migratePlayerSave(this.save)
  }

  private didAcceptReward(previous: PlayerSaveV3, next: PlayerSaveV3) {
    return next.rewardLedger.length > previous.rewardLedger.length
  }

  private persistSave(next: PlayerSaveV3) {
    this.save = next
    this.repository?.save(next)
    this.node.emit('player-save-changed', this.getSaveSnapshot())
  }

  private rejectDungeonEntry(reason: string) {
    this.node.emit('dungeon-entry-rejected', { reason })
    return false
  }
}
