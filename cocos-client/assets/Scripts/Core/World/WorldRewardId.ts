let sessionSequence = 0

function canonicalCounter(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

export function createWorldRewardSessionId(now = Date.now(), random = Math.random()): string {
  sessionSequence += 1
  const timePart = canonicalCounter(now).toString(36)
  const randomPart = canonicalCounter(Math.abs(random) * 0x100000000).toString(36)
  return `${timePart}-${randomPart}-${sessionSequence.toString(36)}`
}

export function worldRewardId(stage: number, sessionId: string, generation: number): string {
  const canonicalSession = sessionId.trim() || 'unknown'
  return `world-${Math.max(1, canonicalCounter(stage))}-session-${canonicalSession}-attempt-${canonicalCounter(generation)}`
}
