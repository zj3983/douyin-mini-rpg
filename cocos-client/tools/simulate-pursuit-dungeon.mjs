import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  advanceDungeonRun,
  applyDungeonCommand,
  applyPursuerDamage,
  checkpointDungeonRun,
  createDungeonSession,
  restoreDungeonSession,
} from '../assets/Scripts/Core/Dungeon/DungeonSession.ts'

const profile = JSON.parse(readFileSync(new URL('../assets/resources/Data/dual-mode-slice.json', import.meta.url), 'utf8'))
const roomsById = new Map(profile.rooms.map((room) => [room.id, room]))

function hasVisited(view, roomId) {
  return view.visitedRoomIds.includes(roomId)
}

function hasSearched(view, roomId = view.room.id) {
  return view.searchedRoomIds.includes(roomId)
}

function route(view, destination) {
  const exit = view.exits.find((candidate) => candidate.to === destination)
  return exit ? { type: 'move', exitId: exit.id } : null
}

function firstRoute(view, destinations) {
  for (const destination of destinations) {
    const action = route(view, destination)
    if (action) return action
  }
  return null
}

export const safePolicy = Object.freeze({
  id: 'safe',
  decide(view) {
    if (view.room.kind === 'extraction') return { type: 'extract' }
    return firstRoute(view, ['f1-forest-combat', 'f2-bridge-combat', 'f2-damaged-exit']) ?? { type: 'wait' }
  },
})

export const balancedPolicy = Object.freeze({
  id: 'balanced',
  decide(view) {
    if (view.room.kind === 'extraction') return { type: 'extract' }
    if (view.room.id === 'f1-forest-combat') {
      if (!hasSearched(view)) return { type: 'search' }
      if (!hasVisited(view, 'f1-sealed-cache')) return route(view, 'f1-sealed-cache')
      if (!hasVisited(view, 'f1-alchemy')) return route(view, 'f1-alchemy')
      return route(view, 'f2-bridge-combat')
    }
    if (view.room.id === 'f1-sealed-cache' || view.room.id === 'f1-alchemy') {
      if (!hasSearched(view)) return { type: 'search' }
      return route(view, 'f1-forest-combat')
    }
    if (view.room.id === 'f2-bridge-combat') return route(view, 'f2-damaged-exit')
    return firstRoute(view, ['f1-forest-combat', 'f2-bridge-combat', 'f2-damaged-exit']) ?? { type: 'wait' }
  },
})

export const greedyPolicy = Object.freeze({
  id: 'greedy',
  decide(view) {
    if (view.room.id === 'f3-full-exit') return { type: 'extract' }
    if (view.room.id === 'f1-forest-combat') {
      if (!hasSearched(view)) return { type: 'search' }
      if (!hasVisited(view, 'f1-sealed-cache')) return route(view, 'f1-sealed-cache')
      return route(view, 'f2-bridge-combat')
    }
    if (view.room.id === 'f1-sealed-cache') {
      if (!hasSearched(view)) return { type: 'search' }
      return route(view, 'f1-forest-combat')
    }
    if (view.room.id === 'f2-bridge-combat') {
      if (!hasSearched(view)) return { type: 'search' }
      return route(view, 'f2-sword-array')
    }
    if (view.room.id === 'f2-sword-array') {
      if (!hasSearched(view)) return { type: 'search' }
      return route(view, 'f2-gate-elite')
    }
    if (view.room.id === 'f2-gate-elite') return route(view, 'f3-antechamber')
    if (view.room.id === 'f3-antechamber') return route(view, 'f3-altar')
    if (view.room.id === 'f3-altar') {
      if (!view.altarActivated) return { type: 'activate-altar' }
      if (!view.bossDefeated) return { type: 'fight-boss' }
      return route(view, 'f3-sword-vault')
    }
    if (view.room.id === 'f3-sword-vault') {
      if (!hasSearched(view)) return { type: 'search' }
      return route(view, 'f3-full-exit')
    }
    return firstRoute(view, ['f1-forest-combat', 'f2-bridge-combat']) ?? { type: 'wait' }
  },
})

function seededRandom(seed) {
  let state = (seed ^ 0x9e3779b9) >>> 0
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000)
}

