import type {
  DungeonCommand,
  DungeonExit,
  DungeonProfile,
  DungeonRoom,
  DungeonRoomKind,
  DungeonRun,
  DungeonRunEvent,
  DungeonRunPhase,
  RunLoot,
} from './DungeonTypes.ts'
import {
  advanceExtraction,
  createDungeonExtraction,
  interruptExtraction,
  restoreDungeonExtraction,
  snapshotDungeonExtraction,
  startExtraction,
  type DungeonExtractionState,
} from './DungeonExtractionRuntime.ts'
import {
  createDungeonMap,
  enterMappedRoom,
  sealRoute,
  snapshotDungeonMap,
  type DungeonMapState,
} from './DungeonMapRuntime.ts'
import {
  MAX_ELAPSED_SECONDS,
  MAX_FRAME_DELTA_SECONDS,
  advanceDungeonPressure,
  applySearchPressure,
  createDungeonPressure,
  snapshotDungeonPressure,
  type DungeonPressureState,
} from './DungeonPressureRuntime.ts'
import {
  beginFinalFight,
  beginFirstHunt,
  beginSecondHunt,
  createPursuitBoss,
  damagePursuer,
  snapshotPursuitBoss,
  unlockTrueForm,
  type PursuitBossState,
} from './PursuitBossRuntime.ts'

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
  const extractionRooms = profile.rooms.filter((room) => room.kind === 'extraction')
  if (extractionRooms.length !== extractionIds.size || extractionRooms.some((room) => !extractionIds.has(room.id))) {
    throw new Error('Dungeon extraction rooms must exactly match the declared extractionRoomIds.')
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

type DungeonCommandFailureReason =
  | 'inactive'
  | 'missing-room'
  | 'already-searched'
  | 'invalid-currency'
  | 'unknown-exit'
  | 'unknown-room'
  | 'not-connected'
  | 'sealed-exit'
  | 'door-cost'
  | 'wrong-room'
  | 'invalid-phase'
  | 'already-there'
  | 'unreachable'

export type DungeonCommandResult =
  | { accepted: true; events: DungeonRunEvent[]; retainedLoot?: RunLoot[] }
  | { accepted: false; reason: DungeonCommandFailureReason; events: []; retainedLoot?: RunLoot[] }

export interface DungeonRunCheckpoint {
  schemaVersion: 1
  runId: string
  profileId: string
  seed: number
  phase: DungeonRunPhase
  map: DungeonMapState
  pressure: DungeonPressureState
  pursuer: PursuitBossState
  extraction: DungeonExtractionState
  doorCurrency: number
  searchedRoomIds: string[]
  carriedLoot: RunLoot[]
  boundLoot: RunLoot[]
  eventSequence: number
}

const RUN_PHASES = new Set<DungeonRunPhase>(['exploring', 'extracting', 'extracted', 'defeated', 'abandoned'])
const TERMINAL_PHASES = new Set<DungeonRunPhase>(['extracted', 'defeated', 'abandoned'])

function cloneLootList(loot: readonly RunLoot[]): RunLoot[] {
  return loot.map(cloneLoot)
}

function cloneEvent(event: DungeonRunEvent): DungeonRunEvent {
  if ('loot' in event || 'retainedLoot' in event) {
    return {
      ...event,
      ...('loot' in event ? { loot: cloneLootList(event.loot) } : {}),
      ...('retainedLoot' in event ? { retainedLoot: cloneLootList(event.retainedLoot) } : {}),
    } as DungeonRunEvent
  }
  return { ...event }
}

function cloneEvents(events: readonly DungeonRunEvent[]): DungeonRunEvent[] {
  return events.map(cloneEvent)
}

function accepted(run: DungeonRun, events: readonly DungeonRunEvent[], retainedLoot?: readonly RunLoot[]): DungeonCommandResult {
  run.eventSequence += 1
  const result: DungeonCommandResult = { accepted: true, events: cloneEvents(events) }
  if (retainedLoot) result.retainedLoot = cloneLootList(retainedLoot)
  return result
}

function rejected(reason: DungeonCommandFailureReason, retainedLoot?: readonly RunLoot[]): DungeonCommandResult {
  const result: DungeonCommandResult = { accepted: false, reason, events: [] }
  if (retainedLoot) result.retainedLoot = cloneLootList(retainedLoot)
  return result
}

function attachLegacyCurrentRoomAccessor(run: DungeonRun): void {
  Object.defineProperty(run, 'currentRoomId', {
    configurable: false,
    enumerable: false,
    get: () => run.map.currentRoomId,
  })
}

export function createDungeonSession(profile: DungeonProfile, seed: number): DungeonRun {
  if (invalidInteger(seed, true) || seed > MAX_UINT32) throw new Error('Dungeon seed must be a uint32 integer.')
  validateDungeonProfile(profile)
  const isolatedProfile = cloneProfile(profile)
  const run: DungeonRun = {
    id: `${isolatedProfile.id}-${seed}`,
    seed,
    profile: isolatedProfile,
    phase: 'exploring',
    map: createDungeonMap(isolatedProfile),
    pressure: createDungeonPressure(),
    pursuer: createPursuitBoss({ firstShield: 180, secondShield: 260, finalHealth: 1200 }),
    extraction: createDungeonExtraction(),
    doorCurrency: 0,
    searchedRoomIds: [],
    carriedLoot: [],
    boundLoot: [],
    eventSequence: 0,
  }
  attachLegacyCurrentRoomAccessor(run)
  return run
}

function startFirstHuntIfNeeded(pursuer: PursuitBossState, events: DungeonRunEvent[]): void {
  if (pursuer.phase === 'dormant' && beginFirstHunt(pursuer)) {
    events.push({ type: 'pursuer-hunt-started', hunt: 1 })
  }
}

function searchCommand(run: DungeonRun): DungeonCommandResult {
  if (run.phase !== 'exploring') return rejected('inactive')
  const room = roomById(run.profile, run.map.currentRoomId)
  if (!room) return rejected('missing-room')
  if (run.searchedRoomIds.includes(room.id)) return rejected('already-searched')

  const doorCurrencyGranted = room.doorCurrency ?? 0
  const nextDoorCurrency = run.doorCurrency + doorCurrencyGranted
  if (invalidInteger(run.doorCurrency, true) || !Number.isSafeInteger(nextDoorCurrency)) {
    return rejected('invalid-currency')
  }

  const nextPressure = snapshotDungeonPressure(run.pressure)
  const nextPursuer = snapshotPursuitBoss(run.pursuer)
  const events: DungeonRunEvent[] = []
  if (room.searchPressureSeconds) {
    const pressureEvents = applySearchPressure(nextPressure, room.searchPressureSeconds)
    events.push(...pressureEvents.events)
    if (pressureEvents.events.some((event) => event.phase === 'restless')) {
      startFirstHuntIfNeeded(nextPursuer, events)
    }
  }

  const loot = cloneLootList(room.loot ?? [])
  run.searchedRoomIds.push(room.id)
  run.carriedLoot.push(...cloneLootList(loot))
  run.doorCurrency = nextDoorCurrency
  run.pressure = nextPressure
  run.pursuer = nextPursuer
  events.unshift({ type: 'room-searched', roomId: room.id, loot, doorCurrencyGranted })
  return accepted(run, events)
}

function chooseExitCommand(run: DungeonRun, exitId: string): DungeonCommandResult {
  if (run.phase !== 'exploring') return rejected('inactive')
  if (!isCanonicalId(exitId)) return rejected('unknown-exit')
  if (invalidInteger(run.doorCurrency, true)) return rejected('invalid-currency')

  const current = roomById(run.profile, run.map.currentRoomId)
  if (!current) return rejected('missing-room')
  const exit = current.exits.find((candidate) => candidate.id === exitId)
  if (!exit) return rejected('unknown-exit')
  const fromRoomId = current.id
  const entered = enterMappedRoom(run.map, run.profile, exit.to, run.doorCurrency)
  if (!entered.ok) return rejected(entered.reason)

  run.doorCurrency = entered.currency
  return accepted(run, [{ type: 'room-entered', fromRoomId, roomId: exit.to, exitId, cost: exit.cost }])
}

function activateAltarCommand(run: DungeonRun): DungeonCommandResult {
  if (run.phase !== 'exploring') return rejected('inactive')
  if (run.map.currentRoomId !== run.profile.bossAltarRoomId) return rejected('wrong-room')
  const nextPursuer = snapshotPursuitBoss(run.pursuer)
  if (!unlockTrueForm(nextPursuer, run.map.currentRoomId)) return rejected('invalid-phase')
  if (!beginFinalFight(nextPursuer).ok) return rejected('invalid-phase')
  run.pursuer = nextPursuer
  return accepted(run, [{ type: 'altar-activated', roomId: run.map.currentRoomId }])
}

function beginExtractionCommand(run: DungeonRun): DungeonCommandResult {
  if (run.phase !== 'exploring') return rejected('inactive')
  const roomId = run.map.currentRoomId
  if (!run.profile.extractionRoomIds.includes(roomId)) return rejected('wrong-room')
  if (!startExtraction(run.extraction, roomId)) return rejected('invalid-phase')
  run.phase = 'extracting'
  return accepted(run, [{ type: 'extraction-started', roomId }])
}

function abandonCommand(run: DungeonRun): DungeonCommandResult {
  if (TERMINAL_PHASES.has(run.phase)) return rejected('inactive', run.boundLoot)
  const retainedLoot = cloneLootList(run.boundLoot)
  run.carriedLoot = []
  run.extraction = createDungeonExtraction()
  run.phase = 'abandoned'
  return accepted(run, [{ type: 'dungeon-abandoned', retainedLoot }], retainedLoot)
}

export function applyDungeonCommand(run: DungeonRun, command: DungeonCommand): DungeonCommandResult {
  if (!command || typeof command !== 'object') return rejected('invalid-phase')
  if (command.type === 'search') return searchCommand(run)
  if (command.type === 'choose-exit') return chooseExitCommand(run, command.exitId)
  if (command.type === 'activate-altar') return activateAltarCommand(run)
  if (command.type === 'begin-extraction') return beginExtractionCommand(run)
  if (command.type === 'abandon') return abandonCommand(run)
  return rejected('invalid-phase')
}

export function searchCurrentRoom(run: DungeonRun): DungeonCommandResult {
  return applyDungeonCommand(run, { type: 'search' })
}

export function chooseDungeonExit(run: DungeonRun, exitId: string): DungeonCommandResult {
  return applyDungeonCommand(run, { type: 'choose-exit', exitId })
}

export function beginDungeonExtraction(run: DungeonRun): DungeonCommandResult {
  return applyDungeonCommand(run, { type: 'begin-extraction' })
}

function extractionSettlement(run: DungeonRun): DungeonRunEvent {
  const roomId = run.extraction.roomId
  const revealedUnique = new Set(run.map.revealedRoomIds).size
  return {
    type: 'extraction-completed',
    exitKind: roomId === run.profile.finalExtractionRoomId ? 'full' : 'damaged',
    explorationRate: Number(Math.min(1, Math.max(0, revealedUnique / run.profile.rooms.length)).toFixed(6)),
    bossDefeated: run.pursuer.phase === 'defeated',
    loot: cloneLootList(run.carriedLoot),
    retainedLoot: cloneLootList(run.boundLoot),
  }
}

export function advanceDungeonRun(
  run: DungeonRun,
  deltaSeconds: number,
  options: { paused: boolean },
): { events: DungeonRunEvent[] } {
  if (TERMINAL_PHASES.has(run.phase)) return { events: [] }
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new TypeError('deltaSeconds must be finite and nonnegative')
  }
  if (!options || typeof options.paused !== 'boolean') throw new TypeError('paused must be boolean')
  if (options.paused || deltaSeconds === 0) return { events: [] }

  const effectiveDelta = Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS)
  const nextPressure = snapshotDungeonPressure(run.pressure)
  const nextPursuer = snapshotPursuitBoss(run.pursuer)
  const nextExtraction = snapshotDungeonExtraction(run.extraction)
  const events: DungeonRunEvent[] = []

  const pressureResult = advanceDungeonPressure(nextPressure, effectiveDelta, false)
  events.push(...pressureResult.events)
  if (pressureResult.events.some((event) => event.phase === 'restless')) {
    startFirstHuntIfNeeded(nextPursuer, events)
  }

  let completed = false
  if (run.phase === 'extracting') {
    const extractionResult = advanceExtraction(nextExtraction, effectiveDelta)
    completed = extractionResult.type === 'extraction-completed'
  }

  run.pressure = nextPressure
  run.pursuer = nextPursuer
  run.extraction = nextExtraction
  if (completed) {
    run.phase = 'extracted'
    events.push(extractionSettlement(run))
  }
  run.eventSequence += 1
  return { events: cloneEvents(events) }
}

