const requiredNodes = [
  'Canvas/WorldRoot/BattleRoot/Runtime',
  'Canvas/WorldRoot/BattleRoot/ActorLayer/EnemySpawner',
  'Canvas/WorldRoot/BattleRoot/EffectLayer/FlyingSwordSkill',
  'Canvas/WorldRoot/BattleRoot/HudLayer/StageClearPanel',
  'Canvas/WorldRoot/BattleRoot/DropLayer/SoulOrbPool',
  'Canvas/DungeonRoot',
  'Canvas/DungeonRoot/DungeonInteractButton',
  'Canvas/DualModeGameController',
]

const requiredComponents = [
  'BattleRuntimeController',
  'EnemySpawner',
  'FlyingSwordSkill',
  'StageClearPanelController',
  'NodePoolController',
  'DungeonRunController',
  'DualModeGameController',
]

const requiredRuntimeBindings = [
  'designData',
  'stageClearPanel',
  'enemySpawner',
  'soulOrbPool',
  'damageNumberPool',
  'bossSkillEffectPool',
  'dualMode',
]

const requiredFlyingSwordBindings = [
  'battleRuntime',
  'sword',
]

const controllerBindingContracts = [
  {
    component: 'DualModeGameController',
    required: ['worldRoot', 'dungeonRoot', 'dungeonRun'],
  },
  {
    component: 'DungeonRunController',
    required: ['profileData', 'roomLabel'],
  },
]

export function validateSceneBlueprint(blueprint) {
  const errors = []
  const nodes = Array.isArray(blueprint?.nodes) ? blueprint.nodes : []
  const nodePaths = new Set(nodes.map((node) => node.path))
  const componentNames = new Set(nodes.flatMap((node) => node.components ?? []))

  for (const path of requiredNodes) {
    if (!nodePaths.has(path)) errors.push(`missing node: ${path}`)
  }

  for (const component of requiredComponents) {
    if (!componentNames.has(component)) errors.push(`missing component: ${component}`)
  }

  const runtimeNode = nodes.find((node) => node.path === 'Canvas/WorldRoot/BattleRoot/Runtime')
  const runtimeBindings = runtimeNode?.bindings ?? {}
  for (const binding of requiredRuntimeBindings) {
    if (!runtimeBindings[binding]) errors.push(`missing BattleRuntimeController binding: ${binding}`)
  }

  const flyingSwordNode = nodes.find((node) => node.path === 'Canvas/WorldRoot/BattleRoot/EffectLayer/FlyingSwordSkill')
  const flyingSwordBindings = flyingSwordNode?.bindings ?? {}
  for (const binding of requiredFlyingSwordBindings) {
    if (!flyingSwordBindings[binding]) errors.push(`missing FlyingSwordSkill binding: ${binding}`)
  }

  for (const contract of controllerBindingContracts) {
    const node = nodes.find((candidate) => candidate.components?.includes(contract.component))
    const bindings = node?.bindings ?? {}
    const allowed = new Set(contract.required)
    for (const binding of contract.required) {
      if (!bindings[binding]) errors.push(`missing ${contract.component} binding: ${binding}`)
    }
    for (const binding of Object.keys(bindings)) {
      if (!allowed.has(binding)) errors.push(`unknown ${contract.component} binding: ${binding}`)
    }
  }

  return { ok: errors.length === 0, errors }
}
