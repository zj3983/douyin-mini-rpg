const requiredNodes = [
  'Canvas/BattleRoot/Runtime',
  'Canvas/BattleRoot/ActorLayer/EnemySpawner',
  'Canvas/BattleRoot/EffectLayer/FlyingSwordSkill',
  'Canvas/BattleRoot/HudLayer/StatusLabel',
  'Canvas/BattleRoot/HudLayer/StageClearPanel',
  'Canvas/Pools/SoulOrbPool',
  'Canvas/Pools/DamageNumberPool',
  'Canvas/Pools/BossSkillEffectPool',
  'Canvas/Pools/EnemyPool',
]

const requiredComponents = [
  'BattleRuntimeController',
  'EnemySpawner',
  'FlyingSwordSkill',
  'StageClearPanelController',
  'NodePoolController',
]

const requiredRuntimeBindings = [
  'designData',
  'statusLabel',
  'stageClearPanel',
  'enemySpawner',
  'soulOrbPool',
  'damageNumberPool',
  'bossSkillEffectPool',
]

const requiredFlyingSwordBindings = [
  'battleRuntime',
  'sword',
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

  const runtimeNode = nodes.find((node) => node.path === 'Canvas/BattleRoot/Runtime')
  const runtimeBindings = runtimeNode?.bindings ?? {}
  for (const binding of requiredRuntimeBindings) {
    if (!runtimeBindings[binding]) errors.push(`missing BattleRuntimeController binding: ${binding}`)
  }

  const flyingSwordNode = nodes.find((node) => node.path === 'Canvas/BattleRoot/EffectLayer/FlyingSwordSkill')
  const flyingSwordBindings = flyingSwordNode?.bindings ?? {}
  for (const binding of requiredFlyingSwordBindings) {
    if (!flyingSwordBindings[binding]) errors.push(`missing FlyingSwordSkill binding: ${binding}`)
  }

  return { ok: errors.length === 0, errors }
}
