const unchanged = () => ({ changed: false, command: null })

export function createStageFlow(defeatTarget, generation = 0) {
  return {
    phase: 'clearing',
    generation: Math.max(0, Math.floor(generation)),
    defeatTarget: Math.max(1, Math.floor(defeatTarget)),
    ordinaryDefeats: 0,
  }
}

export function recordOrdinaryDefeat(state) {
  if (state.phase !== 'clearing') return unchanged()

  state.ordinaryDefeats += 1
  if (state.ordinaryDefeats < state.defeatTarget) {
    return { changed: true, command: null }
  }

  state.phase = 'draining'
  return { changed: true, command: 'beginDrain' }
}

export function completeDrain(state, generation) {
  if (state.phase !== 'draining' || state.generation !== generation) return unchanged()

  state.phase = 'boss'
  return { changed: true, command: 'spawnBoss' }
}

export function recordBossDefeat(state) {
  if (state.phase !== 'boss') return unchanged()

  state.phase = 'settled'
  return { changed: true, command: 'settle' }
}

export function markPlayerDefeated(state) {
  if (state.phase === 'settled' || state.phase === 'defeated') return unchanged()

  state.phase = 'defeated'
  return { changed: true, command: null }
}
