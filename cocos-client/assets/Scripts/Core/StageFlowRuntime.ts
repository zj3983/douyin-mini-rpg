export type StageFlowPhase = 'clearing' | 'draining' | 'boss' | 'settled' | 'defeated'
export type StageFlowCommand = 'beginDrain' | 'spawnBoss' | 'settle' | null

export interface StageFlowState {
  phase: StageFlowPhase
  generation: number
  defeatTarget: number
  ordinaryDefeats: number
}

export interface StageFlowTransition {
  changed: boolean
  command: StageFlowCommand
}

const unchanged = (): StageFlowTransition => ({ changed: false, command: null })

export function createStageFlow(defeatTarget: number, generation = 0): StageFlowState {
  return {
    phase: 'clearing',
    generation: Math.max(0, Math.floor(generation)),
    defeatTarget: Math.max(1, Math.floor(defeatTarget)),
    ordinaryDefeats: 0,
  }
}

export function recordOrdinaryDefeat(state: StageFlowState): StageFlowTransition {
  if (state.phase !== 'clearing') return unchanged()

  state.ordinaryDefeats += 1
  if (state.ordinaryDefeats < state.defeatTarget) {
    return { changed: true, command: null }
  }

  state.phase = 'draining'
  return { changed: true, command: 'beginDrain' }
}

export function completeDrain(state: StageFlowState, generation: number): StageFlowTransition {
  if (state.phase !== 'draining' || state.generation !== generation) return unchanged()

  state.phase = 'boss'
  return { changed: true, command: 'spawnBoss' }
}

export function recordBossDefeat(state: StageFlowState): StageFlowTransition {
  if (state.phase !== 'boss') return unchanged()

  state.phase = 'settled'
  return { changed: true, command: 'settle' }
}

export function markPlayerDefeated(state: StageFlowState): StageFlowTransition {
  if (state.phase === 'settled' || state.phase === 'defeated') return unchanged()

  state.phase = 'defeated'
  return { changed: true, command: null }
}
