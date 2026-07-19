import type { FlyingSwordConfig } from './ArtifactRuntime.ts'
import type { BossConfig } from './BossBrain.ts'
import type { MothBehavior, WolfBehavior } from './EnemyBrain.ts'
import type { BattleBounds } from './Geometry.ts'
import type { PlayerMotorConfig } from './PlayerMotor.ts'

export type SpawnKind = 'wolf' | 'moth'

export interface WaveSpec {
  start: number
  end: number
  spawnInterval: number
  composition: readonly SpawnKind[]
}

export interface StageOneProfile {
  id: number
  name: string
  bounds: BattleBounds
  player: PlayerMotorConfig
  playerInvincibleSeconds: number
  openingSeconds: number
  bossEntryTime: number
  drainSeconds: number
  maxAliveEnemies: number
  waves: readonly WaveSpec[]
  wolf: WolfBehavior
  moth: MothBehavior
  boss: BossConfig
  sword: FlyingSwordConfig
  enemySpawn: { x: number; groundY: readonly [number, number]; airY: readonly [number, number] }
  soulPerKill: number
  bossSoulAmount: number
  enemyDeathRecycleSeconds: number
}

const bounds: BattleBounds = { minX: -330, maxX: 330, minY: -420, maxY: 460 }

export const STAGE_ONE: StageOneProfile = {
  id: 1,
  name: '青苔丘陵',
  bounds,
  player: { bounds, speed: 280, spawn: { x: -260, y: -80 }, maxHp: 260, radius: 24 },
  playerInvincibleSeconds: 0.5,
  openingSeconds: 1.0,
  bossEntryTime: 58,
  drainSeconds: 2,
  maxAliveEnemies: 18,
  waves: [
    { start: 0, end: 15, spawnInterval: 2.4, composition: ['wolf', 'wolf', 'moth'] },
    { start: 15, end: 40, spawnInterval: 1.5, composition: ['wolf', 'moth', 'wolf', 'moth'] },
    { start: 40, end: 58, spawnInterval: 1.2, composition: ['wolf', 'wolf', 'moth', 'wolf'] },
  ],
  wolf: {
    kind: 'wolf', maxHp: 110, radius: 26, moveSpeed: 130, flankOffsetY: 90, postOffsetX: 130,
    pounceRange: 210, telegraphSeconds: 0.6, pounceSpeed: 540, pounceSeconds: 0.45,
    recoverySeconds: 0.5, whiffRecoverySeconds: 0.9, touchDamage: 16, decisionHz: 8, spawnSeconds: 0.5,
  },
  moth: {
    kind: 'moth', maxHp: 80, radius: 22, moveSpeed: 150, altitudeMin: 60, altitudeMax: 240,
    postOffsetX: 140, attackRange: 280, minSeparation: 90, telegraphSeconds: 0.55,
    diveSpeed: 580, diveSeconds: 0.5, projectileSpeed: 320, projectileRadius: 12,
    projectileDamage: 14, touchDamage: 12, recoverySeconds: 0.6, decisionHz: 9, spawnSeconds: 0.6,
  },
  boss: {
    spawn: { x: 420, y: -40 }, anchor: { x: 170, y: -20 },
    maxHp: 1500, radius: 56, moveSpeed: 60, entrySeconds: 1.5, idleSeconds: 1.1,
    decisionHz: 8, phaseTwoHpFraction: 0.5,
    sweep: { telegraph: 0.8, active: 0.25, recovery: 0.7, radius: 260, halfAngleRadians: 0.9, damage: 24 },
    spikes: { count: 3, interval: 0.35, markerDelay: 0.7, radius: 60, damage: 20, recovery: 0.6 },
    roar: { telegraph: 0.9, waveSpeed: 420, bandWidth: 70, maxRadius: 520, gapHalfAngleRadians: 0.55, damage: 28, recovery: 0.8 },
  },
  sword: {
    damage: 55, speed: 900, width: 30, pierce: 3, outboundDistance: 160,
    curveHeight: 90, cooldownSeconds: 0.3, returnArriveRadius: 28,
  },
  enemySpawn: { x: 400, groundY: [-200, -60], airY: [80, 220] },
  soulPerKill: 1,
  bossSoulAmount: 5,
  enemyDeathRecycleSeconds: 0.6,
}