export function interruptDungeonRun(
  run: DungeonRun,
  hit: { sourceRole: 'ordinary' | 'elite' | 'boss'; effectiveDamage: number },
): DungeonCommandResult {
  if (TERMINAL_PHASES.has(run.phase)) return rejected('inactive')
  const result = interruptExtraction(run.extraction, hit)
  if (result.type !== 'extraction-interrupted') return rejected('invalid-phase')
  run.phase = 'exploring'
  return accepted(run, [{ type: 'extraction-interrupted', reason: result.reason }])
}

function deterministicSealCandidate(run: DungeonRun): string | null {
  const initiallyLocked = new Set(
    run.profile.rooms.flatMap((room) =>
      room.exits.filter((exit) => exit.unlock === 'boss-defeat').map((exit) => exit.id),
    ),
  )
  const candidates = run.profile.rooms
    .flatMap((room) => room.exits.map((exit) => exit.id))
    .filter((exitId) => !initiallyLocked.has(exitId) && !run.map.sealedExitIds.includes(exitId))
    .sort()
  for (const exitId of candidates) {
    const result = sealRoute(run.map, run.profile, exitId)
    if (result.ok) return exitId
  }
  return null
}

export function beginSecondPursuit(run: DungeonRun): DungeonCommandResult {
  if (TERMINAL_PHASES.has(run.phase)) return rejected('inactive')
  const result = beginSecondHunt(run.pursuer)
  if (!result.ok) return rejected('invalid-phase')
  const events: DungeonRunEvent[] = [{ type: 'pursuer-hunt-started', hunt: 2 }]
  const sealedExitId = deterministicSealCandidate(run)
  if (sealedExitId) events.push({ type: 'route-sealed', exitId: sealedExitId })
  return accepted(run, events)
}

