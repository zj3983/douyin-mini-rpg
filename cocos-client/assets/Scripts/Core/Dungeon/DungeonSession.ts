import type {
  DungeonExit,
  DungeonProfile,
  DungeonRoom,
  DungeonRoomKind,
  DungeonRun,
  RunLoot,
} from './DungeonTypes.ts'

const MAX_UINT32 = 4294967295
const DUNGEON_ROOM_KINDS = new Set<DungeonRoomKind>([
  'entry',
  'combat',
  'treasure',
  'alchemy',
  'mechanism',
  'elite',
  'boss',
  'extraction',
])
const DUNGEON_FLOORS = new Set([1, 2, 3])
const DUNGEON_RISKS = new Set(['low', 'medium', 'high', 'extreme'])
const SEARCH_PRESSURE_SECONDS = new Set([12, 20])

function cloneLoot(item: RunLoot): RunLoot {
  return { itemId: item.itemId, amount: item.amount }
}

function cloneExit(exit: DungeonExit): DungeonExit {
  const cloned: DungeonExit = { id: exit.id, to: exit.to, cost: exit.cost }
  if (exit.unlock !== undefined) cloned.unlock = exit.unlock
  return cloned
}

function cloneRoom(room: DungeonRoom): DungeonRoom {
  const cloned: DungeonRoom = {
    id: room.id,
    floor: room.floor,
    kind: room.kind,
    sceneId: room.sceneId,
    risk: room.risk,
    exits: room.exits.map(cloneExit),
  }
  if (room.encounterId !== undefined) cloned.encounterId = room.encounterId
  if (room.loot) cloned.loot = room.loot.map(cloneLoot)
  if (room.doorCurrency !== undefined) cloned.doorCurrency = room.doorCurrency
  if (room.searchPressureSeconds !== undefined) cloned.searchPressureSeconds = room.searchPressureSeconds
  return cloned
}

function cloneProfile(profile: DungeonProfile): DungeonProfile {
  return {
    id: profile.id,
    entryRoomId: profile.entryRoomId,
    extractionRoomIds: [...profile.extractionRoomIds],
    finalExtractionRoomId: profile.finalExtractionRoomId,
    bossAltarRoomId: profile.bossAltarRoomId,
    rooms: profile.rooms.map(cloneRoom),
  }
}

function roomById(profile: DungeonProfile, id: string): DungeonRoom | undefined {
  return profile.rooms.find((room) => room.id === id)
}

function invalidInteger(value: number, allowZero: boolean): boolean {
  return !Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)
}

function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

