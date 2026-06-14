export const characterTechniqueCatalog = {
  sword: [
    {
      id: 'tech-sword-pierce',
      key: 'swordPierce',
      title: '御剑·穿云',
      color: '#67e8f9',
      iconBase: 'blade',
      desc: '御剑术穿刺目标 +1，出剑距离和主剑伤害提升。',
    },
    {
      id: 'tech-sword-return',
      key: 'swordReturn',
      title: '御剑·回锋',
      color: '#fef08a',
      iconBase: 'sweep',
      desc: '飞剑回身会二次刮过敌人，御剑术冷却缩短。',
    },
    {
      id: 'tech-sword-shadow',
      key: 'swordShadow',
      title: '御剑·分光',
      color: '#bae6fd',
      iconBase: 'orbit',
      desc: '御剑术附带剑影，同时飞出更多分光剑影。',
    },
  ],
  thunder: [
    {
      id: 'tech-thunder-mark',
      key: 'thunderMark',
      title: '雷印·追魂',
      color: '#38bdf8',
      iconBase: 'chain',
      desc: '雷印诀锁定目标 +1，第一道雷印伤害提升。',
    },
    {
      id: 'tech-thunder-echo',
      key: 'thunderEcho',
      title: '雷印·回响',
      color: '#bae6fd',
      iconBase: 'nova',
      desc: '雷印弹射衰减降低，命中后额外震荡附近敌人。',
    },
    {
      id: 'tech-thunder-cloud',
      key: 'thunderCloud',
      title: '雷印·天罚',
      color: '#e0f2fe',
      iconBase: 'quick',
      desc: '雷印诀冷却缩短，高阶时落下小型雷云。',
    },
  ],
  flame: [
    {
      id: 'tech-flame-focus',
      key: 'flameFocus',
      title: '符火·聚焰',
      color: '#fb923c',
      iconBase: 'flame',
      desc: '莲火符爆心伤害提升，并优先点燃精英和 Boss。',
    },
    {
      id: 'tech-flame-spread',
      key: 'flameSpread',
      title: '符火·连爆',
      color: '#fed7aa',
      iconBase: 'nova',
      desc: '莲火符命中后向周围分裂符火，清怪范围扩大。',
    },
    {
      id: 'tech-flame-sea',
      key: 'flameSea',
      title: '符火·莲域',
      color: '#f97316',
      iconBase: 'gate',
      desc: '莲火残焰停留更久，高阶时形成铺场火域。',
    },
  ],
  wood: [
    {
      id: 'tech-wood-heal',
      key: 'woodHeal',
      title: '回元·生息',
      color: '#86efac',
      iconBase: 'guard',
      desc: '回元息治疗量提升，低血量时更容易触发。',
    },
    {
      id: 'tech-wood-ward',
      key: 'woodWard',
      title: '回元·护脉',
      color: '#bbf7d0',
      iconBase: 'shield',
      desc: '回元息释放护身灵环，震退并削弱近身敌人。',
    },
    {
      id: 'tech-wood-bloom',
      key: 'woodBloom',
      title: '回元·青华',
      color: '#5eead4',
      iconBase: 'orbit',
      desc: '回元灵气扩散到更远范围，兼顾续航和清怪。',
    },
  ],
} as const

export type ProgressionCharacterId = keyof typeof characterTechniqueCatalog
export type CharacterTechniqueSpec = (typeof characterTechniqueCatalog)[ProgressionCharacterId][number]

export function techniqueSpecsForCharacter(characterId: ProgressionCharacterId) {
  return characterTechniqueCatalog[characterId]
}