function visibleExits(run, room) {
  const sealed = new Set(run.map.sealedExitIds)
  return room.exits
    .filter((exit) => !sealed.has(exit.id))
    .filter((exit) => exit.unlock !== 'boss-defeat' || run.pursuer.phase === 'defeated')
    .map((exit) => ({ id: exit.id, to: exit.to, cost: exit.cost, affordable: exit.cost <= run.doorCurrency }))
}

function hasEscapePath(run) {
  const queue = [run.map.currentRoomId]
  const seen = new Set(queue)
  while (queue.length > 0) {
    const roomId = queue.shift()
    if (profile.extractionRoomIds.includes(roomId)) return true
    const room = roomsById.get(roomId)
    for (const exit of visibleExits(run, room)) {
      if (!seen.has(exit.to)) {
        seen.add(exit.to)
        queue.push(exit.to)
      }
    }
  }
  return false
}

function publicView(run) {
  const room = roomsById.get(run.map.currentRoomId)
  return Object.freeze({
    room: Object.freeze({ id: room.id, floor: room.floor, kind: room.kind, risk: room.risk }),
    exits: Object.freeze(visibleExits(run, room).map((exit) => Object.freeze(exit))),
    visitedRoomIds: Object.freeze([...run.map.revealedRoomIds]),
    searchedRoomIds: Object.freeze([...run.searchedRoomIds]),
    doorCurrency: run.doorCurrency,
    inventory: Object.freeze(run.carriedLoot.map((loot) => loot.itemId)),
    pressurePhase: run.pressure.phase,
    altarActivated: run.pursuer.altarUnlocked,
    bossDefeated: run.pursuer.phase === 'defeated',
  })
}

function recordEvents(evidence, events) {
  for (const event of events ?? []) {
    if (event.type === 'pursuer-hunt-started') evidence.pursuitEncounters += 1
    if (event.type === 'pressure-phase-changed' && evidence.pressurePhases.at(-1) !== event.phase) {
      evidence.pressurePhases.push(event.phase)
    }
    if (event.type === 'extraction-completed') evidence.rewardCommitCount += 1
  }
}

function advanceSeeded(run, seconds, random, evidence) {
  let remaining = seconds
  while (remaining > 0.000001 && !['extracted', 'defeated', 'abandoned'].includes(run.phase)) {
    const delta = Math.min(remaining, 0.025 + random() * 0.075)
    const result = advanceDungeonRun(run, delta, { paused: false })
    evidence.frameSteps += 1
    recordEvents(evidence, result.events)
    remaining -= delta
  }
}

function completeActivePursuit(run, random, evidence) {
  while (['first-hunt', 'second-hunt', 'final-fight'].includes(run.pursuer.phase)) {
    const damage = 28 + Math.floor(random() * 83)
    evidence.damageHits += 1
    recordEvents(evidence, applyPursuerDamage(run, damage).events)
  }
}