export function applyPursuerDamage(run: DungeonRun, amount: number): DungeonCommandResult {
  if (TERMINAL_PHASES.has(run.phase)) return rejected('inactive')
  const result = damagePursuer(run.pursuer, amount)
  if (!result.ok) return rejected('invalid-phase')
  const events: DungeonRunEvent[] = [{ ...result.event }]
  if (result.event.type === 'pursuer-defeated') {
    const vaultEntryExitIds = new Set(
      run.profile.rooms.flatMap((room) =>
        room.exits
          .filter((exit) => exit.to === 'f3-sword-vault' && exit.unlock === 'boss-defeat')
          .map((exit) => exit.id),
      ),
    )
    for (const exitId of [...vaultEntryExitIds].sort()) {
      const index = run.map.sealedExitIds.indexOf(exitId)
      if (index >= 0) {
        run.map.sealedExitIds.splice(index, 1)
        events.push({ type: 'route-unsealed', exitId })
      }
    }
  }
  return accepted(run, events)
}

export function moveRunTo(run: DungeonRun, targetRoomId: string): DungeonCommandResult {
  if (run.phase !== 'exploring') return rejected('inactive')
  if (!roomById(run.profile, targetRoomId)) return rejected('unknown-room')
  if (run.map.currentRoomId === targetRoomId) return rejected('already-there')
  if (invalidInteger(run.doorCurrency, true)) return rejected('invalid-currency')

  type RouteNode = { roomId: string; currency: number; path: string[] }
  const pending: RouteNode[] = [{ roomId: run.map.currentRoomId, currency: run.doorCurrency, path: [] }]
  const bestCurrency = new Map<string, number>([[run.map.currentRoomId, run.doorCurrency]])
  let route: string[] | null = null
  while (pending.length > 0 && !route) {
    const node = pending.shift() as RouteNode
    const room = roomById(run.profile, node.roomId) as DungeonRoom
    for (const exit of [...room.exits].sort((left, right) => left.id.localeCompare(right.id))) {
      if (run.map.sealedExitIds.includes(exit.id) || node.currency < exit.cost) continue
      const currency = node.currency - exit.cost
      const path = [...node.path, exit.id]
      if (exit.to === targetRoomId) {
        route = path
        break
      }
      if ((bestCurrency.get(exit.to) ?? -1) >= currency) continue
      bestCurrency.set(exit.to, currency)
      pending.push({ roomId: exit.to, currency, path })
    }
  }
  if (!route) return rejected('unreachable')

  const events: DungeonRunEvent[] = []
  for (const exitId of route) {
    const result = chooseDungeonExit(run, exitId)
    if (!result.accepted) throw new Error(`Validated dungeon route failed at ${exitId}`)
    events.push(...result.events)
  }
  return { accepted: true, events: cloneEvents(events) }
}

