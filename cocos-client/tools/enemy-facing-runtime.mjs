export function updateEnemyFacing(previous, enemyX, playerX, deadZone) {
  if (!Number.isFinite(enemyX) || !Number.isFinite(playerX)) return previous
  const threshold = Number.isFinite(deadZone) ? Math.max(0, deadZone) : 0
  const delta = playerX - enemyX
  if (Math.abs(delta) <= threshold) return previous
  return delta < 0 ? -1 : 1
}
