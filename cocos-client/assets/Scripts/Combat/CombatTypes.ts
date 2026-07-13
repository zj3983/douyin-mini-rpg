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

export function isCombatEvent(value: unknown): value is CombatEvent {
  return Boolean(value && typeof value === 'object' && 'type' in value && 'at' in value)
}
