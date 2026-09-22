export interface Point2 { x: number; y: number }
export interface BattleRect { minX: number; maxX: number; minY: number; maxY: number }
export type EnemyKind = 'moss-wolf' | 'green-wing-moth' | 'bamboo-warden'
export type EnemyState = 'spawn' | 'select-position' | 'telegraph' | 'attack' | 'recovery' | 'hurt' | 'death'
export type CombatEvent =
  | { type: 'stage-entered'; stageId: number; at: number }
  | { type: 'animation-requested'; actorId: string; action: string; at: number }
  | { type: 'attack-telegraphed'; enemyId: number; attackId: string; area: BattleRect; at: number }
  | { type: 'damage-resolved'; sourceId: string; targetId: string; amount: number; at: number }
  | { type: 'enemy-defeated'; enemyId: number; at: number }
  | { type: 'boss-entered'; enemyId: number; at: number }
  | { type: 'stage-settled'; stageId: number; at: number }

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBattleRect(value: unknown): value is BattleRect {
  return isRecord(value)
    && isFiniteNumber(value.minX)
    && isFiniteNumber(value.maxX)
    && isFiniteNumber(value.minY)
    && isFiniteNumber(value.maxY)
}

export function isCombatEvent(value: unknown): value is CombatEvent {
  if (!isRecord(value) || !isFiniteNumber(value.at)) return false

  switch (value.type) {
    case 'stage-entered':
    case 'stage-settled':
      return typeof value.stageId === 'number'
    case 'animation-requested':
      return typeof value.actorId === 'string' && typeof value.action === 'string'
    case 'attack-telegraphed':
      return typeof value.enemyId === 'number'
        && typeof value.attackId === 'string'
        && isBattleRect(value.area)
    case 'damage-resolved':
      return typeof value.sourceId === 'string'
        && typeof value.targetId === 'string'
        && typeof value.amount === 'number'
    case 'enemy-defeated':
    case 'boss-entered':
      return typeof value.enemyId === 'number'
    default:
      return false
  }
}