export function simulateDungeon(seed, policy) {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new TypeError('seed must be a nonnegative safe integer')
  if (!policy || typeof policy.decide !== 'function') throw new TypeError('policy must provide decide(view)')

  const random = seededRandom(seed)
  let run = createDungeonSession(profile, seed)
  const evidence = {
    frameSteps: 0,
    damageHits: 0,
    pursuitEncounters: 0,
    pressurePhases: ['calm'],
    rewardCommitCount: 0,
    checkpointRestoreCount: 0,
  }
  let minimumDoorCurrency = run.doorCurrency
  let paidDoorCount = 0
  let escapePathAlwaysAvailable = true
  let delayedForPressure = false
  let terminalReason = null

  for (let step = 0; step < 120 && run.phase === 'exploring'; step += 1) {
    escapePathAlwaysAvailable &&= hasEscapePath(run)
    completeActivePursuit(run, random, evidence)

    const shouldDelayBalanced = policy.id === 'balanced'
      && run.searchedRoomIds.includes('f1-alchemy')
      && run.pursuer.phase === 'dormant'
    const shouldDelayGreedy = policy.id === 'greedy'
      && run.searchedRoomIds.includes('f2-sword-array')
      && run.pursuer.phase === 'dormant'
    if (!delayedForPressure && (shouldDelayBalanced || shouldDelayGreedy)) {
      advanceSeeded(run, 72 + random() * 12, random, evidence)
      delayedForPressure = true
      completeActivePursuit(run, random, evidence)
    }

    const room = roomsById.get(run.map.currentRoomId)
    const action = policy.decide(publicView(run))
    let result = null
    if (action?.type === 'search') result = applyDungeonCommand(run, { type: 'search' })
    if (action?.type === 'activate-altar') result = applyDungeonCommand(run, { type: 'activate-altar' })
    if (action?.type === 'fight-boss') {
      completeActivePursuit(run, random, evidence)
      continue
    }
    if (action?.type === 'extract') {
      result = applyDungeonCommand(run, { type: 'begin-extraction' })
      if (result.accepted) advanceSeeded(run, 3.5, random, evidence)
    }
    if (action?.type === 'move') {
      const exit = room.exits.find((candidate) => candidate.id === action.exitId)
      if (exit?.cost > 0) paidDoorCount += 1
      result = applyDungeonCommand(run, { type: 'choose-exit', exitId: action.exitId })
    }

    if (!result?.accepted) {
      terminalReason = result?.reason ?? 'policy-stalled'
      break
    }
    recordEvents(evidence, result.events)
    minimumDoorCurrency = Math.min(minimumDoorCurrency, run.doorCurrency)

    if (evidence.checkpointRestoreCount === 0 || random() < 0.28) {
      run = restoreDungeonSession(profile, JSON.parse(JSON.stringify(checkpointDungeonRun(run))))
      evidence.checkpointRestoreCount += 1
    }
  }

  if (run.phase === 'extracted') {
    terminalReason = run.extraction.roomId === profile.finalExtractionRoomId
      ? 'full-extraction-complete'
      : 'damaged-extraction-complete'
    advanceSeeded(run, 1 + random(), random, evidence)
  } else if (!terminalReason) {
    terminalReason = run.phase === 'exploring' ? 'step-limit' : run.phase
  }
  escapePathAlwaysAvailable &&= hasEscapePath(run)

  const visitedRoomIds = [...run.map.revealedRoomIds]
  const searchedRoomIds = [...run.searchedRoomIds]
  const inventory = run.carriedLoot.map((loot) => loot.itemId)
  const exitKind = run.phase === 'extracted'
    ? run.extraction.roomId === profile.finalExtractionRoomId ? 'full' : 'damaged'
    : null
  return Object.freeze({
    seed,
    policy: policy.id ?? 'custom',
    phase: run.phase,
    earlyExtraction: run.phase === 'extracted' && exitKind === 'damaged',
    bossDefeated: run.pursuer.phase === 'defeated',
    minimumDoorCurrency,
    rewardCommitCount: evidence.rewardCommitCount,
    escapePathAlwaysAvailable,
    exitKind,
    visitedRoomIds: Object.freeze(visitedRoomIds),
    searchedRoomIds: Object.freeze(searchedRoomIds),
    searchCount: searchedRoomIds.length,
    paidDoorCount,
    pursuitEncounters: evidence.pursuitEncounters,
    obtainedArtifactOrAttachment: inventory.some((itemId) => itemId === 'flying-sword' || itemId.endsWith('-fitting')),
    altarActivated: run.pursuer.altarUnlocked,
    pressurePhases: Object.freeze([...evidence.pressurePhases]),
    terminalReason,
    doorCurrency: run.doorCurrency,
    inventory: Object.freeze(inventory),
    usedProductionSession: true,
    checkpointRestoreCount: evidence.checkpointRestoreCount,
    simulationFingerprint: `${evidence.frameSteps}:${evidence.damageHits}:${evidence.checkpointRestoreCount}`,
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const policies = [safePolicy, balancedPolicy, greedyPolicy]
  const reports = Array.from({ length: 100 }, (_, seed) => simulateDungeon(seed, policies[seed % policies.length]))
  const summary = Object.fromEntries(policies.map((policy) => {
    const samples = reports.filter((report) => report.policy === policy.id)
    return [policy.id, {
      runs: samples.length,
      extracted: samples.filter((report) => report.phase === 'extracted').length,
      averageSearches: samples.reduce((total, report) => total + report.searchCount, 0) / samples.length,
    }]
  }))
  console.log(JSON.stringify({ ok: reports.every((report) => report.phase === 'extracted'), summary }, null, 2))
}
