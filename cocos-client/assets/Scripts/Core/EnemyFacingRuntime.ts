export type EnemyFacing = -1 | 1

export function updateEnemyFacing(
  previous: EnemyFacing,
  enemyX: number,
  playerX: number,
  deadZone: number,
): EnemyFacing {
  if (!Number.isFinite(enemyX) || !Number.isFinite(playerX)) return previous
  const threshold = Number.isFinite(deadZone) ? Math.max(0, deadZone) : 0
  const delta = playerX - enemyX
  if (Math.abs(delta) <= threshold) return previous
  return delta < 0 ? -1 : 1
}