export function validateDungeonProfile(profile: DungeonProfile): void {
  if (!profile || !Array.isArray(profile.rooms)) throw new Error('Dungeon rooms are missing.')
  if (typeof profile.id !== 'string' || profile.id.trim().length === 0) {
    throw new Error('Dungeon profile ID must not be blank.')
  }

  const ids = new Set<string>()
  const sceneIds = new Set<string>()
  for (const room of profile.rooms) {
    if (!room || !isCanonicalId(room.id)) {
      throw new Error('Dungeon room IDs must be canonical and not blank.')
    }
    if (ids.has(room.id)) throw new Error('Dungeon room IDs must be unique.')
    ids.add(room.id)
    if (!DUNGEON_ROOM_KINDS.has(room.kind)) throw new Error(`Invalid dungeon room kind in ${room.id}.`)
    if (!DUNGEON_FLOORS.has(room.floor)) throw new Error(`Invalid floor in ${room.id}.`)
    if (!isCanonicalId(room.sceneId)) throw new Error(`Invalid scene ID in ${room.id}.`)
    if (sceneIds.has(room.sceneId)) throw new Error('Dungeon scene IDs must be unique.')
    sceneIds.add(room.sceneId)
    if (!DUNGEON_RISKS.has(room.risk)) throw new Error(`Invalid risk in ${room.id}.`)
    if (room.encounterId !== undefined && !isCanonicalId(room.encounterId)) {
      throw new Error(`Invalid encounter ID in ${room.id}.`)
    }
    if (room.searchPressureSeconds !== undefined && !SEARCH_PRESSURE_SECONDS.has(room.searchPressureSeconds)) {
      throw new Error(`Invalid search pressure in ${room.id}.`)
    }
  }

  if (!ids.has(profile.entryRoomId)) throw new Error('Dungeon entry room is missing.')
  const entryRoom = roomById(profile, profile.entryRoomId) as DungeonRoom
  if (entryRoom.kind !== 'entry') throw new Error('Dungeon entry room must have entry kind.')

  if (!Array.isArray(profile.extractionRoomIds) || profile.extractionRoomIds.length === 0) {
    throw new Error('Dungeon extraction rooms are missing.')
  }
  const extractionIds = new Set<string>()
  for (const extractionRoomId of profile.extractionRoomIds) {
    if (!isCanonicalId(extractionRoomId) || !ids.has(extractionRoomId)) {
      throw new Error('Dungeon extraction room is missing.')
    }
    if (extractionIds.has(extractionRoomId)) throw new Error('Dungeon extraction room IDs must be unique.')
    extractionIds.add(extractionRoomId)
    if (extractionRoomId === profile.entryRoomId) {
      throw new Error('Dungeon entry and extraction rooms must be distinct.')
    }
    if ((roomById(profile, extractionRoomId) as DungeonRoom).kind !== 'extraction') {
      throw new Error('Dungeon extraction rooms must have extraction kind.')
    }
  }
  if (!isCanonicalId(profile.finalExtractionRoomId) || !extractionIds.has(profile.finalExtractionRoomId)) {
    throw new Error('Dungeon final extraction room must be one of the extraction rooms.')
  }

  if (!isCanonicalId(profile.bossAltarRoomId) || !ids.has(profile.bossAltarRoomId)) {
    throw new Error('Dungeon boss altar room is missing.')
  }
  const bossRooms = profile.rooms.filter((room) => room.kind === 'boss')
  const bossAltar = roomById(profile, profile.bossAltarRoomId) as DungeonRoom
  if (bossRooms.length !== 1 || bossRooms[0].id !== bossAltar.id || bossAltar.floor !== 3) {
    throw new Error('Dungeon boss altar must be the one floor-three boss room.')
  }

  const exitIds = new Set<string>()
  for (const room of profile.rooms) {
    if (!Array.isArray(room.exits)) throw new Error(`Dungeon exits are missing in ${room.id}.`)

    const exitTargets = new Set<string>()
    for (const exit of room.exits) {
      if (!exit || !isCanonicalId(exit.id)) throw new Error(`Invalid dungeon exit ID in ${room.id}.`)
      if (exitIds.has(exit.id)) throw new Error(`Duplicate dungeon exit ID: ${exit.id}`)
      exitIds.add(exit.id)
      if (!isCanonicalId(exit.to) || !ids.has(exit.to)) {
        throw new Error(`Broken dungeon exit: ${room.id} -> ${exit && exit.to}`)
      }
      if (exitTargets.has(exit.to)) throw new Error(`Duplicate dungeon exit target in ${room.id}: ${exit.to}`)
      exitTargets.add(exit.to)
      if (invalidInteger(exit.cost, true)) throw new Error(`Invalid door cost in ${room.id}.`)
      if (exit.unlock !== undefined && exit.unlock !== 'boss-defeat') {
        throw new Error(`Invalid dungeon exit unlock in ${room.id}.`)
      }
    }

    if (room.loot !== undefined && !Array.isArray(room.loot)) throw new Error(`Invalid loot in ${room.id}.`)
    for (const item of room.loot || []) {
      if (!item || typeof item.itemId !== 'string' || item.itemId.trim().length === 0) {
        throw new Error(`Invalid loot ID in ${room.id}.`)
      }
      if (invalidInteger(item.amount, false)) throw new Error(`Invalid loot amount in ${room.id}.`)
    }
    if (room.doorCurrency !== undefined && invalidInteger(room.doorCurrency, false)) {
      throw new Error(`Invalid door currency reward in ${room.id}.`)
    }
  }

  const visited = new Set<string>()
  const pending: string[] = [profile.entryRoomId]
  while (pending.length > 0) {
    const roomId = pending.shift() as string
    if (visited.has(roomId)) continue
    visited.add(roomId)
    const room = roomById(profile, roomId) as DungeonRoom
    for (const exit of room.exits) {
      if (!visited.has(exit.to)) pending.push(exit.to)
    }
  }
  if (visited.size !== profile.rooms.length) {
    throw new Error('Dungeon rooms are unreachable from the entry room.')
  }

  const reverseExits = new Map<string, string[]>()
  for (const room of profile.rooms) reverseExits.set(room.id, [])
  for (const room of profile.rooms) {
    for (const exit of room.exits) (reverseExits.get(exit.to) as string[]).push(room.id)
  }

  const reachesExtraction = new Set<string>()
  const reversePending: string[] = [...profile.extractionRoomIds]
  while (reversePending.length > 0) {
    const roomId = reversePending.shift() as string
    if (reachesExtraction.has(roomId)) continue
    reachesExtraction.add(roomId)
    for (const previousRoomId of reverseExits.get(roomId) as string[]) {
      if (!reachesExtraction.has(previousRoomId)) reversePending.push(previousRoomId)
    }
  }
  if (reachesExtraction.size !== profile.rooms.length) {
    throw new Error('Every dungeon room must have a path to the extraction set.')
  }
}

