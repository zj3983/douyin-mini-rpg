import type { DungeonProfile, DungeonRoomKind } from './DungeonTypes.ts'
import { validateDungeonProfile } from './DungeonSession.ts'

export interface DungeonMapState {
  currentRoomId: string
  revealedRoomIds: string[]
  sealedExitIds: string[]
}

export interface DungeonRoomIntel {
  id: string
  floor: 1 | 2 | 3
  risk: 'low' | 'medium' | 'high' | 'extreme'
  revealed: boolean
  kind: DungeonRoomKind | null
}

export function snapshotDungeonMap(map: DungeonMapState): DungeonMapState {
  return {
    currentRoomId: map.currentRoomId,
    revealedRoomIds: [...map.revealedRoomIds],
    sealedExitIds: [...map.sealedExitIds],
  }
}

export function createDungeonMap(profile: DungeonProfile): DungeonMapState {
  validateDungeonProfile(profile)
  return {
    currentRoomId: profile.entryRoomId,
    revealedRoomIds: [profile.entryRoomId],
    sealedExitIds: profile.rooms.flatMap((room) =>
      room.exits.filter((exit) => exit.unlock === 'boss-defeat').map((exit) => exit.id),
    ),
  }
}

export function roomIntel(
  map: DungeonMapState,
  profile: DungeonProfile,
  roomId: string,
): DungeonRoomIntel | null {
  const room = profile.rooms.find((candidate) => candidate.id === roomId)
  if (!room) return null

  const revealed = map.revealedRoomIds.includes(roomId)
  return {
    id: room.id,
    floor: room.floor,
    risk: room.risk,
    revealed,
    kind: revealed ? room.kind : null,
  }
}

export function enterMappedRoom(
  map: DungeonMapState,
  profile: DungeonProfile,
  targetId: string,
  currency: number,
) {
  if (!Number.isSafeInteger(currency) || currency < 0) {
    return { ok: false as const, reason: 'invalid-currency' as const }
  }

  if (!profile.rooms.some((room) => room.id === targetId)) {
    return { ok: false as const, reason: 'unknown-room' as const }
  }

  const currentRoom = profile.rooms.find((room) => room.id === map.currentRoomId)
  const exit = currentRoom?.exits.find((candidate) => candidate.to === targetId)
  if (!exit) return { ok: false as const, reason: 'not-connected' as const }
  if (map.sealedExitIds.includes(exit.id)) {
    return { ok: false as const, reason: 'sealed-exit' as const }
  }
  if (currency < exit.cost) return { ok: false as const, reason: 'door-cost' as const }

  map.currentRoomId = targetId
  if (!map.revealedRoomIds.includes(targetId)) map.revealedRoomIds.push(targetId)
  return { ok: true as const, currency: currency - exit.cost }
}

function canReachExtraction(
  map: DungeonMapState,
  profile: DungeonProfile,
  sealedExitIds: ReadonlySet<string>,
): boolean {
  const extractionRoomIds = new Set(profile.extractionRoomIds)
  const roomsById = new Map(profile.rooms.map((room) => [room.id, room]))
  const visited = new Set<string>()
  const pending = [map.currentRoomId]

  while (pending.length > 0) {
    const roomId = pending.shift() as string
    if (visited.has(roomId)) continue
    if (extractionRoomIds.has(roomId)) return true
    visited.add(roomId)

    const room = roomsById.get(roomId)
    for (const exit of room?.exits ?? []) {
      if (!sealedExitIds.has(exit.id) && !visited.has(exit.to)) pending.push(exit.to)
    }
  }

  return false
}

export function sealRoute(map: DungeonMapState, profile: DungeonProfile, exitId: string) {
  const knownExit = profile.rooms.some((room) => room.exits.some((exit) => exit.id === exitId))
  if (!knownExit) return { ok: false as const, reason: 'unknown-exit' as const }
  if (map.sealedExitIds.includes(exitId)) return { ok: true as const }

  const candidateSeals = new Set(map.sealedExitIds)
  candidateSeals.add(exitId)
  if (!canReachExtraction(map, profile, candidateSeals)) {
    return { ok: false as const, reason: 'would-strand-player' as const }
  }

  map.sealedExitIds.push(exitId)
  return { ok: true as const }
}
