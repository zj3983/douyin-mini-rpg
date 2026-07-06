export function heroScreenXForWidth(width: number) {
  const desired = width * 0.38
  return Math.max(118, Math.min(desired, width * 0.46))
}

export function actorRenderScaleForHeight(height: number) {
  if (!Number.isFinite(height) || height <= 0) return 1
  return Math.max(0.58, Math.min(1, height / 440))
}

export function battleGroundY(height: number) {
  if (!Number.isFinite(height) || height <= 0) return 0
  const scale = actorRenderScaleForHeight(height)
  const preferred = height * 0.72
  const safeTop = Math.max(20, height * 0.07)
  const actionSheetHeight = 308
  const actionSheetDrawOffset = 13
  const swordBottom = 22
  const minForFullHero = safeTop + (actionSheetHeight - actionSheetDrawOffset) * scale
  const maxForSword = height - 8 - swordBottom * scale
  return Math.min(Math.max(preferred, minForFullHero), maxForSword)
}