export function createDungeonSession(profile: DungeonProfile, seed: number): DungeonRun {
  if (invalidInteger(seed, true) || seed > MAX_UINT32) throw new Error('Dungeon seed must be a uint32 integer.')
  validateDungeonProfile(profile)
  const isolatedProfile = cloneProfile(profile)
  return {
    id: `${isolatedProfile.id}-${seed}`,
    profile: isolatedProfile,
    phase: 'exploring',
    currentRoomId: isolatedProfile.entryRoomId,
    doorCurrency: 0,
    searchedRoomIds: [],
    carriedLoot: [],
  }
}

export function enterRoom(run: DungeonRun, targetId: string) {
  if (run.phase !== 'exploring') return { ok: false as const, reason: 'inactive' as const }
  if (invalidInteger(run.doorCurrency, true)) {
    return { ok: false as const, reason: 'invalid-currency' as const }
  }
  const current = roomById(run.profile, run.currentRoomId)
  if (!current) return { ok: false as const, reason: 'not-connected' as const }
  const exit = current.exits.find((candidate) => candidate.to === targetId)
  if (!exit) return { ok: false as const, reason: 'not-connected' as const }
  if (run.doorCurrency < exit.cost) return { ok: false as const, reason: 'door-cost' as const }

  run.doorCurrency -= exit.cost
  run.currentRoomId = targetId
  return { ok: true as const }
}

export function searchRoom(run: DungeonRun) {
  const failed = (reason: 'inactive' | 'missing-room' | 'already-searched' | 'invalid-currency') => ({
    ok: false as const,
    reason,
    loot: [] as RunLoot[],
    doorCurrencyGranted: 0,
  })
  if (run.phase !== 'exploring') return failed('inactive')
  const room = roomById(run.profile, run.currentRoomId)
  if (!room) return failed('missing-room')
  if (run.searchedRoomIds.indexOf(room.id) >= 0) return failed('already-searched')

  const doorCurrencyGranted = room.doorCurrency ?? 0
  const nextDoorCurrency = run.doorCurrency + doorCurrencyGranted
  if (invalidInteger(run.doorCurrency, true) || !Number.isSafeInteger(nextDoorCurrency)) {
    return failed('invalid-currency')
  }

  const loot = (room.loot || []).map(cloneLoot)
  run.searchedRoomIds.push(room.id)
  for (const item of loot) run.carriedLoot.push(cloneLoot(item))
  run.doorCurrency = nextDoorCurrency
  return { ok: true as const, loot, doorCurrencyGranted }
}

export function extractRun(run: DungeonRun) {
  if (run.phase !== 'exploring' || run.profile.extractionRoomIds.indexOf(run.currentRoomId) < 0) {
    return { ok: false as const, loot: [] as RunLoot[] }
  }

  run.phase = 'extracted'
  return { ok: true as const, loot: run.carriedLoot.map(cloneLoot) }
}
