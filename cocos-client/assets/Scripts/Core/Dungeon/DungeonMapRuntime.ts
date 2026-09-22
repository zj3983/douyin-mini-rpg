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

function allReachableRoomsCanExtract(
  map: DungeonMapState,
  profile: DungeonProfile,
  sealedExitIds: ReadonlySet<string>,
): boolean {
  const roomsById = new Map(profile.rooms.map((room) => [room.id, room]))
  const reachableFromCurrent = new Set<string>()
  const forwardPending = [map.currentRoomId]

  while (forwardPending.length > 0) {
    const roomId = forwardPending.shift() as string
    if (reachableFromCurrent.has(roomId)) continue
    reachableFromCurrent.add(roomId)

    const room = roomsById.get(roomId)
    for (const exit of room?.exits ?? []) {
      if (!sealedExitIds.has(exit.id) && !reachableFromCurrent.has(exit.to)) {
        forwardPending.push(exit.to)
      }
    }
  }

  const reverseExits = new Map(profile.rooms.map((room) => [room.id, [] as string[]]))
  for (const room of profile.rooms) {
    for (const exit of room.exits) {
      if (!sealedExitIds.has(exit.id)) reverseExits.get(exit.to)?.push(room.id)
    }
  }

  const canExtract = new Set<string>()
  const reversePending = [...profile.extractionRoomIds]
  while (reversePending.length > 0) {
    const roomId = reversePending.shift() as string
    if (canExtract.has(roomId)) continue
    canExtract.add(roomId)
    for (const previousRoomId of reverseExits.get(roomId) ?? []) {
      if (!canExtract.has(previousRoomId)) reversePending.push(previousRoomId)
    }
  }

  return Array.from(reachableFromCurrent).every((roomId) => canExtract.has(roomId))
}

export function sealRoute(map: DungeonMapState, profile: DungeonProfile, exitId: string) {
  const knownExit = profile.rooms.some((room) => room.exits.some((exit) => exit.id === exitId))
  if (!knownExit) return { ok: false as const, reason: 'unknown-exit' as const }
  if (map.sealedExitIds.includes(exitId)) return { ok: true as const }

  const candidateSeals = new Set(map.sealedExitIds)
  candidateSeals.add(exitId)
  if (!allReachableRoomsCanExtract(map, profile, candidateSeals)) {
    return { ok: false as const, reason: 'would-strand-player' as const }
  }

  map.sealedExitIds.push(exitId)
  return { ok: true as const }
}