export function defeatDungeonRun(run: DungeonRun): { phase: DungeonRunPhase; retainedLoot: RunLoot[] } {
  if (TERMINAL_PHASES.has(run.phase)) {
    return { phase: run.phase, retainedLoot: cloneLootList(run.boundLoot) }
  }
  run.carriedLoot = []
  run.extraction = createDungeonExtraction()
  run.phase = 'defeated'
  run.eventSequence += 1
  return { phase: 'defeated', retainedLoot: cloneLootList(run.boundLoot) }
}

function assertCanonicalIdArray(value: unknown, name: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((id) => !isCanonicalId(id)) || new Set(value).size !== value.length) {
    throw new TypeError(`${name} must contain unique canonical IDs`)
  }
}

function assertLootArray(value: unknown, name: string): asserts value is RunLoot[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`)
  for (const item of value) {
    if (!item || typeof item !== 'object' || !isCanonicalId((item as RunLoot).itemId)) {
      throw new TypeError(`${name} contains an invalid item ID`)
    }
    if (invalidInteger((item as RunLoot).amount, false)) throw new TypeError(`${name} contains an invalid amount`)
  }
}

export function validateDungeonCheckpointShape(value: unknown): asserts value is DungeonRunCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Dungeon checkpoint must be an object')
  }
  const checkpoint = value as DungeonRunCheckpoint
  if (checkpoint.schemaVersion !== 1) throw new TypeError('Dungeon checkpoint schema is unsupported')
  if (!isCanonicalId(checkpoint.runId) || !isCanonicalId(checkpoint.profileId)) {
    throw new TypeError('Dungeon checkpoint identity is invalid')
  }
  if (!Number.isSafeInteger(checkpoint.seed) || checkpoint.seed < 0 || checkpoint.seed > MAX_UINT32) {
    throw new TypeError('Dungeon checkpoint seed is invalid')
  }
  if (!RUN_PHASES.has(checkpoint.phase)) throw new TypeError('Dungeon checkpoint phase is invalid')
  if (!checkpoint.map || typeof checkpoint.map !== 'object') throw new TypeError('Dungeon checkpoint map is invalid')
  if (!isCanonicalId(checkpoint.map.currentRoomId)) throw new TypeError('Dungeon current room is invalid')
  assertCanonicalIdArray(checkpoint.map.revealedRoomIds, 'revealedRoomIds')
  assertCanonicalIdArray(checkpoint.map.sealedExitIds, 'sealedExitIds')
  snapshotDungeonPressure(checkpoint.pressure)
  snapshotPursuitBoss(checkpoint.pursuer)
  const extraction = restoreDungeonExtraction(checkpoint.extraction)
  const extractionPhaseMatches = checkpoint.phase === 'extracting'
    ? extraction.phase === 'channeling'
    : checkpoint.phase === 'extracted'
      ? extraction.phase === 'completed'
      : extraction.phase === 'idle'
  if (!extractionPhaseMatches) throw new TypeError('Dungeon phase and extraction state are inconsistent')
  if (checkpoint.pressure.phase !== 'calm' && checkpoint.pursuer.phase === 'dormant') {
    throw new TypeError('Dungeon pressure and pursuer state are inconsistent')
  }
  if (invalidInteger(checkpoint.doorCurrency, true)) throw new TypeError('Dungeon door currency is invalid')
  assertCanonicalIdArray(checkpoint.searchedRoomIds, 'searchedRoomIds')
  assertLootArray(checkpoint.carriedLoot, 'carriedLoot')
  assertLootArray(checkpoint.boundLoot, 'boundLoot')
  if (invalidInteger(checkpoint.eventSequence, true)) throw new TypeError('Dungeon event sequence is invalid')
}

export function checkpointDungeonRun(run: DungeonRun): DungeonRunCheckpoint {
  const checkpoint: DungeonRunCheckpoint = {
    schemaVersion: 1,
    runId: run.id,
    profileId: run.profile.id,
    seed: run.seed,
    phase: run.phase,
    map: snapshotDungeonMap(run.map),
    pressure: snapshotDungeonPressure(run.pressure),
    pursuer: snapshotPursuitBoss(run.pursuer),
    extraction: snapshotDungeonExtraction(run.extraction),
    doorCurrency: run.doorCurrency,
    searchedRoomIds: [...run.searchedRoomIds],
    carriedLoot: cloneLootList(run.carriedLoot),
    boundLoot: cloneLootList(run.boundLoot),
    eventSequence: run.eventSequence,
  }
  validateDungeonCheckpointShape(checkpoint)
  return checkpoint
}

function routeStateCanExtract(profile: DungeonProfile, map: DungeonMapState): boolean {
  const sealed = new Set(map.sealedExitIds)
  const reachable = new Set<string>()
  const forwardPending = [map.currentRoomId]
  while (forwardPending.length > 0) {
    const roomId = forwardPending.shift() as string
    if (reachable.has(roomId)) continue
    reachable.add(roomId)
    const room = roomById(profile, roomId)
    for (const exit of room?.exits ?? []) {
      if (!sealed.has(exit.id) && !reachable.has(exit.to)) forwardPending.push(exit.to)
    }
  }

  const reverse = new Map(profile.rooms.map((room) => [room.id, [] as string[]]))
  for (const room of profile.rooms) {
    for (const exit of room.exits) {
      if (!sealed.has(exit.id)) reverse.get(exit.to)?.push(room.id)
    }
  }
  const canExtract = new Set<string>()
  const reversePending = [...profile.extractionRoomIds]
  while (reversePending.length > 0) {
    const roomId = reversePending.shift() as string
    if (canExtract.has(roomId)) continue
    canExtract.add(roomId)
    for (const previousId of reverse.get(roomId) ?? []) {
      if (!canExtract.has(previousId)) reversePending.push(previousId)
    }
  }
  return [...reachable].every((roomId) => canExtract.has(roomId))
}

export function restoreDungeonSession(profile: DungeonProfile, value: unknown): DungeonRun {
  validateDungeonProfile(profile)
  validateDungeonCheckpointShape(value)
  const checkpoint = value
  if (checkpoint.profileId !== profile.id || checkpoint.runId !== `${profile.id}-${checkpoint.seed}`) {
    throw new TypeError('Dungeon checkpoint profile identity does not match')
  }

  const roomIds = new Set(profile.rooms.map((room) => room.id))
  const exitIds = new Set(profile.rooms.flatMap((room) => room.exits.map((exit) => exit.id)))
  if (!roomIds.has(checkpoint.map.currentRoomId)) throw new TypeError('Dungeon current room does not exist')
  if (checkpoint.map.revealedRoomIds.some((id) => !roomIds.has(id))) throw new TypeError('Dungeon reveal is invalid')
  if (checkpoint.searchedRoomIds.some((id) => !roomIds.has(id))) throw new TypeError('Dungeon search is invalid')
  if (checkpoint.map.sealedExitIds.some((id) => !exitIds.has(id))) throw new TypeError('Dungeon seal is invalid')
  if (!checkpoint.map.revealedRoomIds.includes(profile.entryRoomId) ||
      !checkpoint.map.revealedRoomIds.includes(checkpoint.map.currentRoomId)) {
    throw new TypeError('Dungeon reveal state omits an authoritative room')
  }
  if (checkpoint.searchedRoomIds.some((id) => !checkpoint.map.revealedRoomIds.includes(id))) {
    throw new TypeError('Searched dungeon rooms must be revealed')
  }
  if (!routeStateCanExtract(profile, checkpoint.map)) {
    throw new TypeError('Dungeon route state cannot reach extraction')
  }
  const vaultEntranceIds = profile.rooms.flatMap((room) =>
    room.exits
      .filter((exit) => exit.to === 'f3-sword-vault' && exit.unlock === 'boss-defeat')
      .map((exit) => exit.id),
  )
  const sealedExitIds = new Set(checkpoint.map.sealedExitIds)
  const permanentBossSealIds = profile.rooms.flatMap((room) =>
    room.exits
      .filter((exit) => exit.unlock === 'boss-defeat' && exit.to !== 'f3-sword-vault')
      .map((exit) => exit.id),
  )
  if (permanentBossSealIds.some((exitId) => !sealedExitIds.has(exitId))) {
    throw new TypeError('Permanent Boss route seals are missing')
  }
  if (checkpoint.pursuer.phase === 'defeated') {
    if (vaultEntranceIds.some((exitId) => sealedExitIds.has(exitId))) {
      throw new TypeError('Defeated Boss checkpoint cannot keep sword-vault entrances sealed')
    }
  } else if (vaultEntranceIds.some((exitId) => !sealedExitIds.has(exitId))) {
    throw new TypeError('Sword-vault entrances must remain sealed before Boss defeat')
  }

  const extraction = checkpoint.extraction
  if (checkpoint.phase === 'extracting') {
    if (extraction.phase !== 'channeling' || extraction.roomId !== checkpoint.map.currentRoomId ||
        !profile.extractionRoomIds.includes(extraction.roomId)) {
      throw new TypeError('Dungeon extraction checkpoint is inconsistent')
    }
  } else if (checkpoint.phase === 'extracted') {
    if (extraction.phase !== 'completed' || extraction.roomId !== checkpoint.map.currentRoomId ||
        !profile.extractionRoomIds.includes(extraction.roomId)) {
      throw new TypeError('Completed dungeon extraction checkpoint is inconsistent')
    }
  } else if (extraction.phase !== 'idle') {
    throw new TypeError('Inactive dungeon extraction checkpoint is inconsistent')
  }

  const isolatedProfile = cloneProfile(profile)
  const run: DungeonRun = {
    id: checkpoint.runId,
    seed: checkpoint.seed,
    profile: isolatedProfile,
    phase: checkpoint.phase,
    map: snapshotDungeonMap(checkpoint.map),
    pressure: snapshotDungeonPressure(checkpoint.pressure),
    pursuer: snapshotPursuitBoss(checkpoint.pursuer),
    extraction: restoreDungeonExtraction(checkpoint.extraction),
    doorCurrency: checkpoint.doorCurrency,
    searchedRoomIds: [...checkpoint.searchedRoomIds],
    carriedLoot: cloneLootList(checkpoint.carriedLoot),
    boundLoot: cloneLootList(checkpoint.boundLoot),
    eventSequence: checkpoint.eventSequence,
  }
  attachLegacyCurrentRoomAccessor(run)
  return run
}

// Transitional adapters for the old controller. New gameplay code must use explicit commands above.
export function enterRoom(run: DungeonRun, targetId: string) {
  if (run.phase !== 'exploring') return { ok: false as const, reason: 'inactive' as const }
  if (invalidInteger(run.doorCurrency, true)) return { ok: false as const, reason: 'invalid-currency' as const }
  const room = roomById(run.profile, run.map.currentRoomId)
  const exit = room?.exits.find((candidate) => candidate.to === targetId)
  if (!exit) return { ok: false as const, reason: 'not-connected' as const }
  const result = chooseDungeonExit(run, exit.id)
  if (result.accepted === false) return { ok: false as const, reason: result.reason }
  return { ok: true as const }
}

export function searchRoom(run: DungeonRun) {
  const result = searchCurrentRoom(run)
  if (result.accepted === false) {
    const reason = result.reason === 'inactive' || result.reason === 'missing-room' ||
      result.reason === 'already-searched' || result.reason === 'invalid-currency'
      ? result.reason
      : 'missing-room'
    return { ok: false as const, reason, loot: [] as RunLoot[], doorCurrencyGranted: 0 }
  }
  const event = result.events.find((candidate) => candidate.type === 'room-searched')
  if (!event || event.type !== 'room-searched') {
    return { ok: false as const, reason: 'missing-room' as const, loot: [] as RunLoot[], doorCurrencyGranted: 0 }
  }
  return { ok: true as const, loot: cloneLootList(event.loot), doorCurrencyGranted: event.doorCurrencyGranted }
}

export function extractRun(run: DungeonRun) {
  const started = beginDungeonExtraction(run)
  if (!started.accepted) return { ok: false as const, loot: [] as RunLoot[] }
  const result = advanceExtraction(run.extraction, 3)
  if (result.type !== 'extraction-completed') return { ok: false as const, loot: [] as RunLoot[] }
  run.phase = 'extracted'
  run.eventSequence += 1
  return { ok: true as const, loot: cloneLootList(run.carriedLoot) }
}
