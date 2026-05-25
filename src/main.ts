import './style.css'

type Rarity = '普通' | '稀有' | '史诗' | '传说'
type Mode = 'wild' | 'dungeon'
type AppPage = 'battle' | 'dungeon' | 'gacha' | 'equip' | 'bag' | 'artifact'
type Slot = 'weapon' | 'armor' | 'core'
type AttackSource = 'manual' | 'auto' | 'skill'
type EvolutionTier = '初阶' | '进阶' | '高阶'
type EnemyKind = 'slime' | 'bat' | 'wolf' | 'crystal' | 'warden'
type CharacterId = 'sword' | 'thunder' | 'flame' | 'wood'
type ArtifactKey = 'slash' | 'burst' | 'regen' | 'chain' | 'orbit' | 'flame'
type DungeonId = 'mossCave' | 'starHall' | 'mistMaze' | 'crystalMine' | 'bloodRift' | 'kingTomb'

interface Vec { x: number; y: number }
interface Enemy extends Vec { id: number; hp: number; maxHp: number; speed: number; elite: boolean; kind: EnemyKind; boss?: boolean; hit: number }
interface FloatingText extends Vec { text: string; color: string; life: number }
type EffectKind = 'ring' | 'slash' | 'blade' | 'shockwave' | 'bolt' | 'orbit' | 'flare' | 'swordrain' | 'thunderstorm' | 'firesea' | 'impact' | 'heal'
interface Effect extends Vec { radius: number; color: string; life: number; maxLife: number; kind?: EffectKind; angle?: number }
type ParticleKind = 'spark' | 'ember' | 'soul' | 'shard' | 'rune'
interface Particle extends Vec { vx: number; vy: number; size: number; color: string; life: number; maxLife: number; kind: ParticleKind; spin: number }
interface ScreenFlash { color: string; life: number; maxLife: number; strength: number }
interface SoulOrb extends Vec { id: number; value: number; life: number; phase: number }
interface Reward { name: string; rarity: Rarity; count: number; slot?: Slot; atk?: number; hp?: number; skill?: number; characterId?: CharacterId; artifact?: ArtifactKey }
interface SkillTree { slash: number; burst: number; regen: number; chain: number; orbit: number; flame: number; points: number }
interface MutationTree { swordRide: number; thunderFork: number; swordDomain: number; flameLotus: number }
interface CharacterDef { id: CharacterId; name: string; title: string; need: number; color: string; portrait: string; battle: string; starter: Partial<SkillTree>; desc: string }
interface ArtifactDef { key: ArtifactKey; name: string; type: string; color: string; rarity: Rarity; iconId: string; image: string; desc: string; source: string; max: number }
interface DungeonDef {
  id: DungeonId
  name: string
  subtitle: string
  themeIndex: number
  unlockLevel: number
  timeLimit: number
  killGoal: number
  materialGoal: number
  ticketBonus: number
  expBonus: number
  skillBonus: number
  artifactFocus: ArtifactKey[]
  trait: string
  threat: string
  color: string
}
interface StageTheme {
  name: string
  subtitle: string
  dungeon: string
  sky: [string, string, string, string]
  mountain: string
  cloud: string
  ground: string
  groundLine: string
  detail: string
  accent: string
  enemy: string
  enemyDark: string
  enemyNames: Record<EnemyKind, string>
}
interface EvolutionOption { id: string; iconId: string; title: string; desc: string; color: string; tier: EvolutionTier; mutation?: boolean; apply: () => void }
interface EvolutionTemplate { id: string; title: string; color: string; build: (rank: number, tier: EvolutionTier) => EvolutionOption }
interface SaveData {
  hero: { x: number; y: number; hp: number; baseHp: number; level: number; exp: number; baseAtk: number; skillPower: number }
  gear: Record<Slot, Reward | null>
  skills: SkillTree
  kills: number
  tickets: number
  dungeonEntries?: number
  pity: number
  wave: number
  questClaimed: boolean
  lastDaily: string
  savedAt: number
  bag: Reward[]
  guideStep: number
  soulProgress?: number
  soulLevel?: number
  soulExp?: number
  autoHaste?: number
  autoExplore?: boolean
  mutations?: Partial<MutationTree>
  activeCharacter?: CharacterId
  ownedCharacters?: CharacterId[]
  characterShards?: Partial<Record<CharacterId, number>>
  artifacts?: Partial<Record<ArtifactKey, number>>
  activeDungeon?: DungeonId
}

interface PlayerProfile {
  id: string
  name: string
  pin: string
  createdAt: number
  lastLoginAt: number
}

interface ProfileIndex {
  activeId: string | null
  profiles: PlayerProfile[]
}

const rarityColor: Record<Rarity, string> = {
  普通: '#dbeafe',
  稀有: '#5eead4',
  史诗: '#c084fc',
  传说: '#facc15',
}

const rarityRank: Record<Rarity, number> = { 普通: 1, 稀有: 2, 史诗: 3, 传说: 4 }
const baseMutations: MutationTree = { swordRide: 0, thunderFork: 0, swordDomain: 0, flameLotus: 0 }
const baseCharacterShards: Record<CharacterId, number> = { sword: 0, thunder: 0, flame: 0, wood: 0 }
const artifactKeys: ArtifactKey[] = ['slash', 'burst', 'chain', 'orbit', 'flame', 'regen']
const baseArtifacts: Record<ArtifactKey, number> = { slash: 0, burst: 0, regen: 0, chain: 0, orbit: 0, flame: 0 }

const stageSpan = 620
const stageThemes: StageTheme[] = [
  {
    name: '青苔丘陵',
    subtitle: '灵雾初醒',
    dungeon: '青苔丘陵·灵根洞天',
    sky: ['#dff7ff', '#7dd3fc', '#315f6f', '#0f2a24'],
    mountain: '#1f7a6b',
    cloud: 'rgba(236,254,255,.72)',
    ground: '#18382b',
    groundLine: 'rgba(190,242,100,.34)',
    detail: '#86efac',
    accent: '#5eead4',
    enemy: '#22c55e',
    enemyDark: '#14532d',
    enemyNames: { slime: '青苔灵魄', bat: '纸翼妖蝠', wolf: '影牙妖狼', crystal: '灵晶壳兽', warden: '青冥守门人' },
  },
  {
    name: '残星哨站',
    subtitle: '旧服残垣',
    dungeon: '残星哨站·废阵回廊',
    sky: ['#c7d2fe', '#60a5fa', '#1e3a8a', '#111827'],
    mountain: '#334155',
    cloud: 'rgba(219,234,254,.6)',
    ground: '#172033',
    groundLine: 'rgba(250,204,21,.3)',
    detail: '#facc15',
    accent: '#facc15',
    enemy: '#38bdf8',
    enemyDark: '#1e3a8a',
    enemyNames: { slime: '残星傀儡', bat: '裂隙飞魇', wolf: '铁脊妖狼', crystal: '星核晶卫', warden: '星门镇守' },
  },
  {
    name: '雾灯林道',
    subtitle: '幽灯引路',
    dungeon: '雾灯林道·迷灯幻境',
    sky: ['#ecfeff', '#99f6e4', '#155e75', '#052e2b'],
    mountain: '#0f766e',
    cloud: 'rgba(204,251,241,.68)',
    ground: '#102f2c',
    groundLine: 'rgba(45,212,191,.34)',
    detail: '#2dd4bf',
    accent: '#99f6e4',
    enemy: '#14b8a6',
    enemyDark: '#134e4a',
    enemyNames: { slime: '雾灯灵魄', bat: '雾翼魇蝠', wolf: '林魇牙兽', crystal: '幽苔晶精', warden: '雾灯司命' },
  },
  {
    name: '晶脉矿坑',
    subtitle: '紫晶回响',
    dungeon: '晶脉矿坑·地心晶窟',
    sky: ['#ede9fe', '#a78bfa', '#4c1d95', '#12091f'],
    mountain: '#5b21b6',
    cloud: 'rgba(221,214,254,.54)',
    ground: '#211827',
    groundLine: 'rgba(196,181,253,.36)',
    detail: '#c084fc',
    accent: '#a78bfa',
    enemy: '#a78bfa',
    enemyDark: '#4c1d95',
    enemyNames: { slime: '晶尘灵团', bat: '晶翼蝠', wolf: '矿脊魇兽', crystal: '紫晶甲卫', warden: '晶脉守魁' },
  },
  {
    name: '裂隙前线',
    subtitle: '天痕燃烧',
    dungeon: '裂隙前线·血月断层',
    sky: ['#fee2e2', '#fb7185', '#7f1d1d', '#1f0f12'],
    mountain: '#7f1d1d',
    cloud: 'rgba(254,202,202,.5)',
    ground: '#261315',
    groundLine: 'rgba(251,113,133,.38)',
    detail: '#fb7185',
    accent: '#fb923c',
    enemy: '#f43f5e',
    enemyDark: '#7f1d1d',
    enemyNames: { slime: '裂隙血魄', bat: '赤翼妖蝠', wolf: '血牙魇狼', crystal: '裂晶魔卫', warden: '裂隙守门人' },
  },
  {
    name: '古王庭外环',
    subtitle: '金阙残梦',
    dungeon: '古王庭外环·铜阙墓道',
    sky: ['#fef3c7', '#fbbf24', '#78350f', '#17120a'],
    mountain: '#92400e',
    cloud: 'rgba(254,243,199,.52)',
    ground: '#2a1e10',
    groundLine: 'rgba(251,191,36,.34)',
    detail: '#fbbf24',
    accent: '#fde68a',
    enemy: '#f59e0b',
    enemyDark: '#78350f',
    enemyNames: { slime: '王庭残魂', bat: '金羽魇蝠', wolf: '铜甲狻影', crystal: '王庭晶俑', warden: '古庭镇灵' },
  },
  {
    name: '太虚星海',
    subtitle: '星门尽头',
    dungeon: '太虚星海·无垠星牢',
    sky: ['#dbeafe', '#38bdf8', '#172554', '#020617'],
    mountain: '#1e40af',
    cloud: 'rgba(186,230,253,.46)',
    ground: '#0b1220',
    groundLine: 'rgba(125,211,252,.34)',
    detail: '#67e8f9',
    accent: '#e0f2fe',
    enemy: '#67e8f9',
    enemyDark: '#172554',
    enemyNames: { slime: '星海灵魄', bat: '星翼魇蝠', wolf: '虚空牙兽', crystal: '星核晶灵', warden: '太虚守门人' },
  },
]
const stageNames = stageThemes.map((theme) => theme.name)

const dungeonDefs: DungeonDef[] = [
  {
    id: 'mossCave',
    name: '灵根洞天',
    subtitle: '青苔丘陵下的初阶灵脉',
    themeIndex: 0,
    unlockLevel: 1,
    timeLimit: 150,
    killGoal: 10,
    materialGoal: 3,
    ticketBonus: 4,
    expBonus: 30,
    skillBonus: 2,
    artifactFocus: ['slash', 'regen'],
    trait: '门钥碎片多，适合新手撤离。',
    threat: '灵草傀和青苔兽',
    color: '#5eead4',
  },
  {
    id: 'starHall',
    name: '废阵回廊',
    subtitle: '残星哨站遗留的破碎阵心',
    themeIndex: 1,
    unlockLevel: 8,
    timeLimit: 140,
    killGoal: 12,
    materialGoal: 4,
    ticketBonus: 7,
    expBonus: 48,
    skillBonus: 3,
    artifactFocus: ['chain', 'burst'],
    trait: '抽卡券收益更高，怪潮更密。',
    threat: '裂隙飞魇和星核晶卫',
    color: '#38bdf8',
  },
  {
    id: 'mistMaze',
    name: '迷灯幻境',
    subtitle: '雾灯林道深处的移动幻阵',
    themeIndex: 2,
    unlockLevel: 14,
    timeLimit: 135,
    killGoal: 13,
    materialGoal: 4,
    ticketBonus: 6,
    expBonus: 66,
    skillBonus: 4,
    artifactFocus: ['orbit', 'regen'],
    trait: '法宝精华更多，撤离门距离更远。',
    threat: '雾翅妖蝠和司命幻影',
    color: '#99f6e4',
  },
  {
    id: 'crystalMine',
    name: '地心晶窟',
    subtitle: '晶脉矿坑坍塌后的妖晶巢',
    themeIndex: 3,
    unlockLevel: 22,
    timeLimit: 130,
    killGoal: 14,
    materialGoal: 5,
    ticketBonus: 8,
    expBonus: 86,
    skillBonus: 5,
    artifactFocus: ['burst', 'orbit'],
    trait: '精英比例更高，通关更容易出史诗法宝。',
    threat: '晶甲妖兽和紫晶镇守',
    color: '#c084fc',
  },
  {
    id: 'bloodRift',
    name: '血月断层',
    subtitle: '裂隙前线燃烧的血月战场',
    themeIndex: 4,
    unlockLevel: 34,
    timeLimit: 125,
    killGoal: 15,
    materialGoal: 5,
    ticketBonus: 9,
    expBonus: 112,
    skillBonus: 6,
    artifactFocus: ['flame', 'slash'],
    trait: '怪物压迫最强，莲火和重尺掉落权重更高。',
    threat: '血牙魔狼和裂隙守门人',
    color: '#fb7185',
  },
  {
    id: 'kingTomb',
    name: '铜阙墓道',
    subtitle: '古王庭外环沉睡的王庭秘藏',
    themeIndex: 5,
    unlockLevel: 48,
    timeLimit: 120,
    killGoal: 16,
    materialGoal: 6,
    ticketBonus: 12,
    expBonus: 150,
    skillBonus: 8,
    artifactFocus: ['flame', 'orbit', 'chain'],
    trait: '高阶副本，通关结算奖励最高。',
    threat: '铜甲影卫和古庭镇灵',
    color: '#fbbf24',
  },
]

const characters: Record<CharacterId, CharacterDef> = {
  sword: { id: 'sword', name: '青岚剑修', title: '剑匣亲和 / 重尺成长', need: 20, color: '#67e8f9', portrait: '/assets/generated/portrait-sword.png', battle: '/assets/generated/character-sword.png', starter: { slash: 2, orbit: 1 }, desc: '获得剑类法宝后亲和更高，普攻距离和剑阵成长更快。' },
  thunder: { id: 'thunder', name: '九霄雷使', title: '雷印亲和 / 群怪压制', need: 30, color: '#38bdf8', portrait: '/assets/generated/portrait-thunder.png', battle: '/assets/generated/character-thunder.png', starter: { chain: 3, burst: 1 }, desc: '获得雷印法宝后弹射更强，适合处理密集怪潮。' },
  flame: { id: 'flame', name: '莲火符师', title: '火鼎亲和 / 范围爆发', need: 30, color: '#fb923c', portrait: '/assets/generated/portrait-flame.png', battle: '/assets/generated/character-flame.png', starter: { flame: 3, burst: 1 }, desc: '获得火鼎法宝后莲火范围更大，怪物密集时更容易清场。' },
  wood: { id: 'wood', name: '青木灵医', title: '灵瓶亲和 / 稳定刷图', need: 25, color: '#86efac', portrait: '/assets/generated/portrait-wood.png', battle: '/assets/generated/character-wood.png', starter: { regen: 3, slash: 1 }, desc: '获得回复法宝后续航更强，适合长时间刷副本。' },
}

const artifactDefs: Record<ArtifactKey, ArtifactDef> = {
  slash: { key: 'slash', name: '焚海重尺', type: '尺类重兵', color: '#fb923c', rarity: '史诗', iconId: 'blade-3', image: '/assets/generated/artifact-slash.png', max: 10, source: '参考经典玄幻“重尺破浪”类型，使用原创名称。', desc: '获得后开启重尺剑气，提升自动攻击距离和飞剑斩击伤害。' },
  burst: { key: 'burst', name: '太虚镇海葫', type: '葫芦法宝', color: '#a855f7', rarity: '史诗', iconId: 'nova-3', image: '/assets/generated/artifact-burst.png', max: 10, source: '参考葫芦、瓶类收摄法宝的常见设定。', desc: '获得后开启自动剑罡爆发，怪物聚集时释放范围冲击。' },
  chain: { key: 'chain', name: '九霄引雷印', type: '雷印法宝', color: '#38bdf8', rarity: '史诗', iconId: 'chain-3', image: '/assets/generated/artifact-chain.png', max: 10, source: '参考雷印、雷翅、雷法类网文法宝。', desc: '获得后自动引雷弹射，适合清理一条线上的怪潮。' },
  orbit: { key: 'orbit', name: '青竹云剑匣', type: '成套飞剑', color: '#67e8f9', rarity: '传说', iconId: 'orbit-3', image: '/assets/generated/artifact-orbit.png', max: 10, source: '参考成套飞剑和剑匣体系，使用原创名称。', desc: '获得后开启护体剑阵，被围住时飞剑自动环切。' },
  flame: { key: 'flame', name: '琉璃莲火鼎', type: '火鼎法宝', color: '#fb923c', rarity: '传说', iconId: 'flame-3', image: '/assets/generated/artifact-flame.png', max: 10, source: '参考异火、火鼎、莲火类玄幻体系。', desc: '获得后自动铺开莲火符海，密集怪物会被连环引爆。' },
  regen: { key: 'regen', name: '青木回元瓶', type: '灵瓶法宝', color: '#86efac', rarity: '稀有', iconId: 'guard-3', image: '/assets/generated/artifact-regen.png', max: 8, source: '参考灵瓶、药园、青木回复类修仙法宝。', desc: '获得后开启持续回元，战斗中自动恢复生命。' },
}

const pools: Record<Rarity, Reward[]> = {
  普通: [
    { name: '回春丹', rarity: '普通', count: 3, hp: 4 },
    { name: '凝露灵草', rarity: '普通', count: 3, hp: 3 },
    { name: '玄铁灵矿', rarity: '普通', count: 4, atk: 1 },
    { name: '悟道灵晶', rarity: '普通', count: 2, skill: 1 },
    { name: '青岚剑修碎片', rarity: '普通', count: 2, characterId: 'sword' },
  ],
  稀有: [
    { name: '青锋飞剑', rarity: '稀有', count: 1, slot: 'weapon', atk: 8 },
    { name: '灵纹法衣', rarity: '稀有', count: 1, slot: 'armor', hp: 28 },
    { name: '风行玉佩', rarity: '稀有', count: 1, slot: 'core', skill: 8 },
    { name: '青木灵医碎片', rarity: '稀有', count: 4, characterId: 'wood' },
  ],
  史诗: [
    { name: '虚境灵枪', rarity: '史诗', count: 1, slot: 'weapon', atk: 18 },
    { name: '霜环法袍', rarity: '史诗', count: 1, slot: 'armor', hp: 56 },
    { name: '秘境钥印', rarity: '史诗', count: 1, slot: 'core', skill: 18 },
    { name: '九霄雷使碎片', rarity: '史诗', count: 6, characterId: 'thunder' },
    { name: '莲火符师碎片', rarity: '史诗', count: 6, characterId: 'flame' },
  ],
  传说: [
    { name: '星门裁决剑', rarity: '传说', count: 1, slot: 'weapon', atk: 36 },
    { name: '龙纹仙甲', rarity: '传说', count: 1, slot: 'armor', hp: 108 },
    { name: '天命灵核', rarity: '传说', count: 1, slot: 'core', skill: 36 },
    { name: '九霄雷使整卡', rarity: '传说', count: 30, characterId: 'thunder' },
    { name: '莲火符师整卡', rarity: '传说', count: 30, characterId: 'flame' },
  ],
}

const state = {
  mode: 'wild' as Mode,
  hero: { x: 0, y: 0, hp: 120, baseHp: 120, level: 1, exp: 0, baseAtk: 16, skillPower: 0 },
  gear: { weapon: null, armor: null, core: null } as Record<Slot, Reward | null>,
  skills: { slash: 0, burst: 0, regen: 0, chain: 0, orbit: 0, flame: 0, points: 0 } as SkillTree,
  artifacts: { ...baseArtifacts },
  mutations: { ...baseMutations },
  activeDungeon: 'mossCave' as DungeonId,
  activeCharacter: 'sword' as CharacterId,
  ownedCharacters: ['sword'] as CharacterId[],
  characterShards: { ...baseCharacterShards },
  enemies: [] as Enemy[],
  texts: [] as FloatingText[],
  effects: [] as Effect[],
  particles: [] as Particle[],
  soulOrbs: [] as SoulOrb[],
  screenShake: 0,
  screenFlash: null as ScreenFlash | null,
  hitStop: 0,
  healPulse: 0,
  bag: [] as Reward[],
  kills: 0,
  tickets: 0,
  dungeonEntries: 3,
  pity: 0,
  wave: 1,
  skillCd: 0,
  chainCd: 0,
  orbitCd: 0,
  flameCd: 0,
  attackCd: 0,
  dungeonTime: 0,
  dungeonGoal: 12,
  dungeonStartKills: 0,
  dungeonExtractX: 0,
  dungeonExtractY: 0,
  dungeonLootTickets: 0,
  dungeonLootExp: 0,
  dungeonLootSkill: 0,
  dungeonMaterials: 0,
  dungeonMaterialGoal: 3,
  dungeonGateFound: false,
  bossSpawned: false,
  lastSettlement: '',
  questTarget: 15,
  questClaimed: false,
  lastDaily: '',
  guideStep: 0,
  soulExp: 0,
  autoHaste: 0,
  autoExplore: true,
  message: '意识已接入《虚境试炼》，灵契行者将自动沿世界线推进。',
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="phone-shell">
    <section class="topbar">
      <div><strong>虚境试炼</strong><span id="mode-label">野外刷怪</span></div>
      <div class="currency"><button id="profile-btn" class="lore-btn" type="button">账号</button><button id="lore-btn" class="lore-btn" type="button">档案</button><span>抽卡券</span><b id="ticket-count">0</b></div>
      <div class="character-showcase">
        <div class="character-stage"><img id="hero-showcase-img" src="/assets/oga-rpg/hero-idle/FR_Adventurer_Idle_000.png" alt=""></div>
        <div class="character-meta">
          <b id="hero-showcase-level">Lv.1</b>
          <span id="hero-showcase-title">世界行者</span>
          <small id="hero-showcase-gear">无武器 / 无护甲</small>
        </div>
      </div>
      <div class="stat-line">
        <span id="level-label">Lv.1</span>
        <span id="atk-label">攻击 0</span>
        <span id="kill-label">击杀 0</span>
        <span id="soul-label">魂质Lv.1 0/5</span>
        <span id="wave-label">波次 1</span>
      </div>
      <div class="bar"><i id="hp-bar"></i></div>
    </section>

    <section class="page-stack">
      <section id="battle-view" class="page-view battle-view" data-page="battle">
        <section class="viewport-wrap">
          <canvas id="game" width="720" height="960"></canvas>
        </section>

        <section class="progress-panel">
          <div class="progress-topline"><div id="message" class="message"></div></div>
          <div id="guide-tip" class="guide-tip"></div>
          <div id="quest-label">任务：击杀 0/15</div>
          <div id="gear-label">装备：无</div>
        </section>

        <section class="battle-actions">
          <div id="auto-orb" class="auto-orb"><i></i><span id="auto-orb-label">自动<br>探索</span></div>
          <button id="mode-btn" type="button">副本券 3/3</button>
        </section>
      </section>

      <section id="dungeon-panel" class="page-view page-sheet dungeon-sheet" data-page="dungeon" hidden>
      <div class="sheet-head dungeon-head">
        <div><h2>秘境副本</h2><small id="dungeon-entry-summary">入场 3/3</small></div>
        <button id="close-dungeon" class="page-close" type="button">x</button>
      </div>
      <div class="dungeon-brief">
        <small>每日入场次数共享</small>
        <b>选择秘境，带回抽卡券、法宝和材料</b>
        <span id="dungeon-brief-copy">副本需要收集门钥碎片，找到撤离门后才能安全带走收益。</span>
      </div>
      <div id="dungeon-list" class="dungeon-list"></div>
    </section>

      <section id="gacha-panel" class="page-view page-sheet gacha-sheet" data-page="gacha" hidden>
      <div class="sheet-head"><h2>星门补给</h2><button id="close-gacha" class="page-close" type="button">x</button></div>
      <div class="gacha-stage">
        <div id="gate-core" class="gate-core"><i></i><span>等待连接</span></div>
        <div class="gacha-copy">
          <small>副本战利品兑换通道</small>
          <b>召回失落角色与装备</b>
          <span>抽卡券只从副本带出；角色碎片集齐后可合成新角色。</span>
        </div>
      </div>
      <div class="gacha-meter">
        <div><small>抽卡券</small><b id="gacha-ticket-count">0</b></div>
        <div><small>保底</small><b id="gacha-pity-count">0/10</b></div>
        <div><small>目标</small><b>史诗+</b></div>
        <i id="gacha-pity-bar"></i>
      </div>
      <div class="rates"><span>传说 1%</span><span>史诗 9%</span><span>稀有 28%</span><span>普通 62%</span></div>
      <div class="pull-row"><button id="pull-one" type="button"><small>消耗 1 抽卡券</small><b>单抽</b></button><button id="pull-ten" type="button"><small>消耗 10 抽卡券</small><b>十连</b></button></div>
      <div id="pull-results" class="results"></div>
    </section>

      <section id="equip-panel" class="page-view page-sheet equip-sheet" data-page="equip" hidden>
      <div class="sheet-head"><h2>装备</h2><button id="close-equip" class="page-close" type="button">x</button></div>
      <div id="equipped-list" class="gear-cards"></div>
      <div id="equip-list" class="results"></div>
    </section>

      <section id="bag-panel" class="page-view page-sheet bag-sheet" data-page="bag" hidden>
      <div class="sheet-head"><h2>背包</h2><button id="close-bag" class="page-close" type="button">x</button></div>
      <div id="bag-list" class="results"></div>
    </section>

      <section id="skill-panel" class="page-view page-sheet skill-sheet" data-page="artifact" hidden>
      <div class="sheet-head"><h2>法宝库</h2><button id="close-skill-panel" class="page-close" type="button">x</button></div>
      <div id="skill-points" class="rates"></div>
      <div id="skill-list" class="skill-list"></div>
    </section>
    </section>

    <nav class="bottom-nav" aria-label="主导航">
      <button id="battle-btn" class="active" type="button" data-page="battle"><i>战</i><span>战斗</span></button>
      <button id="dungeon-btn" type="button" data-page="dungeon"><i>境</i><span>副本</span></button>
      <button id="gacha-btn" type="button" data-page="gacha"><i>召</i><span>抽卡</span></button>
      <button id="equip-btn" type="button" data-page="equip"><i>装</i><span>装备</span></button>
      <button id="bag-btn" type="button" data-page="bag"><i>囊</i><span>背包</span></button>
      <button id="train-btn" type="button" data-page="artifact"><i>宝</i><span>法宝</span></button>
    </nav>

    <section id="lore-panel" class="sheet lore-sheet" hidden>
      <div class="sheet-head"><h2>虚境档案</h2><button id="close-lore" type="button">x</button></div>
      <div class="lore-copy">
        <p><b>公测前夜，全球第一款沉浸式修行网游《虚境试炼》突然失控。</b>玩家原本只是以意识接入游戏，却发现副本裂隙开始反向侵蚀现实城市。系统删去了大量玩家记忆，只留下一个身份：灵契行者。</p>
        <p>你被分配到青苔丘陵，从最底层的世界线开始自动探索。击败虚境生物会掉落魂质，魂质能重写角色底层模板；真正的技能则来自副本中夺回的法宝。</p>
        <p>副本不是单纯关卡，而是正在坍塌的临时空间。每日只有三次入场机会，进入后必须收集门钥碎片，找到撤离门，把抽卡券、法宝和法宝精华带回主世界线。</p>
      </div>
      <div class="lore-tags"><span>自动探索</span><span>魂质进化</span><span>星门抽卡</span><span>副本撤离</span></div>
    </section>

    <section id="settlement-panel" class="sheet settlement" hidden>
      <div class="sheet-head"><h2>副本结算</h2><button id="close-settlement" type="button">x</button></div>
      <div id="settlement-results" class="results"></div>
    </section>

    <section id="evolution-panel" class="sheet evolution-sheet" hidden>
      <div class="sheet-head"><h2>魂质进化</h2></div>
      <p class="rates">魂质共鸣已满，选择一个方向强化本局模板。</p>
      <div id="evolution-list" class="evolution-list"></div>
    </section>

    <section id="profile-panel" class="profile-panel" hidden>
      <form id="profile-form" class="profile-card">
        <div class="profile-head">
          <div>
            <small>本地账号</small>
            <h2>灵契身份</h2>
          </div>
          <button id="close-profile" class="profile-close" type="button">x</button>
        </div>
        <p class="profile-note">单机版先按本机玩家保存，不联网；换浏览器或清缓存会影响本地资料。</p>
        <div class="profile-current">
          <span id="profile-current">未登录</span>
          <button id="profile-switch" type="button">切换</button>
        </div>
        <div id="profile-list" class="profile-list"></div>
        <label class="profile-field">
          <span>玩家名</span>
          <input id="profile-name" maxlength="12" autocomplete="username" placeholder="输入玩家名">
        </label>
        <label class="profile-field">
          <span>本机口令</span>
          <input id="profile-pin" maxlength="18" type="password" autocomplete="current-password" placeholder="可不填">
        </label>
        <div id="profile-error" class="profile-error" hidden></div>
        <button id="profile-submit" class="profile-submit" type="submit">进入游戏</button>
      </form>
    </section>
  </main>
`

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ctx = canvas.getContext('2d')!
const autoOrb = document.querySelector<HTMLDivElement>('#auto-orb')!
const autoOrbLabel = document.querySelector<HTMLSpanElement>('#auto-orb-label')!
const modeBtn = document.querySelector<HTMLButtonElement>('#mode-btn')!
const dungeonBtn = document.querySelector<HTMLButtonElement>('#dungeon-btn')!
const gachaBtn = document.querySelector<HTMLButtonElement>('#gacha-btn')!
const equipBtn = document.querySelector<HTMLButtonElement>('#equip-btn')!
const bagBtn = document.querySelector<HTMLButtonElement>('#bag-btn')!
const trainBtn = document.querySelector<HTMLButtonElement>('#train-btn')!
const profileBtn = document.querySelector<HTMLButtonElement>('#profile-btn')!
const loreBtn = document.querySelector<HTMLButtonElement>('#lore-btn')!
const closeGacha = document.querySelector<HTMLButtonElement>('#close-gacha')!
const pullOne = document.querySelector<HTMLButtonElement>('#pull-one')!
const pullTen = document.querySelector<HTMLButtonElement>('#pull-ten')!
const gachaPanel = document.querySelector<HTMLDivElement>('#gacha-panel')!
const pullResults = document.querySelector<HTMLDivElement>('#pull-results')!
const gateCore = document.querySelector<HTMLDivElement>('#gate-core')!
const gachaTicketCount = document.querySelector<HTMLElement>('#gacha-ticket-count')!
const gachaPityCount = document.querySelector<HTMLElement>('#gacha-pity-count')!
const gachaPityBar = document.querySelector<HTMLElement>('#gacha-pity-bar')!
const lorePanel = document.querySelector<HTMLDivElement>('#lore-panel')!
const closeLore = document.querySelector<HTMLButtonElement>('#close-lore')!
const settlementPanel = document.querySelector<HTMLDivElement>('#settlement-panel')!
const settlementResults = document.querySelector<HTMLDivElement>('#settlement-results')!
const closeSettlement = document.querySelector<HTMLButtonElement>('#close-settlement')!
const dungeonPanel = document.querySelector<HTMLDivElement>('#dungeon-panel')!
const closeDungeon = document.querySelector<HTMLButtonElement>('#close-dungeon')!
const dungeonList = document.querySelector<HTMLDivElement>('#dungeon-list')!
const dungeonEntrySummary = document.querySelector<HTMLElement>('#dungeon-entry-summary')!
const dungeonBriefCopy = document.querySelector<HTMLElement>('#dungeon-brief-copy')!
const equipPanel = document.querySelector<HTMLDivElement>('#equip-panel')!
const closeEquip = document.querySelector<HTMLButtonElement>('#close-equip')!
const bagPanel = document.querySelector<HTMLDivElement>('#bag-panel')!
const closeBag = document.querySelector<HTMLButtonElement>('#close-bag')!
const equippedList = document.querySelector<HTMLDivElement>('#equipped-list')!
const equipList = document.querySelector<HTMLDivElement>('#equip-list')!
const bagList = document.querySelector<HTMLDivElement>('#bag-list')!
const skillPanel = document.querySelector<HTMLDivElement>('#skill-panel')!
const closeSkillPanel = document.querySelector<HTMLButtonElement>('#close-skill-panel')!
const skillPointsLabel = document.querySelector<HTMLDivElement>('#skill-points')!
const skillList = document.querySelector<HTMLDivElement>('#skill-list')!
const battleView = document.querySelector<HTMLElement>('#battle-view')!
const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.bottom-nav button[data-page]'))
const pagePanels: Record<AppPage, HTMLElement> = {
  battle: battleView,
  dungeon: dungeonPanel,
  gacha: gachaPanel,
  equip: equipPanel,
  bag: bagPanel,
  artifact: skillPanel,
}
const evolutionPanel = document.querySelector<HTMLDivElement>('#evolution-panel')!
const evolutionList = document.querySelector<HTMLDivElement>('#evolution-list')!
const guideTip = document.querySelector<HTMLDivElement>('#guide-tip')!
const heroShowcaseImg = document.querySelector<HTMLImageElement>('#hero-showcase-img')!
const heroShowcaseLevel = document.querySelector<HTMLElement>('#hero-showcase-level')!
const heroShowcaseTitle = document.querySelector<HTMLElement>('#hero-showcase-title')!
const heroShowcaseGear = document.querySelector<HTMLElement>('#hero-showcase-gear')!
const profilePanel = document.querySelector<HTMLDivElement>('#profile-panel')!
const profileForm = document.querySelector<HTMLFormElement>('#profile-form')!
const closeProfile = document.querySelector<HTMLButtonElement>('#close-profile')!
const profileSwitch = document.querySelector<HTMLButtonElement>('#profile-switch')!
const profileCurrent = document.querySelector<HTMLElement>('#profile-current')!
const profileList = document.querySelector<HTMLDivElement>('#profile-list')!
const profileNameInput = document.querySelector<HTMLInputElement>('#profile-name')!
const profilePinInput = document.querySelector<HTMLInputElement>('#profile-pin')!
const profileError = document.querySelector<HTMLDivElement>('#profile-error')!
const LEGACY_SAVE_KEY = 'void-trial-save-v1'
const PROFILE_INDEX_KEY = 'void-trial-profile-index-v1'
const PROFILE_SAVE_PREFIX = `${LEGACY_SAVE_KEY}:profile:`

function loadSprite(src: string) {
  const image = new Image()
  image.src = src
  return image
}

const cultivatorAvatar = '/assets/generated/cultivator-hero.png'

const sprites = {
  player: loadSprite('/assets/kenney-topdown/player.png'),
  zombie: loadSprite('/assets/kenney-topdown/zombie.png'),
  zombieElite: loadSprite('/assets/kenney-topdown/zombie_elite.png'),
  heroStand: loadSprite('/assets/kenney-topdown/hero_stand.png'),
  enemyStand: loadSprite('/assets/kenney-topdown/enemy_stand.png'),
  cultivator: loadSprite(cultivatorAvatar),
  worldBg: loadSprite('/assets/generated/bg-world-xianxia.png'),
  dungeonBg: loadSprite('/assets/generated/bg-dungeon-xianxia.png'),
}

const characterSprites: Record<CharacterId, HTMLImageElement> = {
  sword: loadSprite(characters.sword.battle),
  thunder: loadSprite(characters.thunder.battle),
  flame: loadSprite(characters.flame.battle),
  wood: loadSprite(characters.wood.battle),
}

const swordActionSprites = {
  idle: loadSprite('/assets/generated/action-sword-idle.png'),
  fly: loadSprite('/assets/generated/action-sword-fly.png'),
  slash: loadSprite('/assets/generated/action-sword-slash.png'),
}

const monsterSprites: Record<EnemyKind, HTMLImageElement> = {
  slime: loadSprite('/assets/generated/monster-spirit-fox.png'),
  bat: loadSprite('/assets/generated/monster-bone-bat.png'),
  wolf: loadSprite('/assets/generated/monster-crystal-beast.png'),
  crystal: loadSprite('/assets/generated/monster-crystal-beast.png'),
  warden: loadSprite('/assets/generated/monster-gatekeeper.png'),
}

const vfxSprites = {
  swordWave: loadSprite('/assets/generated/vfx-sword-wave.png'),
  impact: loadSprite('/assets/generated/vfx-impact-burst.png'),
  thunder: loadSprite('/assets/generated/vfx-thunder-seal.png'),
  lotus: loadSprite('/assets/generated/vfx-lotus-fire.png'),
  heal: loadSprite('/assets/generated/vfx-heal-aura.png'),
}

let input: Vec = { x: 0, y: 0 }
let last = performance.now()
let enemyId = 1
let soulId = 1
let pulling = false
let heroFacing = -Math.PI / 2
let lastAttackFlash = 0
let collectedMaterialCells = new Set<string>()
let autoWorldWalk = 0
let moveTarget: Vec | null = null
let moveTargetPulse = 0
let lastCanvasTapAt = 0
let dragMovePointer: number | null = null
let selectedArtifactKey: ArtifactKey = 'slash'
let activePage: AppPage = 'battle'
let activeProfile: PlayerProfile | null = null
let audioCtx: AudioContext | null = null
let audioMaster: GainNode | null = null
let audioUnlocked = false
const soundLast: Record<string, number> = {}

function unlockAudio() {
  const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return
  if (!audioCtx) {
    audioCtx = new AudioCtor()
    audioMaster = audioCtx.createGain()
    audioMaster.gain.value = 0.36
    audioMaster.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  audioUnlocked = true
}

function soundReady() {
  return !!audioCtx && !!audioMaster && audioUnlocked
}

function canPlaySound(key: string, gap = 60) {
  const now = performance.now()
  if ((soundLast[key] ?? 0) + gap > now) return false
  soundLast[key] = now
  return true
}

function tone(freq: number, duration: number, type: OscillatorType, volume: number, endFreq = freq * 0.72, delay = 0) {
  if (!soundReady() || !audioCtx || !audioMaster) return
  const start = audioCtx.currentTime + delay
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  osc.frequency.exponentialRampToValueAtTime(Math.max(24, endFreq), start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(audioMaster)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

function noiseBurst(duration: number, volume: number, filterFreq = 900, delay = 0) {
  if (!soundReady() || !audioCtx || !audioMaster) return
  const start = audioCtx.currentTime + delay
  const length = Math.max(1, Math.floor(audioCtx.sampleRate * duration))
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    const fade = 1 - i / length
    data[i] = (Math.random() * 2 - 1) * fade
  }
  const source = audioCtx.createBufferSource()
  const filter = audioCtx.createBiquadFilter()
  const gain = audioCtx.createGain()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(filterFreq, start)
  filter.Q.value = 4.4
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.buffer = buffer
  source.connect(filter)
  filter.connect(gain)
  gain.connect(audioMaster)
  source.start(start)
}

const sfx = {
  slash(strong = false) {
    if (!canPlaySound(strong ? 'slash-strong' : 'slash', strong ? 120 : 72)) return
    tone(strong ? 520 : 390, strong ? 0.16 : 0.1, 'sawtooth', strong ? 0.07 : 0.045, strong ? 96 : 150)
    tone(strong ? 980 : 760, strong ? 0.11 : 0.07, 'triangle', strong ? 0.055 : 0.034, strong ? 360 : 420, 0.012)
    noiseBurst(strong ? 0.09 : 0.055, strong ? 0.04 : 0.022, strong ? 1800 : 1400)
  },
  hit(power = 1, killed = false) {
    if (!canPlaySound(killed ? 'kill' : 'hit', killed ? 80 : 45)) return
    tone(killed ? 88 : 120 + power * 24, killed ? 0.18 : 0.075, 'triangle', killed ? 0.075 : 0.035, killed ? 42 : 70)
    noiseBurst(killed ? 0.14 : 0.065, killed ? 0.06 : 0.028, killed ? 520 : 780)
    if (killed) tone(260, 0.12, 'sine', 0.035, 520, 0.03)
  },
  thunder() {
    if (!canPlaySound('thunder', 180)) return
    noiseBurst(0.18, 0.065, 2400)
    tone(980, 0.08, 'square', 0.045, 360)
    tone(1460, 0.1, 'sawtooth', 0.032, 620, 0.035)
  },
  flame() {
    if (!canPlaySound('flame', 220)) return
    noiseBurst(0.22, 0.06, 680)
    tone(190, 0.22, 'sawtooth', 0.05, 74)
    tone(520, 0.14, 'triangle', 0.032, 260, 0.04)
  },
  orbit() {
    if (!canPlaySound('orbit', 180)) return
    for (let i = 0; i < 4; i += 1) tone(520 + i * 130, 0.08, 'triangle', 0.026, 340 + i * 82, i * 0.025)
  },
  heal() {
    if (!canPlaySound('heal', 1200)) return
    tone(420, 0.16, 'sine', 0.025, 620)
    tone(660, 0.2, 'sine', 0.022, 880, 0.08)
  },
  soul(count = 1) {
    if (!canPlaySound('soul', 110)) return
    tone(520 + count * 28, 0.09, 'sine', 0.026, 840 + count * 30)
    tone(820 + count * 24, 0.11, 'triangle', 0.018, 1180, 0.035)
  },
  level() {
    if (!canPlaySound('level', 650)) return
    for (let i = 0; i < 5; i += 1) tone(420 + i * 120, 0.16, 'sine', 0.034, 620 + i * 140, i * 0.055)
  },
  gacha(rank = 1) {
    if (!canPlaySound(`gacha-${rank}`, 110)) return
    tone(300 + rank * 70, 0.14, rank >= 3 ? 'triangle' : 'sine', 0.032 + rank * 0.008, 540 + rank * 120)
    if (rank >= 3) tone(860 + rank * 80, 0.2, 'sine', 0.038, 1280 + rank * 120, 0.05)
  },
}

function flashScreen(color: string, strength = 0.14, life = 0.16) {
  const current = state.screenFlash
  if (current && current.life / current.maxLife > strength) return
  state.screenFlash = { color, strength, life, maxLife: life }
}

function addParticleBurst(x: number, y: number, color: string, count: number, power = 1, kind: ParticleKind = 'spark') {
  if (state.particles.length > 260) state.particles.splice(0, state.particles.length - 220)
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const speed = (90 + Math.random() * 260) * power
    const lift = kind === 'ember' ? -70 : kind === 'soul' ? -130 : -35
    const life = 0.32 + Math.random() * (kind === 'rune' ? 0.7 : 0.42)
    state.particles.push({
      x: x + (Math.random() - 0.5) * 22 * power,
      y: y + (Math.random() - 0.5) * 18 * power,
      vx: Math.cos(angle) * speed * (kind === 'rune' ? 0.35 : 1),
      vy: Math.sin(angle) * speed * 0.55 + lift * power,
      size: (2.8 + Math.random() * 7) * power,
      color,
      life,
      maxLife: life,
      kind,
      spin: (Math.random() - 0.5) * 8,
    })
  }
}

function addSlashParticles(x: number, y: number, angle: number, color: string, strong = false) {
  const count = strong ? 28 : 14
  const length = strong ? 190 : 92
  if (state.particles.length > 260) state.particles.splice(0, state.particles.length - 220)
  for (let i = 0; i < count; i += 1) {
    const along = (i / Math.max(1, count - 1) - 0.5) * length
    const side = (Math.random() - 0.5) * (strong ? 64 : 34)
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    const life = 0.24 + Math.random() * 0.26
    state.particles.push({
      x: x + ca * along - sa * side,
      y: y + sa * along + ca * side - 32,
      vx: ca * (120 + Math.random() * 180) + (Math.random() - 0.5) * 70,
      vy: sa * (70 + Math.random() * 80) - 40 - Math.random() * 70,
      size: strong ? 5 + Math.random() * 8 : 3 + Math.random() * 5,
      color,
      life,
      maxLife: life,
      kind: 'shard',
      spin: (Math.random() - 0.5) * 10,
    })
  }
}

function profileSaveKey(profileId = activeProfile?.id) {
  return profileId ? `${PROFILE_SAVE_PREFIX}${profileId}` : LEGACY_SAVE_KEY
}

function normalizeProfileName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 12)
}

function readProfileIndex(): ProfileIndex {
  const raw = localStorage.getItem(PROFILE_INDEX_KEY)
  if (!raw) return { activeId: null, profiles: [] }
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileIndex>
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles
        .filter((profile): profile is PlayerProfile => Boolean(profile?.id && profile?.name))
        .map((profile) => ({
          id: String(profile.id),
          name: normalizeProfileName(String(profile.name)) || '本机玩家',
          pin: String(profile.pin ?? ''),
          createdAt: Number(profile.createdAt) || Date.now(),
          lastLoginAt: Number(profile.lastLoginAt) || Number(profile.createdAt) || Date.now(),
        }))
      : []
    const activeId = profiles.some((profile) => profile.id === parsed.activeId) ? String(parsed.activeId) : profiles[0]?.id ?? null
    return { activeId, profiles }
  } catch {
    localStorage.removeItem(PROFILE_INDEX_KEY)
    return { activeId: null, profiles: [] }
  }
}

function writeProfileIndex(index: ProfileIndex) {
  localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(index))
}

function createProfile(name: string, pin: string): PlayerProfile {
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  return { id, name, pin: pin.trim(), createdAt: now, lastLoginAt: now }
}

function profileSummary(profileId: string) {
  const raw = localStorage.getItem(profileSaveKey(profileId))
  if (!raw) return { level: 1, tickets: 0, savedAt: 0 }
  try {
    const save = JSON.parse(raw) as Partial<SaveData>
    return {
      level: save.hero?.level ?? save.soulLevel ?? 1,
      tickets: save.tickets ?? 0,
      savedAt: save.savedAt ?? 0,
    }
  } catch {
    return { level: 1, tickets: 0, savedAt: 0 }
  }
}

function setProfileError(message: string) {
  profileError.hidden = !message
  profileError.textContent = message
}

function updateProfileUi() {
  profileCurrent.textContent = activeProfile ? `当前玩家：${activeProfile.name}` : '请选择或创建玩家'
  profileSwitch.disabled = !activeProfile
  closeProfile.hidden = !activeProfile || profilePanel.classList.contains('blocking')
  profileList.innerHTML = ''
  const index = readProfileIndex()
  if (!index.profiles.length) {
    const empty = document.createElement('div')
    empty.className = 'profile-empty'
    empty.textContent = '还没有本地玩家，输入名字后会创建第一份档案。'
    profileList.append(empty)
    return
  }
  index.profiles
    .slice()
    .sort((a, b) => b.lastLoginAt - a.lastLoginAt)
    .forEach((profile) => {
      const summary = profileSummary(profile.id)
      const row = document.createElement('button')
      row.type = 'button'
      row.className = `profile-row ${activeProfile?.id === profile.id ? 'active' : ''}`
      const mark = document.createElement('i')
      mark.textContent = profile.name.slice(0, 1)
      const meta = document.createElement('span')
      meta.textContent = profile.name
      const detail = document.createElement('small')
      detail.textContent = `Lv.${summary.level} | 抽卡券 ${summary.tickets}${profile.pin ? ' | 有口令' : ''}`
      row.append(mark, meta, detail)
      row.addEventListener('click', () => {
        if (profile.pin) {
          profileNameInput.value = profile.name
          profilePinInput.focus()
          setProfileError('这个玩家设置了本机口令，输入后进入。')
          return
        }
        activateProfile(profile.id)
      })
      profileList.append(row)
    })
}

function showProfilePanel(blocking = false) {
  profilePanel.hidden = false
  profilePanel.classList.toggle('blocking', blocking || !activeProfile)
  setProfileError('')
  updateProfileUi()
  setTimeout(() => profileNameInput.focus(), 0)
}

function resetRuntimeState() {
  state.mode = 'wild'
  Object.assign(state.hero, { x: 0, y: 0, hp: 120, baseHp: 120, level: 1, exp: 0, baseAtk: 16, skillPower: 0 })
  state.gear = { weapon: null, armor: null, core: null }
  state.skills = { slash: 0, burst: 0, regen: 0, chain: 0, orbit: 0, flame: 0, points: 0 }
  state.artifacts = { ...baseArtifacts }
  state.mutations = { ...baseMutations }
  state.activeDungeon = 'mossCave'
  state.activeCharacter = 'sword'
  state.ownedCharacters = ['sword']
  state.characterShards = { ...baseCharacterShards }
  state.enemies = []
  state.texts = []
  state.effects = []
  state.particles = []
  state.soulOrbs = []
  state.screenShake = 0
  state.screenFlash = null
  state.hitStop = 0
  state.healPulse = 0
  state.bag = []
  state.kills = 0
  state.tickets = 0
  state.dungeonEntries = 3
  state.pity = 0
  state.wave = 1
  state.skillCd = 0
  state.chainCd = 0
  state.orbitCd = 0
  state.flameCd = 0
  state.attackCd = 0
  state.dungeonTime = 0
  state.dungeonGoal = 12
  state.dungeonStartKills = 0
  state.dungeonExtractX = 0
  state.dungeonExtractY = 0
  state.dungeonLootTickets = 0
  state.dungeonLootExp = 0
  state.dungeonLootSkill = 0
  state.dungeonMaterials = 0
  state.dungeonMaterialGoal = 3
  state.dungeonGateFound = false
  state.bossSpawned = false
  state.lastSettlement = ''
  state.questTarget = 15
  state.questClaimed = false
  state.lastDaily = ''
  state.guideStep = 0
  state.soulExp = 0
  state.autoHaste = 0
  state.autoExplore = true
  state.message = '意识已接入《虚境试炼》，灵契行者将自动沿世界线推进。'
  input = { x: 0, y: 0 }
  collectedMaterialCells = new Set()
  moveTarget = null
  moveTargetPulse = 0
  dragMovePointer = null
  selectedArtifactKey = 'slash'
  autoWorldWalk = 0
  last = performance.now()
  showPage('battle')
}

function activateProfile(profileId: string) {
  const index = readProfileIndex()
  const profile = index.profiles.find((item) => item.id === profileId)
  if (!profile) {
    showProfilePanel(true)
    setProfileError('没有找到这个玩家档案。')
    return
  }
  profile.lastLoginAt = Date.now()
  index.activeId = profile.id
  writeProfileIndex(index)
  activeProfile = profile
  profilePanel.hidden = true
  resetRuntimeState()
  loadGame()
  ensureEnemies()
  toast(`已进入 ${profile.name} 的本地档案。`)
  updateProfileUi()
  updateHud()
  updateGuide()
}

function initProfiles() {
  const index = readProfileIndex()
  if (!index.profiles.length) {
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY)
    if (legacy) {
      const profile = createProfile('本机玩家', '')
      index.profiles.push(profile)
      index.activeId = profile.id
      writeProfileIndex(index)
      localStorage.setItem(profileSaveKey(profile.id), legacy)
    }
  }
  const nextIndex = readProfileIndex()
  const active = nextIndex.profiles.find((profile) => profile.id === nextIndex.activeId) ?? nextIndex.profiles[0]
  if (active) {
    activeProfile = active
    active.lastLoginAt = Date.now()
    nextIndex.activeId = active.id
    writeProfileIndex(nextIndex)
  } else {
    showProfilePanel(true)
  }
  updateProfileUi()
}

const guideTexts = [
  '野外会自动沿世界地图前进，点击战斗画面可临时接管移动。',
  '靠近敌人后角色会自动普攻；获得法宝后会自动释放对应仙术。',
  '吸收魂质球升级，三选一获得进化卡。',
  '抽卡券只从副本带出，星门补给主要召回角色碎片和装备。',
  '点击法宝，查看副本获得的焚海重尺、雷印、剑匣等自动仙术。',
  '每日 3 次副本入场，收集门钥碎片后找到撤离门带走收益。',
]

function advanceGuide(target: number) {
  if (state.guideStep !== target) return
  state.guideStep += 1
  saveGame()
  updateGuide()
}

function updateGuide() {
  if (state.guideStep >= guideTexts.length) {
    guideTip.hidden = true
    return
  }
  guideTip.hidden = false
  guideTip.textContent = `新手目标 ${state.guideStep + 1}/${guideTexts.length}：${guideTexts[state.guideStep]}`
}

function loadGame() {
  if (!activeProfile) return
  const key = profileSaveKey(activeProfile.id)
  const raw = localStorage.getItem(key)
  if (!raw) {
    claimDailyReward()
    return
  }
  try {
    const save = JSON.parse(raw) as SaveData
    Object.assign(state.hero, save.hero)
    state.gear = save.gear
    state.skills = { ...state.skills, ...(save.skills ?? {}) }
    state.artifacts = { ...baseArtifacts, ...(save.artifacts ?? {}) }
    const savedArtifacts = Object.values(save.artifacts ?? {}).some((level) => (level ?? 0) > 0)
    if (!savedArtifacts && save.skills) {
      artifactKeys.forEach((key) => {
        const oldLevel = save.skills[key] ?? 0
        if (oldLevel > 0) state.artifacts[key] = oldLevel
      })
    }
    state.mutations = { ...baseMutations, ...(save.mutations ?? {}) }
    state.activeDungeon = dungeonDefs.some((dungeon) => dungeon.id === save.activeDungeon) ? save.activeDungeon! : 'mossCave'
    state.activeCharacter = save.activeCharacter ?? 'sword'
    state.ownedCharacters = save.ownedCharacters?.length ? save.ownedCharacters : ['sword']
    state.characterShards = { ...baseCharacterShards, ...(save.characterShards ?? {}) }
    if (!state.ownedCharacters.includes('sword')) state.ownedCharacters.push('sword')
    if (!state.ownedCharacters.includes(state.activeCharacter)) state.activeCharacter = 'sword'
    state.kills = save.kills ?? 0
    state.tickets = save.tickets ?? 0
    state.dungeonEntries = save.dungeonEntries ?? 3
    state.pity = save.pity ?? 0
    state.wave = save.wave ?? 1
    state.questClaimed = save.questClaimed ?? false
    state.lastDaily = save.lastDaily ?? ''
    state.bag = Array.isArray(save.bag) ? save.bag : []
    state.guideStep = save.guideStep ?? 0
    state.hero.level = Math.max(state.hero.level, save.soulLevel ?? state.hero.level)
    state.soulExp = save.soulExp ?? save.soulProgress ?? 0
    state.autoHaste = save.autoHaste ?? 0
    state.autoExplore = save.autoExplore ?? true
    const offlineMinutes = Math.min(480, Math.floor((Date.now() - (save.savedAt ?? Date.now())) / 60000))
    if (offlineMinutes >= 5) {
      const expGain = Math.floor(offlineMinutes / 3)
      grantExp(expGain)
      toast(`离线 ${offlineMinutes} 分钟，世界线沉淀了 ${expGain} 经验。抽卡券仍需进副本带出。`)
    }
    claimDailyReward()
  } catch {
    localStorage.removeItem(key)
    claimDailyReward()
  }
}

function saveGame() {
  if (!activeProfile) return
  const save: SaveData = {
    hero: state.hero,
    gear: state.gear,
    skills: state.skills,
    artifacts: state.artifacts,
    mutations: state.mutations,
    activeDungeon: state.activeDungeon,
    kills: state.kills,
    tickets: state.tickets,
    dungeonEntries: state.dungeonEntries,
    pity: state.pity,
    wave: state.wave,
    questClaimed: state.questClaimed,
    lastDaily: state.lastDaily,
    bag: state.bag.slice(0, 80),
    guideStep: state.guideStep,
    soulLevel: state.hero.level,
    soulExp: state.soulExp,
    autoHaste: state.autoHaste,
    autoExplore: state.autoExplore,
    activeCharacter: state.activeCharacter,
    ownedCharacters: state.ownedCharacters,
    characterShards: state.characterShards,
    savedAt: Date.now(),
  }
  localStorage.setItem(profileSaveKey(activeProfile.id), JSON.stringify(save))
  const index = readProfileIndex()
  const profile = index.profiles.find((item) => item.id === activeProfile?.id)
  if (profile) {
    profile.lastLoginAt = Date.now()
    index.activeId = profile.id
    writeProfileIndex(index)
  }
}

function claimDailyReward() {
  const today = new Date().toISOString().slice(0, 10)
  if (state.lastDaily === today) return
  state.lastDaily = today
  state.dungeonEntries = 3
  toast('每日副本入场次数已刷新：3 次。')
  saveGame()
}

function totalAtk() {
  return state.hero.baseAtk + state.hero.level * 3 + effectiveSkill('slash') * 4 + state.mutations.swordRide * 3 + (state.gear.weapon?.atk ?? 0)
}

function maxHp() {
  return state.hero.baseHp + state.hero.level * 12 + effectiveSkill('regen') * 5 + (state.gear.armor?.hp ?? 0)
}

function skillPower() {
  return state.hero.skillPower + effectiveSkill('burst') * 6 + state.mutations.flameLotus * 4 + (state.gear.core?.skill ?? 0)
}

function grantExp(amount: number) {
  state.hero.exp += amount
  while (state.hero.exp >= state.hero.level * 40) {
    state.hero.exp -= state.hero.level * 40
    state.hero.level += 1
    state.hero.hp = maxHp()
  }
}

function autoAttackRange() {
  return 132 + effectiveSkill('slash') * 8 + state.mutations.swordRide * 14
}

function autoAttackDelay() {
  return Math.max(0.34, 0.62 - state.autoHaste * 0.05)
}

function manualMoving() {
  return Math.hypot(input.x, input.y) > 0.12
}

function updateClickMovement() {
  if (!moveTarget) {
    input = { x: 0, y: 0 }
    return
  }
  const dx = moveTarget.x - state.hero.x
  const dy = moveTarget.y - state.hero.y
  const distance = Math.hypot(dx, dy)
  if (distance < 12) {
    moveTarget = null
    input = { x: 0, y: 0 }
    return
  }
  input = {
    x: Math.max(-1, Math.min(1, dx / 120)),
    y: Math.max(-1, Math.min(1, dy / 46)),
  }
}

function dashToMoveTarget() {
  if (!moveTarget) return
  const dx = moveTarget.x - state.hero.x
  const dy = moveTarget.y - state.hero.y
  const distance = Math.hypot(dx, dy)
  if (distance < 28) return
  const dash = Math.min(180 + state.mutations.swordRide * 35, distance - 8)
  state.hero.x += (dx / distance) * dash
  state.hero.y += (dy / distance) * Math.min(42, dash * 0.28)
  state.hero.y = Math.max(-44, Math.min(44, state.hero.y))
  state.effects.push({
    x: state.hero.x,
    y: state.hero.y,
    radius: 120 + state.mutations.swordRide * 20,
    color: '#5eead4',
    life: 0.28,
    maxLife: 0.28,
    kind: 'ring',
  })
  state.texts.push({ x: state.hero.x, y: state.hero.y - 72, text: '御剑疾行', color: '#5eead4', life: 0.65 })
}

function autoWorldSpeed() {
  if (state.mode !== 'wild' || manualMoving() || !state.autoExplore) return 0
  const target = nearestEnemy()
  const cruise = 92 + state.mutations.swordRide * 10
  if (!target) return cruise
  const ahead = target.x >= state.hero.x - 40
  const distance = Math.hypot(target.x - state.hero.x, target.y - state.hero.y)
  if (!ahead) return cruise - 10
  if (distance < autoAttackRange() * 0.88) return 24
  if (distance < autoAttackRange() + 76) return 46
  return cruise
}

function mutationSummary() {
  const names: string[] = []
  if (state.mutations.swordRide > 0) names.push(`化虹${state.mutations.swordRide}`)
  if (state.mutations.thunderFork > 0) names.push(`雷印${state.mutations.thunderFork}`)
  if (state.mutations.swordDomain > 0) names.push(`剑域${state.mutations.swordDomain}`)
  if (state.mutations.flameLotus > 0) names.push(`莲火${state.mutations.flameLotus}`)
  return names.length > 0 ? names.join(' / ') : '未觉醒'
}

function activeCharacter() {
  return characters[state.activeCharacter]
}

function artifactLevel(key: ArtifactKey) {
  return state.artifacts[key] ?? 0
}

function hasArtifact(key: ArtifactKey) {
  return artifactLevel(key) > 0
}

function artifactEffectiveLevel(key: ArtifactKey) {
  if (!hasArtifact(key)) return 0
  return artifactLevel(key) + (activeCharacter().starter[key] ?? 0)
}

function effectiveSkill(key: keyof SkillTree) {
  if (key === 'points') return state.skills.points
  return artifactEffectiveLevel(key)
}

function heroIsMoving() {
  return manualMoving() || autoWorldWalk > 0
}

function heroVisualFacing() {
  if (state.mode === 'wild' && autoWorldWalk > 0 && !manualMoving()) return 0
  return heroFacing
}

function shouldFlipHeroSprite() {
  return Math.cos(heroVisualFacing()) < -0.2
}

function equipIfBetter(item: Reward) {
  if (!item.slot) return
  const old = state.gear[item.slot]
  const oldScore = old ? equipmentScore(old) : 0
  const newScore = equipmentScore(item)
  if (newScore > oldScore) {
    state.gear[item.slot] = item
    state.hero.hp = Math.min(maxHp(), state.hero.hp + 18)
    toast(`已装备：${item.name}`)
  }
}

function equipManual(item: Reward) {
  if (!item.slot) return
  state.gear[item.slot] = item
  state.hero.hp = Math.min(maxHp(), state.hero.hp + 12)
  toast(`已切换装备：${item.name}`)
  saveGame()
  if (!equipPanel.hidden) renderEquipPanel()
  if (!bagPanel.hidden) renderBagPanel()
  updateHud()
}

function equipmentScore(item: Reward) {
  return rarityRank[item.rarity] * 100 + (item.atk ?? 0) + (item.hp ?? 0) + (item.skill ?? 0)
}

function sameEquipment(a: Reward | null, b: Reward) {
  return !!a && a.name === b.name && a.rarity === b.rarity && a.slot === b.slot && itemStats(a) === itemStats(b)
}

function autoEquipBest() {
  let changed = 0
  ;(['weapon', 'armor', 'core'] as Slot[]).forEach((slot) => {
    const best = state.bag
      .filter((item) => item.slot === slot)
      .sort((a, b) => equipmentScore(b) - equipmentScore(a))[0]
    if (best && equipmentScore(best) > (state.gear[slot] ? equipmentScore(state.gear[slot]!) : 0)) {
      state.gear[slot] = best
      changed += 1
    }
  })
  if (changed > 0) {
    state.hero.hp = Math.min(maxHp(), state.hero.hp + 18)
    toast(`已自动换上 ${changed} 件更强装备。`)
  } else {
    toast('当前已是背包内最优装备。')
  }
  saveGame()
  renderEquipPanel()
  updateHud()
}

function gainCharacterShards(item: Reward) {
  if (!item.characterId) return
  const def = characters[item.characterId]
  const before = state.characterShards[item.characterId] ?? 0
  const after = before + item.count
  state.characterShards[item.characterId] = after
  if (!state.ownedCharacters.includes(item.characterId) && after >= def.need) {
    state.ownedCharacters.push(item.characterId)
    toast(`角色合成：${def.name}`)
    state.texts.push({ x: state.hero.x, y: state.hero.y - 92, text: `合成角色：${def.name}`, color: def.color, life: 1.2 })
  }
}

function switchCharacter(id: CharacterId) {
  if (!state.ownedCharacters.includes(id)) {
    const def = characters[id]
    const have = state.characterShards[id] ?? 0
    toast(`${def.name} 碎片 ${have}/${def.need}`)
    return
  }
  state.activeCharacter = id
  state.hero.hp = Math.min(maxHp(), state.hero.hp + 30)
  toast(`已出战：${characters[id].name}`)
  saveGame()
  if (!equipPanel.hidden) renderEquipPanel()
  if (!bagPanel.hidden) renderBagPanel()
  updateHud()
}

function itemStats(item: Reward) {
  const parts = []
  if (item.characterId) return `${characters[item.characterId].name} 碎片 +${item.count}`
  if (item.artifact) return `${artifactDefs[item.artifact].type} · 法宝等级 +${item.count}`
  if (item.atk) parts.push(`攻击 +${item.atk}`)
  if (item.hp) parts.push(`生命 +${item.hp}`)
  if (item.skill) parts.push(`法宝威力 +${item.skill}`)
  return parts.join(' / ') || `数量 x${item.count}`
}

function slotName(slot?: Slot) {
  if (slot === 'weapon') return '武器'
  if (slot === 'armor') return '护甲'
  if (slot === 'core') return '核心'
  return '材料'
}

function characterSigil(def: CharacterDef) {
  if (def.id === 'thunder') return '雷'
  if (def.id === 'flame') return '符'
  if (def.id === 'wood') return '木'
  return '剑'
}

function equipIcon(slot?: Slot) {
  if (slot === 'weapon') return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M31 5 17 25l6 6L43 16 31 5Z"/><path d="m17 27-9 9 4 4 9-9"/><path d="M10 39 5 44"/></svg>`
  if (slot === 'armor') return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 40 11v12c0 10-6 17-16 21C14 40 8 33 8 23V11l16-6Z"/><path d="M15 24h18"/><path d="M24 13v22"/></svg>`
  if (slot === 'core') return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="6"/><path d="M24 4v8M24 36v8M4 24h8M36 24h8"/></svg>`
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 31 18 45 20 35 31 38 45 24 38 10 45 13 31 3 20 17 18 24 5Z"/></svg>`
}

function materialIcon(item: Reward) {
  const src = materialIconSrc(item)
  return `<img src="${src}" alt="">`
}

function materialIconSrc(item: Reward) {
  if (item.name.includes('草')) return '/assets/item-icons/alchemy-herbs/PNG/without_shadow/14.png'
  if (item.name.includes('丹') || item.hp) return '/assets/item-icons/rpg_inventory/RPG Inventory/Potions/PotionHp_Big.png'
  if (item.name.includes('矿') || item.atk) return '/assets/item-icons/rpg_inventory/RPG Inventory/Crafting/Ore_03.png'
  if (item.name.includes('晶') || item.name.includes('石') || item.skill) return '/assets/item-icons/rpg_inventory/RPG Inventory/Crafting/Gem_06.png'
  if (item.rarity === '传说') return '/assets/item-icons/rpg_inventory/RPG Inventory/Crafting/Gem_05.png'
  if (item.rarity === '史诗') return '/assets/item-icons/rpg_inventory/RPG Inventory/Crafting/Gem_04.png'
  if (item.rarity === '稀有') return '/assets/item-icons/rpg_inventory/RPG Inventory/Crafting/Gem_02.png'
  return '/assets/item-icons/rpg_inventory/RPG Inventory/Crafting/Stone.png'
}

function characterShardIcon(def: CharacterDef) {
  return `<span class="character-shard-art" style="--role-color:${def.color}"><img src="${def.portrait}" alt=""><u>${characterSigil(def)}</u></span>`
}

function rewardIcon(reward: Reward) {
  if (reward.characterId) return characterShardIcon(characters[reward.characterId])
  if (reward.artifact) return artifactIcon(reward.artifact)
  if (reward.slot) return equipIcon(reward.slot)
  return materialIcon(reward)
}

function rewardKind(reward: Reward) {
  if (reward.characterId) return `${characters[reward.characterId].name}碎片`
  if (reward.artifact) return '法宝'
  if (reward.slot) return slotName(reward.slot)
  return '材料'
}

function rewardNote(reward: Reward) {
  if (reward.characterId) return `${characters[reward.characterId].name} ${state.characterShards[reward.characterId]}/${characters[reward.characterId].need}`
  if (reward.artifact) return hasArtifact(reward.artifact) ? '重复获得会进阶并返还法宝精华' : '副本法宝，获得后自动解锁对应仙术'
  if (reward.slot) return sameEquipment(state.gear[reward.slot], reward) ? '已自动穿戴或可在装备页替换' : '已收入装备页'
  return '材料收入背包'
}

function artifactIcon(key: ArtifactKey) {
  const def = artifactDefs[key]
  return `<img class="artifact-art" src="${def.image}" alt="">`
}

function renderDungeonPanel() {
  dungeonEntrySummary.textContent = `入场 ${state.dungeonEntries}/3 | 当前 Lv.${state.hero.level}`
  dungeonBriefCopy.textContent = state.mode === 'dungeon'
    ? `正在挑战 ${activeDungeonDef().name}，回到战斗页可继续探索或靠近撤离门。`
    : '副本会消耗每日入场次数；收集门钥碎片后找到撤离门，才能带走抽卡券和法宝。'
  dungeonList.innerHTML = ''
  dungeonDefs.forEach((dungeon) => {
    const theme = stageThemes[dungeon.themeIndex] ?? stageThemes[0]
    const locked = state.hero.level < dungeon.unlockLevel
    const active = state.activeDungeon === dungeon.id
    const card = document.createElement('article')
    card.className = `dungeon-card ${active ? 'active' : ''} ${locked ? 'locked' : ''}`
    card.style.setProperty('--dungeon-color', dungeon.color)
    card.style.setProperty('--dungeon-bg', theme.ground)
    const drops = dungeon.artifactFocus
      .map((key) => `<span style="--item-color:${artifactDefs[key].color}">${artifactIcon(key)}<b>${artifactDefs[key].name}</b></span>`)
      .join('')
    card.innerHTML = `
      <div class="dungeon-card-art">
        <i></i><em>${locked ? `Lv.${dungeon.unlockLevel}` : '可进入'}</em>
      </div>
      <div class="dungeon-card-main">
        <small>${theme.name} | ${dungeon.threat}</small>
        <b>${dungeon.name}</b>
        <p>${dungeon.subtitle}</p>
      </div>
      <div class="dungeon-stats">
        <span><small>时间</small><b>${dungeon.timeLimit}s</b></span>
        <span><small>目标</small><b>${dungeon.killGoal}怪</b></span>
        <span><small>门钥</small><b>${dungeon.materialGoal}</b></span>
      </div>
      <div class="dungeon-drop-row">${drops}</div>
      <p class="dungeon-trait">${dungeon.trait}</p>
    `
    const action = document.createElement('button')
    action.type = 'button'
    action.className = 'dungeon-enter'
    action.disabled = locked || state.dungeonEntries <= 0 || state.mode === 'dungeon'
    action.textContent = state.mode === 'dungeon'
      ? '挑战中'
      : locked
        ? `Lv.${dungeon.unlockLevel} 解锁`
        : state.dungeonEntries <= 0
          ? '次数不足'
          : '进入副本'
    action.addEventListener('click', (event) => {
      event.stopPropagation()
      enterDungeon(dungeon.id)
    })
    card.append(action)
    card.addEventListener('click', () => {
      state.activeDungeon = dungeon.id
      saveGame()
      renderDungeonPanel()
    })
    dungeonList.append(card)
  })
}

function renderEquipPanel() {
  equippedList.innerHTML = ''
  const active = activeCharacter()
  const summary = document.createElement('div')
  summary.className = 'gear-card character-active equipment-summary'
  summary.style.borderColor = active.color
  summary.innerHTML = `
    <div class="character-portrait" style="--role-color:${active.color}">
      <img src="${active.portrait}" alt="">
      <i>${characterSigil(active)}</i>
    </div>
    <div class="gear-card-copy">
      <b>装备方案</b>
      <span>${active.name} · 战力 ${totalAtk()}</span>
      <small>${active.title} | 生命 ${maxHp()} | 法宝威力 ${skillPower()}</small>
    </div>
  `
  equippedList.appendChild(summary)
  ;(['weapon', 'armor', 'core'] as Slot[]).forEach((slot) => {
    const item = state.gear[slot]
    const div = document.createElement('div')
    div.className = `gear-card equip-slot ${item ? 'equipped' : 'empty'}`
    div.innerHTML = `
      <i class="equip-icon">${equipIcon(slot)}</i>
      <div class="gear-card-copy">
        <b>${slotName(slot)}</b>
        <span>${item ? item.name : '未装备'}</span>
        <small>${item ? itemStats(item) : '抽卡获得装备后可穿戴'}</small>
      </div>
    `
    if (item) {
      div.style.borderColor = rarityColor[item.rarity]
      div.style.setProperty('--item-color', rarityColor[item.rarity])
    }
    equippedList.appendChild(div)
  })

  equipList.innerHTML = ''
  const action = document.createElement('button')
  action.type = 'button'
  action.className = 'bag-row equip-action'
  action.innerHTML = `
    <i class="equip-icon">${equipIcon()}</i>
    <div class="bag-row-copy">
      <span>自动比较背包内装备</span>
      <b>一键穿戴最强</b>
      <small>按稀有度和属性评分替换武器、护甲、核心</small>
    </div>
  `
  action.addEventListener('click', autoEquipBest)
  equipList.appendChild(action)

  const equipTitle = document.createElement('div')
  equipTitle.className = 'bag-section-title'
  equipTitle.textContent = '可替换装备'
  equipList.appendChild(equipTitle)
  const equips = state.bag
    .filter((item) => item.slot)
    .sort((a, b) => {
      const slotOrder = slotOrderValue(a.slot) - slotOrderValue(b.slot)
      return slotOrder || equipmentScore(b) - equipmentScore(a)
    })
    .slice(0, 80)
  if (equips.length === 0) {
    equipList.insertAdjacentHTML('beforeend', '<div class="empty-note">还没有装备，进副本拿抽卡券后去星门补给。</div>')
    return
  }
  equips.forEach((item) => {
    const equipped = sameEquipment(state.gear[item.slot!], item)
    const row = document.createElement('button')
    row.type = 'button'
    row.className = `bag-row equip-row ${equipped ? 'selected' : ''}`
    row.style.borderColor = rarityColor[item.rarity]
    row.style.setProperty('--item-color', rarityColor[item.rarity])
    row.innerHTML = `
      <i class="equip-icon" style="--item-color:${rarityColor[item.rarity]}">${equipIcon(item.slot)}</i>
      <div class="bag-row-copy">
        <span style="color:${rarityColor[item.rarity]}">${equipped ? '已穿戴' : '点击穿戴'} · ${item.rarity} · ${slotName(item.slot)}</span>
        <b>${item.name}</b>
        <small>${itemStats(item)}</small>
      </div>
    `
    row.addEventListener('click', () => equipManual(item))
    equipList.appendChild(row)
  })
}

function slotOrderValue(slot?: Slot) {
  if (slot === 'weapon') return 1
  if (slot === 'armor') return 2
  if (slot === 'core') return 3
  return 9
}

function renderBagPanel() {
  bagList.innerHTML = ''
  const allMaterials = state.bag.filter((item) => !item.slot && !item.characterId)
  const totalSlots = Math.max(24, Math.ceil((Object.keys(characters).length + allMaterials.length) / 4) * 4)
  bagList.classList.add('inventory')
  bagList.innerHTML = `
    <div class="inventory-top">
      <div><small>随身仓库</small><b>${Object.keys(characters).length + allMaterials.length}/${totalSlots}</b></div>
      <div><small>抽卡券</small><b>${state.tickets}</b></div>
      <div><small>副本入场</small><b>${state.dungeonEntries}/3</b></div>
    </div>
    <div class="inventory-section">角色碎片</div>
    <div id="character-grid" class="inventory-grid"></div>
    <div class="inventory-section">材料道具</div>
    <div id="material-grid" class="inventory-grid"></div>
    <div id="bag-detail" class="bag-detail"><small>点击一个格子查看详情</small><b>背包</b><span>装备已经移到“装备”页，这里只放碎片、材料和消耗品。</span></div>
  `
  const characterGrid = bagList.querySelector<HTMLDivElement>('#character-grid')!
  const materialGrid = bagList.querySelector<HTMLDivElement>('#material-grid')!
  const detail = bagList.querySelector<HTMLDivElement>('#bag-detail')!
  const showDetail = (title: string, meta: string, desc: string, color: string) => {
    detail.style.setProperty('--item-color', color)
    detail.innerHTML = `<small>${meta}</small><b>${title}</b><span>${desc}</span>`
  }
  ;(Object.values(characters) as CharacterDef[]).forEach((def) => {
    const owned = state.ownedCharacters.includes(def.id)
    const shards = state.characterShards[def.id] ?? 0
    const cell = document.createElement('button')
    cell.type = 'button'
    cell.className = `inventory-cell shard-cell ${owned ? 'owned' : ''}`
    cell.style.setProperty('--item-color', def.color)
    const progress = Math.min(100, (shards / def.need) * 100)
    cell.innerHTML = `
      <i>${characterShardIcon(def)}</i>
      <em><u style="width:${owned ? 100 : progress}%"></u></em>
      <span>${owned ? '已合成' : `${Math.min(shards, def.need)}/${def.need}`}</span>
    `
    cell.addEventListener('click', () => {
      showDetail(def.name, owned ? (state.activeCharacter === def.id ? '出战中' : '已合成角色') : `角色碎片 ${Math.min(shards, def.need)}/${def.need}`, def.desc, def.color)
      if (owned) switchCharacter(def.id)
    })
    characterGrid.appendChild(cell)
  })

  allMaterials.slice(0, 80).forEach((item) => {
    const cell = document.createElement('button')
    cell.type = 'button'
    cell.className = `inventory-cell material-cell rarity-${rarityRank[item.rarity]}`
    cell.style.setProperty('--item-color', rarityColor[item.rarity])
    cell.innerHTML = `
      <i>${materialIcon(item)}</i>
      <span>x${item.count}</span>
    `
    cell.addEventListener('click', () => showDetail(item.name, `${item.rarity} · 材料`, itemStats(item), rarityColor[item.rarity]))
    materialGrid.appendChild(cell)
  })
  const emptySlots = Math.max(12, Math.ceil(Math.max(1, allMaterials.length) / 4) * 4) - allMaterials.length
  for (let i = 0; i < emptySlots; i += 1) {
    const empty = document.createElement('div')
    empty.className = 'inventory-cell empty-cell'
    materialGrid.appendChild(empty)
  }
}

function renderSkillPanel() {
  const ownedCount = artifactKeys.filter((key) => hasArtifact(key)).length
  const maxedCount = artifactKeys.filter((key) => hasArtifact(key) && artifactLevel(key) >= artifactDefs[key].max).length
  if (!artifactKeys.includes(selectedArtifactKey)) selectedArtifactKey = 'slash'
  skillPointsLabel.innerHTML = `
    <span>精华 <b>${state.skills.points}</b></span>
    <span>已获 <b>${ownedCount}/${artifactKeys.length}</b></span>
    <span>满阶 <b>${maxedCount}</b></span>
  `
  skillList.innerHTML = ''
  const switcher = document.createElement('div')
  switcher.className = 'artifact-switch'
  artifactKeys.forEach((key) => {
    const def = artifactDefs[key]
    const owned = hasArtifact(key)
    const level = artifactLevel(key)
    const bonus = owned ? (activeCharacter().starter[key] ?? 0) : 0
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.className = `artifact-tab ${selectedArtifactKey === key ? 'active' : ''} ${owned ? 'owned' : 'locked'}`
    tab.style.setProperty('--item-color', def.color)
    tab.innerHTML = `
      <i>${artifactIcon(key)}</i>
      <span>${def.name}</span>
      <small>${owned ? `Lv.${Math.min(level, def.max)}${bonus > 0 ? `+${bonus}` : ''}` : '未得'}</small>
    `
    tab.addEventListener('click', () => {
      selectedArtifactKey = key
      renderSkillPanel()
    })
    switcher.appendChild(tab)
  })
  skillList.appendChild(switcher)

  const def = artifactDefs[selectedArtifactKey]
  const owned = hasArtifact(selectedArtifactKey)
  const level = artifactLevel(selectedArtifactKey)
  const shownLevel = Math.min(level, def.max)
  const overflow = Math.max(0, level - def.max)
  const bonus = owned ? (activeCharacter().starter[selectedArtifactKey] ?? 0) : 0
  const cost = shownLevel + 1
  const progress = owned ? Math.min(100, (shownLevel / def.max) * 100) : 0
  const detail = document.createElement('div')
  detail.className = `artifact-focus-card ${owned ? 'owned' : 'locked'}`
  detail.style.setProperty('--item-color', def.color)
  detail.innerHTML = `
    <div class="artifact-hero-art">${artifactIcon(selectedArtifactKey)}</div>
    <div class="artifact-copy">
      <small>${def.rarity} · ${def.type}</small>
      <b>${def.name}</b>
      <span>${owned ? `Lv.${shownLevel}/${def.max}${bonus > 0 ? ` · ${activeCharacter().name}亲和 +${bonus}` : ''}${overflow > 0 ? ` · 溢出 ${overflow}` : ''}` : '副本未获得'}</span>
      <p>${def.desc}</p>
    </div>
    <div class="artifact-meter"><i style="width:${progress}%"></i></div>
    <div class="artifact-source">${def.source}</div>
  `
  const action = document.createElement('button')
  action.type = 'button'
  action.className = 'artifact-upgrade'
  if (!owned) {
    action.textContent = '副本掉落'
    action.disabled = true
  } else if (level >= def.max) {
    action.textContent = '已满阶'
    action.disabled = true
  } else {
    action.textContent = `淬炼 · ${cost} 精华`
    action.disabled = state.skills.points < cost
  }
  action.addEventListener('click', () => upgradeSkill(selectedArtifactKey, def.max))
  detail.appendChild(action)
  skillList.appendChild(detail)
}

function upgradeSkill(key: keyof SkillTree, max: number) {
  if (key === 'points') return
  if (!hasArtifact(key)) {
    toast(`先在副本获得法宝：${artifactDefs[key].name}`)
    return
  }
  const cost = artifactLevel(key) + 1
  if (artifactLevel(key) >= max || state.skills.points < cost) return
  state.skills.points -= cost
  state.artifacts[key] += 1
  state.skills[key] = state.artifacts[key]
  toast(`法宝淬炼：${artifactDefs[key].name} +1`)
  saveGame()
  renderSkillPanel()
  updateHud()
}

function cloneReward(item: Reward): Reward {
  return { ...item }
}

function rollArtifactReward(): Reward {
  const stage = state.mode === 'dungeon' ? Math.max(1, Math.ceil(activeDungeonDef().unlockLevel / 8)) : worldStageNo()
  const candidates: ArtifactKey[] = ['slash', 'regen']
  if (state.mode === 'dungeon') {
    candidates.push(...activeDungeonDef().artifactFocus)
  }
  if (stage >= 2 || state.mode === 'dungeon') candidates.push('chain', 'burst')
  if (stage >= 3 || Math.random() < 0.45) candidates.push('orbit')
  if (stage >= 4 || Math.random() < 0.38) candidates.push('flame')
  const key = candidates[Math.floor(Math.random() * candidates.length)]
  const def = artifactDefs[key]
  return { name: def.name, rarity: def.rarity, count: 1, artifact: key, skill: rarityRank[def.rarity] }
}

function rollDungeonDrop(): Reward {
  return Math.random() < 0.68 ? rollArtifactReward() : rollReward()
}

function chooseEnemyKind(elite: boolean): EnemyKind {
  if (elite && Math.random() < 0.34) return 'crystal'
  const stage = state.mode === 'dungeon' ? Math.max(1, Math.ceil(activeDungeonDef().unlockLevel / 8)) : worldStageNo()
  const pool: EnemyKind[] = ['slime']
  if (stage >= 2 || state.mode === 'dungeon') pool.push('bat')
  if (stage >= 3) pool.push('wolf')
  if (stage >= 4 || elite || state.mode === 'dungeon') pool.push('crystal')
  return pool[Math.floor(Math.random() * pool.length)]
}

function enemyStatProfile(kind: EnemyKind) {
  if (kind === 'bat') return { hp: 0.76, speed: 1.38, y: -26 }
  if (kind === 'wolf') return { hp: 1.08, speed: 1.2, y: 0 }
  if (kind === 'crystal') return { hp: 1.42, speed: 0.72, y: 4 }
  if (kind === 'warden') return { hp: 1.5, speed: 0.76, y: 0 }
  return { hp: 1, speed: 1, y: 0 }
}

function spawnEnemy(elite = false) {
  const side = state.mode === 'wild' ? 1 : Math.random() < 0.5 ? -1 : 1
  const distance = state.mode === 'wild' ? 430 + Math.random() * 360 : 320 + Math.random() * 260
  const stageBonus = state.mode === 'wild' ? worldStageNo() * 5 : 0
  const kind = chooseEnemyKind(elite)
  const profile = enemyStatProfile(kind)
  const baseHp = elite ? 100 + state.wave * 18 + stageBonus * 2 : 46 + state.wave * 7 + stageBonus
  const hp = Math.round(baseHp * profile.hp)
  state.enemies.push({
    id: enemyId++,
    x: state.hero.x + side * distance,
    y: state.hero.y + profile.y + (Math.random() - 0.5) * 36,
    hp,
    maxHp: hp,
    speed: (elite ? 58 : 78 + Math.random() * 20) * profile.speed,
    elite,
    kind,
    boss: false,
    hit: 0,
  })
}

function ensureEnemies() {
  if (state.mode === 'dungeon' && state.bossSpawned) return
  if (state.mode === 'wild') {
    state.enemies = state.enemies.filter((enemy) => enemy.x > state.hero.x - 260)
  }
  const target = state.mode === 'dungeon' ? 9 : 6
  while (state.enemies.length < target) spawnEnemy(state.mode === 'dungeon' && Math.random() < 0.25)
}

function spawnBoss() {
  if (state.bossSpawned) return
  state.bossSpawned = true
  const hp = 360 + state.wave * 55 + state.hero.level * 30 + worldStageNo() * 16
  state.enemies = state.enemies.filter((enemy) => !enemy.boss)
  state.enemies.push({
    id: enemyId++,
    x: state.hero.x + 420,
    y: state.hero.y,
    hp,
    maxHp: hp,
    speed: 44,
    elite: true,
    kind: 'warden',
    boss: true,
    hit: 0,
  })
  toast('副本 Boss 已出现，击败它完成结算。')
}

function damageEnemy(enemy: Enemy, amount: number) {
  enemy.hp -= amount
  enemy.hit = 0.18
  const power = Math.min(2.2, 0.72 + amount / 120 + (enemy.elite ? 0.22 : 0) + (enemy.boss ? 0.38 : 0))
  const killed = enemy.hp <= 0
  const knockDir = enemy.x >= state.hero.x ? 1 : -1
  enemy.x += knockDir * (enemy.boss ? 6 : 14) * power
  enemy.y += (Math.random() - 0.5) * (enemy.boss ? 6 : 16)
  state.screenShake = Math.max(state.screenShake, 0.08 * power)
  state.hitStop = Math.max(state.hitStop, Math.min(0.055, 0.018 + amount / 4200))
  sfx.hit(power, killed)
  addParticleBurst(enemy.x, enemy.y - (enemy.boss ? 62 : 34), enemy.boss ? '#facc15' : enemy.elite ? '#fed7aa' : '#e0f2fe', killed ? 28 : 12, killed ? 1.45 : Math.min(1.15, power), enemy.kind === 'crystal' || enemy.kind === 'warden' ? 'shard' : 'spark')
  if (killed) {
    flashScreen(enemy.boss ? 'rgba(250,204,21,.38)' : enemy.elite ? 'rgba(251,146,60,.25)' : 'rgba(224,242,254,.14)', enemy.boss ? 0.28 : enemy.elite ? 0.18 : 0.1, enemy.boss ? 0.28 : 0.16)
  }
  state.effects.push({
    x: enemy.x,
    y: enemy.y - (enemy.boss ? 68 : enemy.kind === 'bat' ? 44 : 32),
    radius: 72 + amount * 0.34 + (enemy.elite ? 18 : 0) + (enemy.boss ? 42 : 0),
    color: enemy.boss ? '#facc15' : enemy.elite ? '#fed7aa' : '#e0f2fe',
    life: 0.24,
    maxLife: 0.24,
    kind: 'impact',
    angle: Math.atan2(enemy.y - state.hero.y, enemy.x - state.hero.x),
  })
  const crit = amount >= totalAtk() + skillPower()
  state.texts.push({ x: enemy.x + (Math.random() - 0.5) * 12, y: enemy.y - 34, text: `${crit ? '破！' : ''}-${amount}`, color: crit ? '#fef08a' : '#fff', life: 0.78 })
  if (enemy.hp > 0) return

  state.enemies = state.enemies.filter((e) => e.id !== enemy.id)
  spawnSoulOrb(enemy)
  if (enemy.boss) {
    completeDungeon()
    saveGame()
    return
  }
  state.kills += 1
  if (state.mode === 'dungeon') {
    const dungeonKillNo = state.kills - state.dungeonStartKills
    const expGain = enemy.elite ? 22 : 10
    const ticketGain = enemy.elite || dungeonKillNo % 2 === 0 || Math.random() < 0.28 ? 1 : 0
    const skillGain = enemy.elite && Math.random() < 0.55 ? 1 : 0
    state.dungeonLootExp += expGain
    state.dungeonLootTickets += ticketGain
    state.dungeonLootSkill += skillGain
    state.texts.push({ x: enemy.x, y: enemy.y - 44, text: `携带 经验+${expGain}`, color: '#93c5fd', life: 0.85 })
    if (ticketGain > 0) state.texts.push({ x: enemy.x + 18, y: enemy.y - 66, text: '抽卡券+1', color: '#facc15', life: 0.9 })
    if (skillGain > 0) state.texts.push({ x: enemy.x - 18, y: enemy.y - 86, text: '法宝精华+1', color: '#c084fc', life: 0.9 })
    if (!state.dungeonGateFound && (enemy.elite || dungeonKillNo % 3 === 0 || Math.random() < 0.35)) {
      gainDungeonMaterial(enemy.x, enemy.y, enemy.elite ? '完整门钥' : '门钥碎片')
    }
  } else {
    const expGain = enemy.elite ? 18 : 8
    grantExp(expGain)
  }

  if (!state.questClaimed && state.kills >= state.questTarget) {
    state.questClaimed = true
    if (state.mode === 'dungeon') state.dungeonLootTickets += 5
    else grantExp(60)
    toast(state.mode === 'dungeon' ? '世界线任务完成：携带 5 张抽卡券。' : '世界线任务完成：获得 60 经验。抽卡券和法宝请进副本带出。')
  }

  if (state.mode === 'wild' && state.kills % 10 === 0) {
    state.wave += 1
    toast('新的怪物潮正在靠近。')
  }

  if (state.mode === 'dungeon' && state.kills >= state.dungeonGoal && !state.bossSpawned) {
    spawnBoss()
  }
  saveGame()
}

function completeDungeon() {
  const dungeon = activeDungeonDef()
  const kills = Math.max(0, state.kills - state.dungeonStartKills)
  const ticketReward = state.dungeonLootTickets + dungeon.ticketBonus + Math.floor(kills / 4)
  const expReward = state.dungeonLootExp + dungeon.expBonus + kills * 3
  const skillReward = state.dungeonLootSkill + dungeon.skillBonus + Math.floor(kills / 6)
  const bossDrop = rollDungeonDrop()
  sfx.level()
  flashScreen('rgba(250,204,21,.26)', 0.22, 0.28)

  state.tickets += ticketReward
  grantExp(expReward)
  state.skills.points += skillReward
  if (bossDrop) {
    acceptReward(bossDrop)
  }

  state.lastSettlement = `击杀 ${kills} | 抽卡券 +${ticketReward} | 经验 +${expReward} | 法宝精华 +${skillReward} | Boss 掉落：${bossDrop.name}`
  renderSettlement({
    result: `${dungeon.name}通关`,
    subtitle: `${dungeon.subtitle}已稳定，战利品已同步回主世界线`,
    rank: dungeonRank(kills, true, true),
    tone: 'clear',
    kills,
    rewards: { tickets: ticketReward, exp: expReward, skill: skillReward },
    lines: [
      `门钥碎片：${state.dungeonMaterials}/${state.dungeonMaterialGoal}`,
      `秘境特性：${dungeon.trait}`,
      `Boss 掉落：${bossDrop.rarity} ${bossDrop.name}`,
      `结算方式：击败守门人后自动带回全部收益`,
    ],
    drop: bossDrop,
  })
  settlementPanel.hidden = false
  leaveDungeon('副本通关，结算奖励已发放。')
}

function extractDungeon() {
  const dungeon = activeDungeonDef()
  if (!state.dungeonGateFound) {
    toast(`撤离门未定位，先收集门钥碎片 ${state.dungeonMaterials}/${state.dungeonMaterialGoal}。`)
    return
  }
  const distance = Math.hypot(state.hero.x - state.dungeonExtractX, state.hero.y - state.dungeonExtractY)
  if (distance > 78) {
    toast('撤离门太远，靠近蓝色撤离圈后才能撤离。')
    return
  }
  const kills = Math.max(0, state.kills - state.dungeonStartKills)
  const ticketReward = state.dungeonLootTickets
  const expReward = state.dungeonLootExp
  const skillReward = state.dungeonLootSkill
  const extractDrop = kills >= 4 && Math.random() < 0.42 ? rollArtifactReward() : null
  sfx.soul(4)
  flashScreen('rgba(94,234,212,.2)', 0.16, 0.22)

  state.tickets += ticketReward
  grantExp(expReward)
  state.skills.points += skillReward
  if (extractDrop) acceptReward(extractDrop)

  renderSettlement({
    result: `${dungeon.name}撤离`,
    subtitle: '你在秘境坍塌前带走了携带战利品',
    rank: dungeonRank(kills, true, false),
    tone: 'extract',
    kills,
    rewards: { tickets: ticketReward, exp: expReward, skill: skillReward },
    lines: [
      `门钥碎片：${state.dungeonMaterials}/${state.dungeonMaterialGoal}`,
      `当前秘境：${dungeon.subtitle}`,
      `撤离距离：已抵达撤离门`,
      extractDrop ? `撤离搜获：${extractDrop.rarity} ${extractDrop.name}` : '撤离搜获：未发现完整法宝',
      ticketReward + expReward + skillReward > 0 ? '携带收益已全部入账' : '本次携带收益较少，建议多刷几波再撤离',
    ],
    drop: extractDrop,
  })
  settlementPanel.hidden = false
  leaveDungeon('撤离成功，已带走副本收益。')
}

function failDungeon(reason: string) {
  const dungeon = activeDungeonDef()
  const kills = Math.max(0, state.kills - state.dungeonStartKills)
  sfx.hit(1.4, true)
  flashScreen('rgba(251,113,133,.22)', 0.18, 0.2)
  renderSettlement({
    result: `${dungeon.name}失败`,
    subtitle: '副本空间坍塌，未撤出的携带收益已遗失',
    rank: 'D',
    tone: 'fail',
    kills,
    rewards: { tickets: 0, exp: 0, skill: 0 },
    lines: [
      reason,
      `遗失携带：抽卡券 ${state.dungeonLootTickets} / 经验 ${state.dungeonLootExp} / 法宝精华 ${state.dungeonLootSkill}`,
      `门钥碎片：${state.dungeonMaterials}/${state.dungeonMaterialGoal}`,
    ],
  })
  settlementPanel.hidden = false
  leaveDungeon(reason)
}

function dungeonRank(kills: number, success: boolean, bossClear: boolean) {
  if (!success) return 'D'
  if (bossClear && kills >= 14) return 'SS'
  if (bossClear) return 'S'
  if (kills >= 10) return 'A'
  if (kills >= 5) return 'B'
  return 'C'
}

function renderSettlement(options: {
  result: string
  subtitle: string
  rank: string
  tone: 'clear' | 'extract' | 'fail'
  kills: number
  rewards: { tickets: number; exp: number; skill: number }
  lines: string[]
  drop?: Reward | null
}) {
  const rewardTotal = options.rewards.tickets + options.rewards.exp + options.rewards.skill
  const dropHtml = options.drop
    ? `<div class="settlement-drop" style="--drop-color:${rarityColor[options.drop.rarity]};--item-color:${rarityColor[options.drop.rarity]}"><i class="reward-icon">${rewardIcon(options.drop)}</i><div><b>${options.drop.rarity}</b><span>${options.drop.name}</span><small>${options.drop.artifact ? '已收入法宝库' : options.drop.slot ? '已自动比较装备' : `数量 x${options.drop.count}`}</small></div></div>`
    : ''
  settlementResults.innerHTML = `
    <div class="settlement-card ${options.tone}">
      <div class="settlement-hero">
        <div>
          <small>${options.tone === 'fail' ? '裂隙记录' : '虚境战报'}</small>
          <b>${options.result}</b>
          <span>${options.subtitle}</span>
        </div>
        <i>${options.rank}</i>
      </div>
      <div class="settlement-rewards">
        <div><small>抽卡券</small><b>+${options.rewards.tickets}</b></div>
        <div><small>经验</small><b>+${options.rewards.exp}</b></div>
        <div><small>法宝精华</small><b>+${options.rewards.skill}</b></div>
      </div>
      <div class="settlement-meter"><i style="width:${Math.min(100, 18 + rewardTotal * 1.8)}%"></i></div>
      <div class="settlement-lines">
        <span>击杀 ${options.kills}</span>
        ${options.lines.map((line) => `<span>${line}</span>`).join('')}
      </div>
      ${dropHtml}
    </div>
  `
}

function leaveDungeon(message: string) {
  state.mode = 'wild'
  state.dungeonTime = 0
  state.bossSpawned = false
  state.enemies = []
  state.soulOrbs = []
  state.dungeonLootTickets = 0
  state.dungeonLootExp = 0
  state.dungeonLootSkill = 0
  state.dungeonMaterials = 0
  state.dungeonGateFound = false
  collectedMaterialCells = new Set()
  toast(message)
  saveGame()
}

function gainDungeonMaterial(x: number, y: number, label: string) {
  if (state.mode !== 'dungeon' || state.dungeonGateFound) return
    state.dungeonMaterials = Math.min(state.dungeonMaterialGoal, state.dungeonMaterials + 1)
  sfx.soul(2)
  addParticleBurst(x, y - 42, '#38bdf8', 16, 0.9, 'rune')
  state.texts.push({ x, y: y - 58, text: `+${label}`, color: '#38bdf8', life: 0.9 })
  if (state.dungeonMaterials >= state.dungeonMaterialGoal) {
    state.dungeonGateFound = true
    const angle = Math.random() * Math.PI * 2
    const distance = 260 + Math.random() * 160
    state.dungeonExtractX = state.hero.x + (Math.cos(angle) < 0 ? -1 : 1) * distance
    state.dungeonExtractY = state.hero.y
    flashScreen('rgba(56,189,248,.18)', 0.15, 0.18)
    toast('门钥完整，撤离门已显现。')
  } else {
    toast(`获得${label} ${state.dungeonMaterials}/${state.dungeonMaterialGoal}`)
  }
}

function attack(radius: number, multiplier: number, source: AttackSource = multiplier > 1 ? 'skill' : 'manual') {
  if (state.attackCd > 0 && multiplier === 1) return false
  if (state.skillCd > 0 && multiplier > 1) return false
  const inRange = state.enemies
    .filter((enemy) => Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) < radius)
    .sort((a, b) => Math.hypot(a.x - state.hero.x, a.y - state.hero.y) - Math.hypot(b.x - state.hero.x, b.y - state.hero.y))
  if (inRange.length === 0) {
    if (source !== 'auto') toast('目标太远。')
    return false
  }
  const hits = multiplier > 1 ? inRange.slice(0, 5 + state.mutations.swordDomain) : inRange.slice(0, 1 + Math.min(2, state.mutations.swordRide))
  const attackFacing = Math.atan2(hits[0].y - state.hero.y, hits[0].x - state.hero.x)
  if (!heroIsMoving()) heroFacing = attackFacing
  const direction = Math.cos(attackFacing) < 0 ? -1 : 1
  lastAttackFlash = performance.now()
  sfx.slash(multiplier > 1)
  addSlashParticles(state.hero.x + direction * (multiplier > 1 ? 86 : 54), state.hero.y, attackFacing, multiplier > 1 ? '#67e8f9' : '#e0f2fe', multiplier > 1)
  if (multiplier > 1) flashScreen('rgba(103,232,249,.16)', 0.13, 0.14)
  hits.forEach((enemy) => damageEnemy(enemy, Math.round((totalAtk() + skillPower()) * multiplier)))
  state.effects.push({
    x: state.hero.x + direction * (multiplier > 1 ? 96 : 58),
    y: state.hero.y,
    radius: multiplier > 1 ? Math.max(radius, 220 + state.mutations.swordDomain * 30) : radius,
    color: multiplier > 1 ? '#67e8f9' : '#e0f2fe',
    life: multiplier > 1 ? 0.46 + state.mutations.swordDomain * 0.05 : 0.26,
    maxLife: multiplier > 1 ? 0.46 + state.mutations.swordDomain * 0.05 : 0.26,
    kind: multiplier > 1 ? 'shockwave' : 'blade',
    angle: attackFacing,
  })
  if (multiplier === 1 && state.mutations.swordRide > 0) {
    hits.slice(1).forEach((enemy, index) => {
      state.effects.push({
        x: (state.hero.x + enemy.x) / 2,
        y: enemy.y - 10 - index * 16,
        radius: radius + state.mutations.swordRide * 18,
        color: '#bae6fd',
        life: 0.28,
        maxLife: 0.28,
        kind: 'blade',
        angle: Math.atan2(enemy.y - state.hero.y, enemy.x - state.hero.x),
      })
    })
  }
  if (multiplier > 1 && state.mutations.swordDomain > 0) {
    state.texts.push({ x: state.hero.x, y: state.hero.y - 92, text: state.mutations.swordDomain >= 3 ? '万剑剑域·满屏' : '万剑剑域', color: '#a5f3fc', life: 0.9 })
    for (let i = 0; i < state.mutations.swordDomain + 1; i += 1) {
      const offset = (i - state.mutations.swordDomain / 2) * 34
      state.effects.push({
        x: state.hero.x + direction * (128 + i * 26),
        y: state.hero.y + offset,
        radius: Math.max(radius, 240 + state.mutations.swordDomain * 44),
        color: i % 2 === 0 ? '#a5f3fc' : '#67e8f9',
        life: 0.42 + i * 0.04,
        maxLife: 0.42 + i * 0.04,
        kind: 'shockwave',
        angle: attackFacing + (i - state.mutations.swordDomain / 2) * 0.04,
      })
    }
    if (state.mutations.swordDomain >= 2) {
      const screenRadius = 420 + state.mutations.swordDomain * 120
      state.effects.push({
        x: state.hero.x,
        y: state.hero.y,
        radius: screenRadius,
        color: '#a5f3fc',
        life: 0.72,
        maxLife: 0.72,
        kind: 'swordrain',
        angle: attackFacing,
      })
      state.enemies
        .filter((enemy) => Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) <= screenRadius)
        .slice(0, 18 + state.mutations.swordDomain * 8)
        .forEach((enemy) => damageEnemy(enemy, Math.round(totalAtk() * 0.48 + skillPower() * 0.7)))
    }
  }
  state.attackCd = source === 'auto' ? autoAttackDelay() : 0.35
  if (multiplier > 1) state.skillCd = 4.5
  if (source !== 'auto') advanceGuide(1)
  return true
}

function rollReward(): Reward {
  state.pity += 1
  const roll = Math.random() * 100
  let rarity: Rarity = '普通'
  if (state.pity >= 10) rarity = Math.random() < 0.12 ? '传说' : '史诗'
  else if (roll < 1) rarity = '传说'
  else if (roll < 10) rarity = '史诗'
  else if (roll < 38) rarity = '稀有'
  if (rarity === '史诗' || rarity === '传说') state.pity = 0
  const pool = pools[rarity]
  return cloneReward(pool[Math.floor(Math.random() * pool.length)])
}

function acceptReward(reward: Reward) {
  if (reward.characterId) {
    gainCharacterShards(reward)
    return
  }
  if (reward.artifact) {
    gainArtifact(reward)
    return
  }
  state.bag.unshift(reward)
  equipIfBetter(reward)
}

function gainArtifact(reward: Reward) {
  if (!reward.artifact) return
  const key = reward.artifact
  const before = artifactLevel(key)
  const gain = Math.max(1, reward.count)
  state.artifacts[key] = before + gain
  state.skills[key] = state.artifacts[key]
  const essence = Math.max(1, rarityRank[reward.rarity] - 1)
  if (before > 0) state.skills.points += essence
  const label = before > 0 ? `${artifactDefs[key].name} 进阶 +${gain}` : `获得法宝：${artifactDefs[key].name}`
  toast(label)
  sfx.gacha(rarityRank[reward.rarity])
  flashScreen('rgba(250,204,21,.2)', 0.18, 0.22)
  addParticleBurst(state.hero.x, state.hero.y - 90, artifactDefs[key].color, 34, 1.18, 'rune')
  state.texts.push({ x: state.hero.x, y: state.hero.y - 108, text: label, color: artifactDefs[key].color, life: 1.3 })
}

function empowerArtifact(key: ArtifactKey, amount: number) {
  if (!hasArtifact(key)) return
  const def = artifactDefs[key]
  state.artifacts[key] = Math.min(def.max, artifactLevel(key) + amount)
  state.skills[key] = state.artifacts[key]
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function setPulling(active: boolean) {
  pulling = active
  updateHud()
}

async function pull(count: number) {
  if (pulling) return
  if (state.tickets < count) {
    toast('抽卡券不足，进入副本并成功撤离或通关后获得。')
    return
  }
  setPulling(true)
  try {
    state.tickets -= count
    pullResults.innerHTML = ''
    gateCore.classList.add('opening')
    const label = gateCore.querySelector('span')
    if (label) label.textContent = '星门开启中...'
    sfx.gacha(2)
    updateHud()
    await sleep(520)

    let bestReward: Reward | null = null
    for (let i = 0; i < count; i += 1) {
      const reward = rollReward()
      acceptReward(reward)
      sfx.gacha(rarityRank[reward.rarity])
      if (rarityRank[reward.rarity] >= 3) {
        flashScreen(reward.rarity === '传说' ? 'rgba(250,204,21,.26)' : 'rgba(192,132,252,.2)', reward.rarity === '传说' ? 0.22 : 0.16, 0.22)
      }
      if (!bestReward || rarityRank[reward.rarity] > rarityRank[bestReward.rarity]) bestReward = reward
      const row = document.createElement('div')
      row.className = `pull-card rarity-${rarityRank[reward.rarity]} ${rarityRank[reward.rarity] >= 3 ? 'high' : ''}`
      row.style.borderColor = rarityColor[reward.rarity]
      row.style.setProperty('--item-color', rarityColor[reward.rarity])
      row.innerHTML = `
        <i class="reward-icon" style="--item-color:${rarityColor[reward.rarity]}">${rewardIcon(reward)}</i>
        <div class="pull-card-copy">
          <small>${reward.rarity} · ${rewardKind(reward)}</small>
          <b>${reward.name} x${reward.count}</b>
          <span>${rewardNote(reward)}</span>
        </div>
      `
      pullResults.appendChild(row)
      pullResults.scrollTop = pullResults.scrollHeight
      await sleep(count > 1 ? 130 : 280)
    }
    if (label) label.textContent = bestReward ? `${bestReward.rarity}降临` : '补给完成'
    saveGame()
    advanceGuide(2)
  } finally {
    gateCore.classList.remove('opening')
    setPulling(false)
  }
}

function spawnSoulOrb(enemy: Enemy) {
  const count = enemy.boss ? 5 : enemy.elite ? 2 : 1
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const distance = 8 + Math.random() * 24
    state.soulOrbs.push({
      id: soulId++,
      x: enemy.x + Math.cos(angle) * distance,
      y: enemy.y + Math.sin(angle) * distance,
      value: 1,
      life: 18,
      phase: Math.random() * Math.PI * 2,
    })
  }
}

function collectSoulOrbs(dt: number) {
  for (const orb of state.soulOrbs) {
    const dx = state.hero.x - orb.x
    const dy = state.hero.y - orb.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    if (distance < 150) {
      const pull = distance < 55 ? 620 : 280
      orb.x += (dx / distance) * pull * dt
      orb.y += (dy / distance) * pull * dt
    }
    orb.life -= dt
  }

  const remaining: SoulOrb[] = []
  let gained = 0
  for (const orb of state.soulOrbs) {
    const distance = Math.hypot(orb.x - state.hero.x, orb.y - state.hero.y)
    if (distance < 24) {
      gained += orb.value
      state.texts.push({ x: state.hero.x, y: state.hero.y - 32, text: '+魂质', color: '#5eead4', life: 0.65 })
    } else if (orb.life > 0) {
      remaining.push(orb)
    }
  }
  state.soulOrbs = remaining
  if (gained > 0) {
    sfx.soul(gained)
    addParticleBurst(state.hero.x, state.hero.y - 52, '#5eead4', Math.min(20, 5 + gained * 3), 0.72, 'soul')
    gainSoul(gained)
  }
}

function soulNeed(level = state.hero.level) {
  return 4 + Math.floor(level * 1.6)
}

function gainSoul(amount: number) {
  state.soulExp += amount
  if (state.soulExp >= soulNeed() && evolutionPanel.hidden) {
    levelUpSoul()
  }
  saveGame()
}

function levelUpSoul() {
  state.soulExp -= soulNeed()
  state.hero.level += 1
  state.hero.hp = maxHp()
  sfx.level()
  flashScreen('rgba(94,234,212,.2)', 0.17, 0.22)
  addParticleBurst(state.hero.x, state.hero.y - 70, '#5eead4', 34, 1.22, 'rune')
  openEvolutionPanel()
  updateHud()
}

function enterDungeon(dungeonId: DungeonId = state.activeDungeon) {
  if (state.mode === 'dungeon') {
    extractDungeon()
    return
  }
  const dungeon = dungeonDefs.find((item) => item.id === dungeonId) ?? dungeonDefs[0]
  if (state.hero.level < dungeon.unlockLevel) {
    toast(`需要 Lv.${dungeon.unlockLevel} 才能进入 ${dungeon.name}。`)
    updateHud()
    return
  }
  if (state.dungeonEntries <= 0) {
    toast('今日副本入场次数已用完，明天刷新 3 次。')
    updateHud()
    return
  }
  state.activeDungeon = dungeon.id
  state.dungeonEntries -= 1
  state.mode = 'dungeon'
  state.enemies = []
  state.soulOrbs = []
  state.dungeonTime = dungeon.timeLimit
  state.dungeonStartKills = state.kills
  state.dungeonGoal = state.kills + dungeon.killGoal
  state.dungeonMaterialGoal = dungeon.materialGoal
  const extractAngle = Math.random() * Math.PI * 2
  const extractDistance = 280 + Math.random() * 180 + Math.max(0, dungeon.materialGoal - 3) * 22
  state.dungeonExtractX = state.hero.x + (Math.cos(extractAngle) < 0 ? -1 : 1) * extractDistance
  state.dungeonExtractY = state.hero.y
  state.dungeonLootTickets = 0
  state.dungeonLootExp = 0
  state.dungeonLootSkill = 0
  state.dungeonMaterials = 0
  state.dungeonGateFound = false
  collectedMaterialCells = new Set()
  state.bossSpawned = false
  sfx.gacha(3)
  flashScreen('rgba(56,189,248,.18)', 0.16, 0.2)
  toast(`${dungeon.name}开启：剩余入场 ${state.dungeonEntries}/3。收集门钥碎片，撤离带走抽卡券和法宝。`)
  advanceGuide(4)
  showPage('battle')
  saveGame()
}

function update(dt: number) {
  if (!evolutionPanel.hidden) {
    updateHud()
    return
  }
  state.screenShake = Math.max(0, state.screenShake - dt * 1.65)
  state.hitStop = Math.max(0, state.hitStop - dt)
  if (state.hitStop > 0) {
    updateHud()
    return
  }
  state.attackCd = Math.max(0, state.attackCd - dt)
  state.skillCd = Math.max(0, state.skillCd - dt)
  state.chainCd = Math.max(0, state.chainCd - dt)
  state.orbitCd = Math.max(0, state.orbitCd - dt)
  state.flameCd = Math.max(0, state.flameCd - dt)
  moveTargetPulse = Math.max(0, moveTargetPulse - dt)
  updateClickMovement()
  const autoSpeed = autoWorldSpeed()
  autoWorldWalk = autoSpeed
  const moveX = manualMoving() ? input.x * (state.mode === 'dungeon' ? 190 : 170) : autoSpeed
  state.hero.x += moveX * dt
  state.hero.y += input.y * 46 * dt
  state.hero.y = Math.max(-44, Math.min(44, state.hero.y))
  if (manualMoving()) heroFacing = input.x < -0.08 ? Math.PI : 0
  else if (autoSpeed > 0) heroFacing = 0

  if (state.mode === 'dungeon') {
    state.dungeonTime -= dt
    if (state.dungeonTime <= 0) {
      failDungeon('副本时间结束，撤离失败。')
      updateHud()
      return
    }
  }
  if (effectiveSkill('regen') > 0 && state.hero.hp < maxHp()) {
    state.hero.hp = Math.min(maxHp(), state.hero.hp + effectiveSkill('regen') * 1.6 * dt)
    state.healPulse = Math.max(0, state.healPulse - dt)
    if (state.healPulse <= 0) {
      state.healPulse = 2.2
      sfx.heal()
      addParticleBurst(state.hero.x, state.hero.y - 42, '#86efac', 12, 0.72, 'soul')
      state.effects.push({
        x: state.hero.x,
        y: state.hero.y - 20,
        radius: 118 + effectiveSkill('regen') * 8,
        color: '#86efac',
        life: 0.85,
        maxLife: 0.85,
        kind: 'heal',
      })
    }
  }

  ensureEnemies()
  for (const enemy of state.enemies) {
    const dx = state.hero.x - enemy.x
    const dy = state.hero.y - enemy.y
    const d = Math.max(1, Math.hypot(dx, dy))
    enemy.x += (dx / d) * enemy.speed * dt
    enemy.y += (dy / d) * enemy.speed * 0.35 * dt
    enemy.y = Math.max(-52, Math.min(52, enemy.y))
    enemy.hit = Math.max(0, enemy.hit - dt)
    if (d < 34) state.hero.hp = Math.max(0, state.hero.hp - (enemy.elite ? 10 : 5) * dt)
  }
  collectSoulOrbs(dt)
  autoAttack()
  autoSkill()
  autoChainLightning()
  autoOrbitBlade()
  autoFlameBurst()

  if (state.hero.hp <= 0) {
    state.hero.hp = maxHp()
    state.hero.x = 0
    state.hero.y = 0
    if (state.mode === 'dungeon') failDungeon('生命耗尽，副本收益遗失。')
    else {
      state.enemies = []
      toast('生命耗尽，已在安全点复活。')
    }
  }

  state.texts.forEach((text) => {
    text.y -= 30 * dt
    text.life -= dt
  })
  state.texts = state.texts.filter((text) => text.life > 0)
  state.effects.forEach((effect) => { effect.life -= dt })
  state.effects = state.effects.filter((effect) => effect.life > 0)
  state.particles.forEach((particle) => {
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vx *= 0.985
    particle.vy += (particle.kind === 'ember' ? -8 : particle.kind === 'soul' ? -24 : 62) * dt
    particle.life -= dt
  })
  state.particles = state.particles.filter((particle) => particle.life > 0).slice(-260)
  if (state.screenFlash) {
    state.screenFlash.life -= dt
    if (state.screenFlash.life <= 0) state.screenFlash = null
  }
  updateHud()
}

function autoAttack() {
  if (state.attackCd > 0 || state.enemies.length === 0) return
  const target = nearestEnemy()
  if (!target) return
  const distance = Math.hypot(target.x - state.hero.x, target.y - state.hero.y)
  const range = autoAttackRange()
  if (distance <= range) attack(range, 1, 'auto')
}

function autoSkill() {
  const burstLevel = effectiveSkill('burst')
  if (burstLevel <= 0 || state.skillCd > 0 || state.enemies.length < 2) return
  const target = nearestEnemy()
  if (!target) return
  const distance = Math.hypot(target.x - state.hero.x, target.y - state.hero.y)
  if (distance <= 190 + burstLevel * 10 + state.mutations.swordDomain * 34) attack(190 + burstLevel * 10 + state.mutations.swordDomain * 34, 1.8 + burstLevel * 0.16 + state.mutations.swordDomain * 0.18, 'skill')
}

function autoChainLightning() {
  const chainSkill = effectiveSkill('chain')
  if (chainSkill <= 0 || state.chainCd > 0 || state.enemies.length === 0) return
  const forkLevel = state.mutations.thunderFork
  const targets = state.enemies
    .filter((enemy) => Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) <= 330 + forkLevel * 42)
    .sort((a, b) => Math.hypot(a.x - state.hero.x, a.y - state.hero.y) - Math.hypot(b.x - state.hero.x, b.y - state.hero.y))
    .slice(0, 2 + Math.floor(chainSkill / 2) + forkLevel)
  if (targets.length === 0) return
  sfx.thunder()
  flashScreen('rgba(186,230,253,.18)', forkLevel >= 2 ? 0.18 : 0.11, 0.14)
  addParticleBurst(state.hero.x, state.hero.y - 90, '#bae6fd', 12 + forkLevel * 6, 0.9 + forkLevel * 0.18, 'rune')
  if (forkLevel > 0) state.texts.push({ x: state.hero.x, y: state.hero.y - 92, text: forkLevel >= 3 ? '九霄雷云·满屏' : '雷印分裂', color: '#bae6fd', life: 0.85 })
  if (forkLevel >= 2) {
    const stormRadius = 420 + forkLevel * 120
    state.effects.push({
      x: state.hero.x,
      y: state.hero.y,
      radius: stormRadius,
      color: '#bae6fd',
      life: 0.64,
      maxLife: 0.64,
      kind: 'thunderstorm',
    })
    state.enemies
      .filter((enemy) => Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) <= stormRadius)
      .slice(0, 12 + forkLevel * 8)
      .forEach((enemy) => damageEnemy(enemy, Math.round(totalAtk() * 0.22 + skillPower() * 0.46)))
  }
  let from: Vec = state.hero
  targets.forEach((enemy, index) => {
    damageEnemy(enemy, Math.round((totalAtk() * 0.52 + skillPower() * 0.62) * (1 + chainSkill * 0.08)))
    addParticleBurst(enemy.x, enemy.y - 54, '#bae6fd', 8, 0.85, 'spark')
    state.effects.push({
      x: (from.x + enemy.x) / 2,
      y: (from.y + enemy.y) / 2 - 36,
      radius: Math.hypot(enemy.x - from.x, enemy.y - from.y),
      color: index === 0 ? '#38bdf8' : '#a5f3fc',
      life: 0.2,
      maxLife: 0.2,
      kind: 'bolt',
      angle: Math.atan2(enemy.y - from.y, enemy.x - from.x),
    })
    if (forkLevel > 0 && index > 0) {
      state.effects.push({
        x: enemy.x,
        y: enemy.y - 54,
        radius: 72 + forkLevel * 22,
        color: '#bae6fd',
        life: 0.26,
        maxLife: 0.26,
        kind: 'ring',
      })
      const nearby = state.enemies
        .filter((other) => other.id !== enemy.id && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 140 + forkLevel * 30)
        .slice(0, forkLevel + 1)
      nearby.forEach((other, forkIndex) => {
        damageEnemy(other, Math.round((totalAtk() * 0.28 + skillPower() * 0.34) * (1 + forkLevel * 0.08)))
        state.effects.push({
          x: (enemy.x + other.x) / 2,
          y: (enemy.y + other.y) / 2 - 58 - forkIndex * 8,
          radius: Math.hypot(other.x - enemy.x, other.y - enemy.y),
          color: '#e0f2fe',
          life: 0.18,
          maxLife: 0.18,
          kind: 'bolt',
          angle: Math.atan2(other.y - enemy.y, other.x - enemy.x),
        })
      })
    }
    from = enemy
  })
  state.chainCd = Math.max(1.8, 5.8 - chainSkill * 0.28 - forkLevel * 0.22)
}

function autoOrbitBlade() {
  const orbitSkill = effectiveSkill('orbit')
  if (orbitSkill <= 0 || state.orbitCd > 0) return
  const domainLevel = state.mutations.swordDomain
  const radius = 92 + orbitSkill * 12 + domainLevel * 24
  const targets = state.enemies
    .filter((enemy) => Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) <= radius)
    .slice(0, 3 + Math.floor(orbitSkill / 2) + domainLevel)
  if (targets.length === 0 && domainLevel <= 0) return
  sfx.orbit()
  addParticleBurst(state.hero.x, state.hero.y - 34, '#e0f2fe', 16 + domainLevel * 8, 0.9 + domainLevel * 0.16, 'shard')
  if (domainLevel >= 2) flashScreen('rgba(224,242,254,.14)', 0.12, 0.13)
  if (domainLevel > 0) state.texts.push({ x: state.hero.x, y: state.hero.y - 104, text: domainLevel >= 3 ? '剑域铺满' : '剑域展开', color: '#e0f2fe', life: 0.78 })
  targets.forEach((enemy) => damageEnemy(enemy, Math.round(totalAtk() * (0.42 + orbitSkill * 0.05 + domainLevel * 0.04) + skillPower() * 0.28)))
  state.effects.push({
    x: state.hero.x,
    y: state.hero.y,
    radius,
    color: '#bae6fd',
    life: 0.34 + domainLevel * 0.08,
    maxLife: 0.34 + domainLevel * 0.08,
    kind: 'orbit',
  })
  for (let i = 0; i < domainLevel; i += 1) {
    state.effects.push({
      x: state.hero.x,
      y: state.hero.y - 8 + i * 10,
      radius: radius + 34 + i * 24,
      color: i % 2 === 0 ? '#e0f2fe' : '#67e8f9',
      life: 0.4 + i * 0.06,
      maxLife: 0.4 + i * 0.06,
      kind: 'orbit',
    })
  }
  if (domainLevel >= 3) {
    state.effects.push({
      x: state.hero.x,
      y: state.hero.y,
      radius: 520 + domainLevel * 110,
      color: '#e0f2fe',
      life: 0.58,
      maxLife: 0.58,
      kind: 'swordrain',
    })
  }
  state.orbitCd = Math.max(1.2, 4.8 - orbitSkill * 0.22 - domainLevel * 0.25)
}

function autoFlameBurst() {
  const flameSkill = effectiveSkill('flame')
  if (flameSkill <= 0 || state.flameCd > 0 || state.enemies.length < 2) return
  const lotusLevel = state.mutations.flameLotus
  const target = state.enemies
    .map((enemy) => ({
      enemy,
      score: state.enemies.filter((other) => Math.hypot(other.x - enemy.x, other.y - enemy.y) < 120).length,
    }))
    .sort((a, b) => b.score - a.score)[0]
  if (!target || target.score < 2 || Math.hypot(target.enemy.x - state.hero.x, target.enemy.y - state.hero.y) > 380) return
  const radius = 96 + flameSkill * 8 + lotusLevel * 14
  sfx.flame()
  flashScreen('rgba(251,146,60,.18)', lotusLevel >= 2 ? 0.2 : 0.12, 0.16)
  addParticleBurst(target.enemy.x, target.enemy.y - 42, '#fb923c', 22 + lotusLevel * 8, 1 + lotusLevel * 0.18, 'ember')
  state.effects.push({
    x: target.enemy.x,
    y: target.enemy.y,
    radius,
    color: '#fb923c',
    life: 0.42,
    maxLife: 0.42,
    kind: 'flare',
  })
  state.enemies
    .filter((enemy) => Math.hypot(enemy.x - target.enemy.x, enemy.y - target.enemy.y) <= radius)
    .forEach((enemy) => damageEnemy(enemy, Math.round(skillPower() * (0.8 + lotusLevel * 0.1) + totalAtk() * (0.5 + flameSkill * 0.08))))
  if (lotusLevel > 0) {
    state.texts.push({ x: target.enemy.x, y: target.enemy.y - 96, text: lotusLevel >= 3 ? '莲火符海·满屏' : '莲火符海', color: '#fed7aa', life: 0.86 })
    if (lotusLevel >= 2) {
      const seaRadius = 420 + lotusLevel * 130
      state.effects.push({
        x: target.enemy.x,
        y: target.enemy.y,
        radius: seaRadius,
        color: '#fed7aa',
        life: 0.7,
        maxLife: 0.7,
        kind: 'firesea',
      })
      state.enemies
        .filter((enemy) => Math.hypot(enemy.x - target.enemy.x, enemy.y - target.enemy.y) <= seaRadius)
        .slice(0, 14 + lotusLevel * 8)
        .forEach((enemy) => damageEnemy(enemy, Math.round(skillPower() * 0.45 + totalAtk() * 0.22)))
    }
    const sideTargets = state.enemies
      .filter((enemy) => Math.hypot(enemy.x - target.enemy.x, enemy.y - target.enemy.y) <= radius + 70)
      .slice(0, lotusLevel * 2 + 3)
    sideTargets.forEach((enemy, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, sideTargets.length)
      state.effects.push({
        x: enemy.x + Math.cos(angle) * (34 + lotusLevel * 8),
        y: enemy.y + Math.sin(angle) * (12 + lotusLevel * 5),
        radius: 68 + lotusLevel * 16,
        color: '#f97316',
        life: 0.32,
        maxLife: 0.32,
        kind: 'flare',
      })
      damageEnemy(enemy, Math.round(skillPower() * 0.32 + totalAtk() * 0.28))
    })
    for (let i = 0; i < lotusLevel + 2; i += 1) {
      const angle = (Math.PI * 2 * i) / (lotusLevel + 2) + performance.now() * 0.001
      state.effects.push({
        x: target.enemy.x + Math.cos(angle) * (radius * 0.62),
        y: target.enemy.y + Math.sin(angle) * (radius * 0.28),
        radius: 46 + lotusLevel * 12,
        color: '#fed7aa',
        life: 0.28 + i * 0.02,
        maxLife: 0.28 + i * 0.02,
        kind: 'flare',
      })
    }
  }
  state.flameCd = Math.max(2.5, 7.2 - flameSkill * 0.28 - lotusLevel * 0.24)
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function currentEvolutionTier(): EvolutionTier {
  if (state.hero.level >= 8) return '高阶'
  if (state.hero.level >= 4) return '进阶'
  return '初阶'
}

function tierRank(tier: EvolutionTier) {
  return tier === '高阶' ? 3 : tier === '进阶' ? 2 : 1
}

function evolutionRequiredArtifact(id: string): ArtifactKey | null {
  if (id === 'blade' || id === 'mutate-ride') return 'slash'
  if (id === 'nova') return 'burst'
  if (id === 'chain' || id === 'mutate-thunder') return 'chain'
  if (id === 'orbit' || id === 'mutate-domain' || id === 'sweep') return 'orbit'
  if (id === 'flame' || id === 'mutate-flame') return 'flame'
  return null
}

function evolutionOptions(): EvolutionOption[] {
  const tier = currentEvolutionTier()
  const rank = tierRank(tier)
  const pool: EvolutionTemplate[] = [
    {
      id: 'blade',
      title: '本命飞剑',
      color: '#f97316',
      build: (power, cardTier) => ({
        id: 'blade',
        iconId: power >= 3 ? 'blade-3' : power >= 2 ? 'blade-2' : 'blade-1',
        title: '本命飞剑',
        tier: cardTier,
        color: '#f97316',
        desc: `飞剑攻击 +${3 + power * 2}，御剑距离 +${6 + power * 4}。`,
        apply: () => {
          state.hero.baseAtk += 3 + power * 2
          empowerArtifact('slash', power)
        },
      }),
    },
    {
      id: 'vital',
      title: '魂甲共鸣',
      color: '#22c55e',
      build: (power, cardTier) => ({
        id: 'vital',
        iconId: power >= 3 ? 'shield-3' : power >= 2 ? 'shield-2' : 'shield-1',
        title: '魂甲共鸣',
        tier: cardTier,
        color: '#22c55e',
        desc: `生命上限 +${12 + power * 10}，回复 ${25 + power * 10}% 生命。`,
        apply: () => {
          state.hero.baseHp += 12 + power * 10
          state.hero.hp = Math.min(maxHp(), state.hero.hp + maxHp() * (0.25 + power * 0.1))
        },
      }),
    },
    {
      id: 'nova',
      title: '破虚剑罡',
      color: '#a855f7',
      build: (power, cardTier) => ({
        id: 'nova',
        iconId: power >= 3 ? 'nova-3' : power >= 2 ? 'nova-2' : 'nova-1',
        title: '破虚剑罡',
        tier: cardTier,
        color: '#a855f7',
        desc: `剑罡威力 +${3 + power * 3}，缩短当前法宝冷却。`,
        apply: () => {
          state.hero.skillPower += 3 + power * 3
          empowerArtifact('burst', power)
          state.skillCd = Math.min(state.skillCd, Math.max(0.4, 1.6 - power * 0.35))
        },
      }),
    },
    {
      id: 'quick',
      title: '踏风御剑',
      color: '#38bdf8',
      build: (power, cardTier) => ({
        id: 'quick',
        iconId: power >= 3 ? 'quick-3' : power >= 2 ? 'quick-2' : 'quick-1',
        title: '踏风御剑',
        tier: cardTier,
        color: '#38bdf8',
        desc: `御剑频率 +${power}，飞剑攻击 +${power + 1}。`,
        apply: () => {
          state.hero.baseAtk += power + 1
          state.autoHaste += power
          state.attackCd = 0
        },
      }),
    },
    {
      id: 'chain',
      title: '九霄雷引',
      color: '#38bdf8',
      build: (power, cardTier) => ({
        id: 'chain',
        iconId: power >= 3 ? 'chain-3' : power >= 2 ? 'chain-2' : 'chain-1',
        title: '九霄雷引',
        tier: cardTier,
        color: '#38bdf8',
        desc: `九霄引雷印 +${power}，法宝威力 +${power * 2}。`,
        apply: () => {
          empowerArtifact('chain', power)
          state.hero.skillPower += power * 2
          state.chainCd = 0
        },
      }),
    },
    {
      id: 'orbit',
      title: '护体剑阵',
      color: '#f97316',
      build: (power, cardTier) => ({
        id: 'orbit',
        iconId: power >= 3 ? 'orbit-3' : power >= 2 ? 'orbit-2' : 'orbit-1',
        title: '护体剑阵',
        tier: cardTier,
        color: '#f97316',
        desc: `护体剑阵 +${power}，飞剑攻击 +${power + 2}。`,
        apply: () => {
          empowerArtifact('orbit', power)
          state.hero.baseAtk += power + 2
          state.orbitCd = 0
        },
      }),
    },
    {
      id: 'flame',
      title: '离火符阵',
      color: '#fb923c',
      build: (power, cardTier) => ({
        id: 'flame',
        iconId: power >= 3 ? 'flame-3' : power >= 2 ? 'flame-2' : 'flame-1',
        title: '离火符阵',
        tier: cardTier,
        color: '#fb923c',
        desc: `琉璃莲火鼎 +${power}，法宝威力 +${power * 3}。`,
        apply: () => {
          empowerArtifact('flame', power)
          state.hero.skillPower += power * 3
          state.flameCd = 0
        },
      }),
    },
    {
      id: 'mutate-ride',
      title: '飞剑化虹',
      color: '#67e8f9',
      build: (power, cardTier) => ({
        id: 'mutate-ride',
        iconId: power >= 3 ? 'blade-3' : power >= 2 ? 'blade-2' : 'blade-1',
        title: state.mutations.swordRide > 0 ? '飞剑化虹·进阶' : '飞剑化虹',
        tier: cardTier,
        color: '#67e8f9',
        mutation: true,
        desc: state.mutations.swordRide > 0
          ? `御剑速度继续提升，普攻额外锁定目标。`
          : `质变：脚下本命飞剑显形，野外推进更快，普攻可同时御剑追击。`,
        apply: () => {
          state.mutations.swordRide += 1
          empowerArtifact('slash', power)
          state.autoHaste += 1
        },
      }),
    },
    {
      id: 'mutate-thunder',
      title: '雷印分裂',
      color: '#38bdf8',
      build: (power, cardTier) => ({
        id: 'mutate-thunder',
        iconId: power >= 3 ? 'chain-3' : power >= 2 ? 'chain-2' : 'chain-1',
        title: state.mutations.thunderFork > 0 ? '雷印分裂·进阶' : '雷印分裂',
        tier: cardTier,
        color: '#38bdf8',
        mutation: true,
        desc: state.mutations.thunderFork > 0
          ? `九霄雷诀继续增加弹射目标，高阶后召出满屏雷云。`
          : `质变：九霄雷诀留下雷印，进阶后自动铺开满屏雷云。`,
        apply: () => {
          state.mutations.thunderFork += 1
          empowerArtifact('chain', power)
          state.chainCd = 0
        },
      }),
    },
    {
      id: 'mutate-domain',
      title: '万剑剑域',
      color: '#a5f3fc',
      build: (power, cardTier) => ({
        id: 'mutate-domain',
        iconId: power >= 3 ? 'orbit-3' : power >= 2 ? 'orbit-2' : 'orbit-1',
        title: state.mutations.swordDomain > 0 ? '万剑剑域·进阶' : '万剑剑域',
        tier: cardTier,
        color: '#a5f3fc',
        mutation: true,
        desc: state.mutations.swordDomain > 0
          ? `剑域继续扩大，高阶后万剑落屏。`
          : `质变：护体剑阵变成剑域，进阶后可演化为满屏万剑。`,
        apply: () => {
          state.mutations.swordDomain += 1
          empowerArtifact('orbit', power)
          state.orbitCd = 0
        },
      }),
    },
    {
      id: 'mutate-flame',
      title: '莲火符海',
      color: '#fb923c',
      build: (power, cardTier) => ({
        id: 'mutate-flame',
        iconId: power >= 3 ? 'flame-3' : power >= 2 ? 'flame-2' : 'flame-1',
        title: state.mutations.flameLotus > 0 ? '莲火符海·进阶' : '莲火符海',
        tier: cardTier,
        color: '#fb923c',
        mutation: true,
        desc: state.mutations.flameLotus > 0
          ? `离火符阵追加更多符火，高阶后莲火铺满战场。`
          : `质变：离火符阵分裂成莲火符海，进阶后可铺满屏幕。`,
        apply: () => {
          state.mutations.flameLotus += 1
          empowerArtifact('flame', power)
          state.flameCd = 0
        },
      }),
    },
    {
      id: 'magnet',
      title: '引魂磁场',
      color: '#5eead4',
      build: (power, cardTier) => ({
        id: 'magnet',
        iconId: power >= 3 ? 'magnet-3' : power >= 2 ? 'magnet-2' : 'magnet-1',
        title: '引魂磁场',
        tier: cardTier,
        color: '#5eead4',
        desc: `吸收场上灵魂球，获得 ${power} 点法宝精华。`,
        apply: () => {
          const gained = state.soulOrbs.reduce((sum, orb) => sum + orb.value, 0)
          state.soulOrbs = []
          state.skills.points += power
          if (gained > 0) state.soulExp += Math.min(soulNeed() - 1, gained)
        },
      }),
    },
    {
      id: 'guard',
      title: '玄盾护体',
      color: '#84cc16',
      build: (power, cardTier) => ({
        id: 'guard',
        iconId: power >= 3 ? 'guard-3' : power >= 2 ? 'guard-2' : 'guard-1',
        title: '玄盾护体',
        tier: cardTier,
        color: '#84cc16',
        desc: `生命上限 +${8 + power * 8}，立刻回满生命。`,
        apply: () => {
          state.hero.baseHp += 8 + power * 8
          state.hero.hp = maxHp()
        },
      }),
    },
    {
      id: 'ticket',
      title: '法宝残响',
      color: '#facc15',
      build: (power, cardTier) => ({
        id: 'ticket',
        iconId: power >= 3 ? 'gate-3' : power >= 2 ? 'gate-2' : 'gate-1',
        title: '法宝残响',
        tier: cardTier,
        color: '#facc15',
        desc: `获得 ${power + 1} 点法宝精华，法宝威力 +${power * 2}。`,
        apply: () => {
          state.skills.points += power + 1
          state.hero.skillPower += power * 2
        },
      }),
    },
    {
      id: 'sweep',
      title: '万剑归宗',
      color: '#67e8f9',
      build: (power, cardTier) => ({
        id: 'sweep',
        iconId: power >= 3 ? 'sweep-3' : power >= 2 ? 'sweep-2' : 'sweep-1',
        title: '万剑归宗',
        tier: cardTier,
        color: '#67e8f9',
        desc: `唤出剑阵扫荡周围敌人，飞剑攻击 +${power}。`,
        apply: () => {
          const radius = 170 + power * 35
          state.hero.baseAtk += power
          state.effects.push({
            x: state.hero.x,
            y: state.hero.y,
            radius,
            color: '#67e8f9',
            life: 0.36,
            maxLife: 0.36,
            kind: 'ring',
          })
          state.enemies
            .filter((enemy) => Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) < radius)
            .slice(0, 6 + power * 3)
            .forEach((enemy) => damageEnemy(enemy, Math.round(totalAtk() * (0.55 + power * 0.15))))
        },
      }),
    },
  ]
  const availablePool = pool.filter((option) => {
    const required = evolutionRequiredArtifact(option.id)
    return !required || hasArtifact(required)
  })
  const mutationPool = availablePool.filter((option) => option.id.startsWith('mutate-'))
  const growthPool = availablePool.filter((option) => !option.id.startsWith('mutate-'))
  const selected = [...shuffle(mutationPool).slice(0, 1), ...shuffle(growthPool).slice(0, 3)]
  return selected.slice(0, 3).map((option) => option.build(rank, tier))
}

function evolutionIcon(id: string) {
  const stroke = 'currentColor'
  const common = `viewBox="0 0 48 48" fill="none" stroke="${stroke}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`
  const icons: Record<string, string> = {
    'blade-1': `<svg ${common}><path d="M31 5 16 25l7 7L43 17 31 5Z"/><path d="m15 27-8 8 6 6 8-8"/><path d="m10 38-5 5"/></svg>`,
    'blade-2': `<svg ${common}><path d="M32 4 14 28l6 6L44 16 32 4Z"/><path d="M26 10 38 22"/><path d="m14 30-8 8 4 4 8-8"/></svg>`,
    'blade-3': `<svg ${common}><path d="M31 3 12 29l7 7L45 17 31 3Z"/><path d="M24 8 40 24"/><path d="M10 16c7 3 11 8 13 15"/><path d="m12 32-7 7 4 4 7-7"/></svg>`,
    'shield-1': `<svg ${common}><path d="M24 5 40 11v12c0 10-6 17-16 21C14 40 8 33 8 23V11l16-6Z"/><path d="M24 13v22"/></svg>`,
    'shield-2': `<svg ${common}><path d="M24 4 41 11v12c0 11-7 18-17 21C14 41 7 34 7 23V11l17-7Z"/><path d="M15 24h18"/><path d="M24 13v22"/></svg>`,
    'shield-3': `<svg ${common}><path d="M24 3 42 10v13c0 12-8 18-18 22C14 41 6 35 6 23V10l18-7Z"/><path d="M16 17h16l-4 8 5 9H15l5-9-4-8Z"/></svg>`,
    'nova-1': `<svg ${common}><path d="M24 5v10"/><path d="M24 33v10"/><path d="M5 24h10"/><path d="M33 24h10"/><path d="m11 11 7 7"/><path d="m30 30 7 7"/><circle cx="24" cy="24" r="7"/></svg>`,
    'nova-2': `<svg ${common}><path d="M24 4 28 18 42 24 28 30 24 44 20 30 6 24 20 18 24 4Z"/><circle cx="24" cy="24" r="4"/></svg>`,
    'nova-3': `<svg ${common}><path d="M24 3 29 17 44 14 34 26 43 39 28 34 24 45 20 34 5 39 14 26 4 14 19 17 24 3Z"/></svg>`,
    'quick-1': `<svg ${common}><path d="M7 30h15"/><path d="M5 20h19"/><path d="M26 7 18 25h10l-6 16 20-24H30l6-10H26Z"/></svg>`,
    'quick-2': `<svg ${common}><path d="M5 31h14"/><path d="M7 22h18"/><path d="M26 5 16 27h12l-5 16 20-25H31l7-13H26Z"/><path d="M34 34h8"/></svg>`,
    'quick-3': `<svg ${common}><path d="M4 32h16"/><path d="M6 23h18"/><path d="M9 14h14"/><path d="M28 4 15 28h13l-5 16 22-27H32l8-13H28Z"/></svg>`,
    'chain-1': `<svg ${common}><path d="M8 30 18 18l8 8 14-16"/><path d="m34 9 7 1-1 7"/><circle cx="8" cy="30" r="3"/><circle cx="26" cy="26" r="3"/></svg>`,
    'chain-2': `<svg ${common}><path d="M6 32 17 17l9 10 15-18"/><path d="M13 37 25 28l8 8 10-12"/><circle cx="6" cy="32" r="3"/><circle cx="26" cy="27" r="3"/><circle cx="41" cy="9" r="3"/></svg>`,
    'chain-3': `<svg ${common}><path d="M5 34 17 16l9 11 16-20"/><path d="M8 15h10l-6 10h11l-10 18"/><path d="M25 38 34 27l7 6"/><circle cx="5" cy="34" r="3"/><circle cx="42" cy="7" r="3"/></svg>`,
    'orbit-1': `<svg ${common}><circle cx="24" cy="24" r="7"/><path d="M7 25c7-12 27-12 34 0"/><path d="m35 20 6 5-7 4"/></svg>`,
    'orbit-2': `<svg ${common}><circle cx="24" cy="24" r="6"/><path d="M6 25c8-14 28-14 36 0"/><path d="M42 23c-7 14-29 14-36 0"/><path d="m35 18 7 6-8 5"/></svg>`,
    'orbit-3': `<svg ${common}><circle cx="24" cy="24" r="5"/><path d="M5 24c9-16 29-16 38 0"/><path d="M43 24c-9 16-29 16-38 0"/><path d="M15 8c12 3 22 14 18 32"/><path d="m34 16 9 8-10 6"/></svg>`,
    'flame-1': `<svg ${common}><path d="M26 5c7 8-2 11 6 18 3 3 5 6 5 10 0 7-6 11-13 11S11 40 11 33c0-7 6-11 9-17 2 5 6 6 6 12 4-6-1-11 0-23Z"/><path d="M24 31c3 4 0 8-4 8"/></svg>`,
    'flame-2': `<svg ${common}><path d="M27 4c8 9-2 12 7 20 4 3 6 7 6 11 0 7-7 10-16 10S8 41 8 34c0-8 7-12 11-20 1 7 7 8 7 15 5-7-2-13 1-25Z"/><path d="M21 30c-4 5-1 10 4 10 4 0 7-3 6-7"/></svg>`,
    'flame-3': `<svg ${common}><path d="M29 3c8 10-2 13 8 21 5 4 7 8 7 13 0 7-8 9-20 9S4 43 4 35c0-9 8-13 12-23 2 8 8 10 8 17 7-8-2-15 5-26Z"/><path d="M19 31c-6 7 0 12 6 12s10-5 7-11"/><path d="M8 16c6 0 8 3 9 7"/></svg>`,
    'magnet-1': `<svg ${common}><path d="M13 8v15c0 7 5 12 11 12s11-5 11-12V8"/><path d="M13 8h9"/><path d="M26 8h9"/><circle cx="24" cy="40" r="3"/></svg>`,
    'magnet-2': `<svg ${common}><path d="M12 8v15c0 8 5 14 12 14s12-6 12-14V8"/><path d="M12 8h9"/><path d="M27 8h9"/><circle cx="10" cy="39" r="2"/><circle cx="24" cy="43" r="2"/><circle cx="38" cy="39" r="2"/></svg>`,
    'magnet-3': `<svg ${common}><path d="M10 7v16c0 9 6 16 14 16s14-7 14-16V7"/><path d="M10 7h10"/><path d="M28 7h10"/><path d="M6 36c10 8 26 8 36 0"/><circle cx="24" cy="25" r="4"/></svg>`,
    'guard-1': `<svg ${common}><path d="M10 32c7-13 21-13 28 0"/><path d="M15 32h18"/><path d="M24 8v20"/></svg>`,
    'guard-2': `<svg ${common}><path d="M8 34c8-17 24-17 32 0"/><path d="M13 34h22"/><path d="M24 7v23"/><path d="M16 17h16"/></svg>`,
    'guard-3': `<svg ${common}><path d="M6 35c9-20 27-20 36 0"/><path d="M12 35h24"/><path d="M24 5v26"/><path d="M14 16h20"/><path d="M18 25h12"/></svg>`,
    'gate-1': `<svg ${common}><circle cx="24" cy="24" r="14"/><path d="M24 10v14l9 5"/><path d="M10 24H5"/><path d="M43 24h-5"/></svg>`,
    'gate-2': `<svg ${common}><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="6"/><path d="M24 4v8"/><path d="M24 36v8"/><path d="M4 24h8"/><path d="M36 24h8"/></svg>`,
    'gate-3': `<svg ${common}><circle cx="24" cy="24" r="17"/><path d="M8 16c9-7 23-7 32 0"/><path d="M8 32c9 7 23 7 32 0"/><path d="M24 7v34"/><circle cx="24" cy="24" r="5"/></svg>`,
    'sweep-1': `<svg ${common}><path d="M24 5 18 24l6 5 6-5-6-19Z"/><path d="M12 16 8 32l5 4 5-4-6-16Z"/><path d="M36 16 30 32l5 4 5-4-4-16Z"/></svg>`,
    'sweep-2': `<svg ${common}><path d="M24 4 17 25l7 6 7-6-7-21Z"/><path d="M10 13 5 32l6 5 6-5-7-19Z"/><path d="M38 13 31 32l6 5 6-5-5-19Z"/><path d="M8 42c9-5 23-5 32 0"/></svg>`,
    'sweep-3': `<svg ${common}><path d="M24 3 16 26l8 7 8-7-8-23Z"/><path d="M9 10 4 31l7 6 7-6-9-21Z"/><path d="M39 10 30 31l7 6 7-6-5-21Z"/><path d="M15 40c6-4 12-4 18 0"/><path d="M6 43c11-7 25-7 36 0"/></svg>`,
  }
  return icons[id] ?? icons['nova-1']
}

function openEvolutionPanel() {
  evolutionList.innerHTML = ''
  for (const option of evolutionOptions()) {
    const button = document.createElement('button')
    button.className = `evolution-card tier-${tierRank(option.tier)}`
    if (option.mutation) button.classList.add('mutation-card')
    button.type = 'button'
    button.dataset.kind = option.id
    button.style.borderColor = option.color
    button.innerHTML = `<i>${evolutionIcon(option.iconId)}</i><b>${option.title}</b><span>${option.desc}</span>${option.mutation ? '<em>质变</em>' : ''}`
    button.addEventListener('click', () => chooseEvolution(option))
    evolutionList.appendChild(button)
  }
  evolutionPanel.hidden = false
  toast(`魂质进化 Lv.${state.hero.level}：选择一个模板方向。`)
}

function chooseEvolution(option: EvolutionOption) {
  option.apply()
  sfx.level()
  flashScreen(option.mutation ? 'rgba(250,204,21,.24)' : 'rgba(94,234,212,.16)', option.mutation ? 0.24 : 0.14, 0.2)
  addParticleBurst(state.hero.x, state.hero.y - 70, option.color, option.mutation ? 42 : 24, option.mutation ? 1.25 : 0.9, 'rune')
  state.texts.push({ x: state.hero.x, y: state.hero.y - 44, text: option.mutation ? `质变觉醒：${option.title}` : option.title, color: option.color, life: option.mutation ? 1.35 : 1 })
  evolutionPanel.hidden = true
  toast(`${option.mutation ? '质变觉醒' : '已进化'}：${option.title}`)
  saveGame()
  updateHud()
  if (state.soulExp >= soulNeed()) levelUpSoul()
}

function draw() {
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  const theme = activeStageTheme()
  const grd = ctx.createLinearGradient(0, 0, 0, h)
  grd.addColorStop(0, state.mode === 'dungeon' ? darkenHex(theme.sky[2], 0.58) : theme.sky[1])
  grd.addColorStop(1, '#071014')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  if (state.screenShake > 0) {
    const shake = Math.min(11, 3 + state.screenShake * 70)
    const t = performance.now() * 0.055
    ctx.translate(Math.sin(t * 1.7) * shake + (Math.random() - 0.5) * shake * 0.55, Math.cos(t * 2.1) * shake * 0.45)
  }

  const groundY = h * 0.72
  const ox = w / 2 - state.hero.x
  const oy = groundY - state.hero.y
  drawSideTerrain(w, h, ox, groundY)
  drawStageRoute(w, ox, groundY)

  drawWorldDetails(ox, oy)
  for (const orb of state.soulOrbs) drawSoulOrb(orb, ox, oy)
  for (const effect of state.effects) drawEffect(effect, ox, oy)
  for (const particle of state.particles) drawParticle(particle, ox, oy)
  drawMoveTarget(ox, oy)

  const target = nearestEnemy()
  if (target) drawTargetReticle(target.x + ox, target.y + oy, target.boss ? 74 : target.elite ? 50 : 40)

  for (const enemy of state.enemies) {
    const x = enemy.x + ox
    drawEnemySide(enemy, x, groundY)
  }

  drawHeroSide(w / 2, groundY)

  for (const text of state.texts) {
    ctx.globalAlpha = Math.max(0, text.life)
    ctx.fillStyle = text.color
    ctx.font = 'bold 22px system-ui'
    ctx.fillText(text.text, text.x + ox, text.y + oy)
    ctx.globalAlpha = 1
  }
  drawScreenAtmosphere(w, h)
  ctx.restore()
  drawScreenFlash(w, h)
}

function drawSideTerrain(w: number, h: number, ox: number, groundY: number) {
  ctx.save()
  const theme = activeStageTheme()
  const bg = state.mode === 'dungeon' ? sprites.dungeonBg : sprites.worldBg
  if (bg.complete && bg.naturalWidth > 0) {
    drawGeneratedMapBackground(bg, w, h, ox, groundY, theme)
    ctx.restore()
    return
  }
  const skyStops = state.mode === 'dungeon'
    ? [darkenHex(theme.sky[0], 0.34), darkenHex(theme.sky[1], 0.46), darkenHex(theme.sky[2], 0.58), '#05080b']
    : theme.sky
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, skyStops[0])
  sky.addColorStop(0.5, skyStops[1])
  sky.addColorStop(0.62, skyStops[2])
  sky.addColorStop(1, skyStops[3])
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  ctx.globalAlpha = state.mode === 'dungeon' ? 0.55 : 0.42
  ctx.fillStyle = state.mode === 'dungeon' ? darkenHex(theme.mountain, 0.66) : theme.mountain
  for (let i = -2; i <= 5; i += 1) {
    const x = ((i * 220 + ox * 0.12) % (w + 260)) - 130
    ctx.beginPath()
    ctx.moveTo(x - 30, groundY - 68)
    ctx.quadraticCurveTo(x + 84, groundY - 220, x + 235, groundY - 72)
    ctx.lineTo(x + 270, groundY - 42)
    ctx.lineTo(x - 60, groundY - 38)
    ctx.closePath()
    ctx.fill()
  }

  if (state.mode === 'wild') {
    ctx.globalAlpha = 0.52
    ctx.fillStyle = theme.cloud
    for (let i = -2; i <= 5; i += 1) {
      const x = ((i * 190 + ox * 0.18) % (w + 260)) - 120
      const y = groundY - 176 + Math.sin(i * 1.3) * 18
      ctx.beginPath()
      ctx.ellipse(x, y, 58, 16, 0, 0, Math.PI * 2)
      ctx.ellipse(x + 48, y + 5, 64, 18, 0, 0, Math.PI * 2)
      ctx.ellipse(x - 44, y + 8, 46, 14, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.globalAlpha = 1
  ctx.fillStyle = state.mode === 'dungeon' ? darkenHex(theme.ground, 0.72) : theme.ground
  ctx.fillRect(0, groundY - 16, w, h - groundY + 16)
  ctx.strokeStyle = theme.groundLine
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, groundY - 14)
  ctx.quadraticCurveTo(w * 0.24, groundY - 32, w * 0.5, groundY - 14)
  ctx.quadraticCurveTo(w * 0.74, groundY + 4, w, groundY - 18)
  ctx.stroke()

  ctx.globalAlpha = 0.22
  ctx.strokeStyle = theme.detail
  for (let i = -4; i < 10; i += 1) {
    const x = ((i * 96 + ox * 0.7) % (w + 120)) - 60
    ctx.beginPath()
    ctx.moveTo(x, groundY + 20)
    ctx.lineTo(x + 70, groundY + 4)
    ctx.stroke()
  }
  drawThemeLandmarks(w, groundY, ox, theme)
  ctx.restore()
}

function drawGeneratedMapBackground(bg: HTMLImageElement, w: number, h: number, ox: number, groundY: number, theme: StageTheme) {
  const scale = Math.max(w / bg.naturalWidth, h / bg.naturalHeight)
  const drawW = bg.naturalWidth * scale
  const drawH = bg.naturalHeight * scale
  const parallax = state.mode === 'dungeon' ? 0.08 : 0.12
  const offset = ((ox * parallax) % drawW + drawW) % drawW
  const y = Math.min(0, h - drawH)
  for (let x = -offset - drawW; x < w + drawW; x += drawW) {
    ctx.drawImage(bg, x, y, drawW, drawH)
  }

  const wash = ctx.createLinearGradient(0, 0, 0, h)
  wash.addColorStop(0, state.mode === 'dungeon' ? 'rgba(3,7,18,.16)' : 'rgba(236,254,255,.02)')
  wash.addColorStop(0.58, 'rgba(0,0,0,0)')
  wash.addColorStop(1, state.mode === 'dungeon' ? 'rgba(2,6,23,.36)' : 'rgba(6,35,28,.2)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)

  ctx.globalAlpha = 0.9
  const ground = ctx.createLinearGradient(0, groundY - 26, 0, h)
  ground.addColorStop(0, state.mode === 'dungeon' ? 'rgba(10,18,34,.18)' : 'rgba(24,56,43,.12)')
  ground.addColorStop(0.25, state.mode === 'dungeon' ? 'rgba(12,18,34,.72)' : 'rgba(24,56,43,.68)')
  ground.addColorStop(1, state.mode === 'dungeon' ? 'rgba(2,6,23,.92)' : 'rgba(6,22,18,.88)')
  ctx.fillStyle = ground
  ctx.fillRect(0, groundY - 22, w, h - groundY + 22)
  ctx.globalAlpha = 1
  ctx.strokeStyle = theme.groundLine
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, groundY - 14)
  ctx.quadraticCurveTo(w * 0.24, groundY - 30, w * 0.5, groundY - 15)
  ctx.quadraticCurveTo(w * 0.74, groundY + 2, w, groundY - 18)
  ctx.stroke()

  ctx.globalAlpha = 0.18
  ctx.strokeStyle = theme.detail
  for (let i = -4; i < 10; i += 1) {
    const x = ((i * 96 + ox * 0.7) % (w + 120)) - 60
    ctx.beginPath()
    ctx.moveTo(x, groundY + 20)
    ctx.lineTo(x + 70, groundY + 4)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawThemeLandmarks(w: number, groundY: number, ox: number, theme: StageTheme) {
  const themeIndex = stageThemes.indexOf(theme)
  ctx.save()
  ctx.globalAlpha = state.mode === 'dungeon' ? 0.22 : 0.18
  ctx.strokeStyle = theme.accent
  ctx.fillStyle = theme.detail
  ctx.lineWidth = 3
  for (let i = -2; i <= 4; i += 1) {
    const x = ((i * 260 + ox * 0.22) % (w + 320)) - 120
    const y = groundY - 96 - (i % 2) * 22
    if (themeIndex === 1) {
      ctx.beginPath()
      ctx.roundRect(x - 20, y - 58, 40, 86, 8)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - 28, y - 62)
      ctx.lineTo(x + 34, y - 30)
      ctx.stroke()
    } else if (themeIndex === 3) {
      ctx.beginPath()
      ctx.moveTo(x, y - 74)
      ctx.lineTo(x + 38, y - 2)
      ctx.lineTo(x - 26, y + 18)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else if (themeIndex === 4) {
      ctx.beginPath()
      ctx.moveTo(x - 48, y - 28)
      ctx.lineTo(x - 12, y - 12)
      ctx.lineTo(x + 10, y - 58)
      ctx.lineTo(x + 48, y - 18)
      ctx.stroke()
    } else if (themeIndex === 5) {
      ctx.beginPath()
      ctx.roundRect(x - 32, y - 66, 64, 92, 12)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y - 16, 19, 0, Math.PI * 2)
      ctx.stroke()
    } else if (themeIndex === 6) {
      for (let s = 0; s < 5; s += 1) {
        ctx.beginPath()
        ctx.arc(x + s * 22 - 42, y - 24 + Math.sin(s) * 10, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.beginPath()
      ctx.moveTo(x, y - 70)
      ctx.lineTo(x + 34, y + 8)
      ctx.lineTo(x - 34, y + 8)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y - 20, 15, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function worldStageNo(x = state.hero.x) {
  return Math.max(1, Math.floor(Math.max(0, x + stageSpan * 0.34) / stageSpan) + 1)
}

function worldStageTitle(no = worldStageNo()) {
  return stageNames[(no - 1) % stageNames.length]
}

function stageTheme(no = worldStageNo()): StageTheme {
  return stageThemes[(no - 1) % stageThemes.length]
}

function activeDungeonDef() {
  return dungeonDefs.find((dungeon) => dungeon.id === state.activeDungeon) ?? dungeonDefs[0]
}

function activeStageTheme(): StageTheme {
  if (state.mode === 'dungeon') {
    return stageThemes[activeDungeonDef().themeIndex] ?? stageThemes[0]
  }
  return stageTheme(worldStageNo())
}

function dungeonStageTitle() {
  const dungeon = activeDungeonDef()
  return `${dungeon.name}·${dungeon.subtitle}`
}

function darkenHex(hex: string, amount: number) {
  const value = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(value.slice(0, 2), 16) * amount))
  const g = Math.max(0, Math.round(parseInt(value.slice(2, 4), 16) * amount))
  const b = Math.max(0, Math.round(parseInt(value.slice(4, 6), 16) * amount))
  return `rgb(${r},${g},${b})`
}

function enemyDisplayName(enemy: Enemy) {
  const base = activeStageTheme().enemyNames[enemy.kind]
  if (enemy.boss) return `Boss ${base}`
  if (enemy.elite) return `精英 ${base}`
  return base
}

function drawStageRoute(w: number, ox: number, groundY: number) {
  if (state.mode !== 'wild') return
  ctx.save()
  const current = worldStageNo()
  const start = Math.max(1, current - 3)
  const end = current + 4
  const pathY = groundY - 52

  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  for (let stage = start; stage < end; stage += 1) {
    const x1 = (stage - 1) * stageSpan + ox
    const x2 = stage * stageSpan + ox
    if (x2 < -120 || x1 > w + 120) continue
    ctx.strokeStyle = stage < current ? 'rgba(94,234,212,.42)' : 'rgba(148,163,184,.18)'
    ctx.beginPath()
    ctx.moveTo(x1, pathY)
    ctx.lineTo(x2, pathY)
    ctx.stroke()
  }

  for (let stage = start; stage <= end; stage += 1) {
    const x = (stage - 1) * stageSpan + ox
    if (x < -180 || x > w + 180) continue
    drawStageNode(x, pathY, stage, current)
  }
  drawCurrentStageBanner(w, current)
  ctx.restore()
}

function drawStageNode(x: number, y: number, stage: number, current: number) {
  const isCurrent = stage === current
  const cleared = stage < current
  const locked = stage > current + 1
  const theme = stageTheme(stage)
  const title = theme.name
  const pulse = Math.sin(performance.now() * 0.004 + stage) * 0.5 + 0.5
  const color = isCurrent ? theme.accent : cleared ? '#5eead4' : locked ? '#64748b' : theme.detail

  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = locked ? 0.48 : 1
  ctx.strokeStyle = 'rgba(15,23,42,.9)'
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.arc(0, 0, isCurrent ? 27 : 22, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowColor = color
  ctx.shadowBlur = isCurrent ? 24 + pulse * 10 : cleared ? 12 : 8
  ctx.fillStyle = isCurrent ? theme.accent : cleared ? 'rgba(20,184,166,.88)' : 'rgba(15,23,42,.9)'
  ctx.beginPath()
  ctx.arc(0, 0, isCurrent ? 23 : 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.stroke()

  if (isCurrent || stage === current + 1) {
    ctx.strokeStyle = isCurrent ? 'rgba(250,204,21,.66)' : 'rgba(56,189,248,.48)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(0, -66, 34 + pulse * 5, 58 + pulse * 10, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = isCurrent ? 'rgba(250,204,21,.16)' : 'rgba(56,189,248,.12)'
    ctx.beginPath()
    ctx.ellipse(0, -66, 21 + pulse * 3, 42 + pulse * 7, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = isCurrent ? '#020617' : '#e0f2fe'
  ctx.font = 'bold 17px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(stage), 0, 6)
  ctx.font = 'bold 17px "Microsoft YaHei", sans-serif'
  ctx.fillText(`第${stage}关`, 0, -94)
  ctx.font = '14px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = isCurrent ? '#fef9c3' : cleared ? '#ccfbf1' : '#bfdbfe'
  ctx.fillText(title, 0, -74)
  if (isCurrent) {
    ctx.fillStyle = 'rgba(15,23,42,.82)'
    ctx.beginPath()
    ctx.roundRect(-46, 28, 92, 27, 14)
    ctx.fill()
    ctx.fillStyle = '#facc15'
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif'
    ctx.fillText('当前区域', 0, 47)
  }
  ctx.restore()
}

function drawCurrentStageBanner(w: number, current: number) {
  ctx.save()
  const theme = stageTheme(current)
  const x = 14
  const y = 14
  const width = Math.min(360, w - 28)
  const gradient = ctx.createLinearGradient(x, y, x + width, y)
  gradient.addColorStop(0, 'rgba(8,13,25,.78)')
  gradient.addColorStop(1, `${theme.enemyDark}99`)
  ctx.fillStyle = gradient
  ctx.strokeStyle = theme.groundLine
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(x, y, width, 54, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = theme.accent
  ctx.font = 'bold 14px "Microsoft YaHei", sans-serif'
  ctx.fillText(`世界地图 第${current}关`, x + 14, y + 21)
  ctx.fillStyle = '#fef9c3'
  ctx.font = 'bold 20px "Microsoft YaHei", sans-serif'
  ctx.fillText(worldStageTitle(current), x + 14, y + 45)
  ctx.fillStyle = 'rgba(226,232,240,.72)'
  ctx.font = '12px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(theme.subtitle, x + width - 14, y + 45)
  ctx.restore()
}

function drawScreenAtmosphere(w: number, h: number) {
  ctx.save()
  const theme = activeStageTheme()
  const fog = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.72)
  fog.addColorStop(0, 'rgba(0,0,0,0)')
  fog.addColorStop(1, state.mode === 'dungeon' ? `${theme.enemyDark}78` : `${theme.enemyDark}3d`)
  ctx.fillStyle = fog
  ctx.fillRect(0, 0, w, h)

  const topMist = ctx.createLinearGradient(0, 0, 0, h)
  topMist.addColorStop(0, state.mode === 'dungeon' ? `${theme.accent}24` : theme.cloud)
  topMist.addColorStop(0.45, 'rgba(0,0,0,0)')
  topMist.addColorStop(1, state.mode === 'dungeon' ? 'rgba(0,0,0,.18)' : `${theme.ground}30`)
  ctx.fillStyle = topMist
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

function drawScreenFlash(w: number, h: number) {
  if (!state.screenFlash) return
  const flash = state.screenFlash
  const t = Math.max(0, flash.life / flash.maxLife)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = flash.strength * t
  ctx.fillStyle = flash.color
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = flash.strength * t * 0.9
  const glow = ctx.createRadialGradient(w / 2, h * 0.52, 20, w / 2, h * 0.52, Math.max(w, h) * 0.72)
  glow.addColorStop(0, flash.color)
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

function nearestEnemy() {
  let target: Enemy | null = null
  let best = Number.POSITIVE_INFINITY
  for (const enemy of state.enemies) {
    const distance = Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y)
    if (distance < best) {
      best = distance
      target = enemy
    }
  }
  return target
}

function drawTargetReticle(x: number, y: number, radius: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(250,204,21,.72)'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 8])
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(250,204,21,.28)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(x, y, radius + 3, -Math.PI * 0.15, Math.PI * 0.28)
  ctx.stroke()
  ctx.restore()
}

function drawMoveTarget(ox: number, oy: number) {
  if (!moveTarget) return
  const x = moveTarget.x + ox
  const y = moveTarget.y + oy
  const pulse = Math.sin(performance.now() * 0.009) * 0.5 + 0.5
  const flash = moveTargetPulse > 0 ? moveTargetPulse / 0.45 : 0
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = 0.72 + flash * 0.25
  ctx.shadowColor = '#5eead4'
  ctx.shadowBlur = 18 + flash * 18
  ctx.strokeStyle = '#5eead4'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(0, 0, 34 + pulse * 5 + flash * 22, 12 + pulse * 3 + flash * 8, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(236,254,255,.82)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-14, 0)
  ctx.lineTo(14, 0)
  ctx.moveTo(0, -12)
  ctx.lineTo(0, 12)
  ctx.stroke()
  ctx.fillStyle = `rgba(94,234,212,${0.16 + pulse * 0.08})`
  ctx.beginPath()
  ctx.ellipse(0, 0, 21, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSoulOrb(orb: SoulOrb, ox: number, oy: number) {
  const pulse = Math.sin(performance.now() * 0.006 + orb.phase) * 0.5 + 0.5
  const x = orb.x + ox
  const y = orb.y + oy + Math.sin(performance.now() * 0.004 + orb.phase) * 4
  ctx.save()
  ctx.shadowColor = '#5eead4'
  ctx.shadowBlur = 18 + pulse * 10
  ctx.fillStyle = '#5eead4'
  ctx.globalAlpha = 0.78
  ctx.beginPath()
  ctx.arc(x, y, 8 + pulse * 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = '#ecfeff'
  ctx.beginPath()
  ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(94,234,212,.42)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, 15 + pulse * 3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawParticle(particle: Particle, ox: number, oy: number) {
  const t = Math.max(0, particle.life / particle.maxLife)
  const x = particle.x + ox
  const y = particle.y + oy
  ctx.save()
  ctx.globalCompositeOperation = particle.kind === 'ember' || particle.kind === 'spark' ? 'lighter' : 'source-over'
  ctx.globalAlpha = Math.min(1, t * 1.2)
  ctx.shadowColor = particle.color
  ctx.shadowBlur = 8 + particle.size * 1.7
  ctx.translate(x, y)
  ctx.rotate(particle.spin * (1 - t))
  if (particle.kind === 'shard') {
    ctx.fillStyle = particle.color
    ctx.strokeStyle = 'rgba(255,255,255,.62)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, -particle.size * 1.5)
    ctx.lineTo(particle.size * 0.8, 0)
    ctx.lineTo(0, particle.size * 1.6)
    ctx.lineTo(-particle.size * 0.75, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (particle.kind === 'rune') {
    ctx.strokeStyle = particle.color
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(0, 0, particle.size * (0.8 + (1 - t) * 0.45), 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-particle.size * 0.65, 0)
    ctx.lineTo(particle.size * 0.65, 0)
    ctx.moveTo(0, -particle.size * 0.65)
    ctx.lineTo(0, particle.size * 0.65)
    ctx.stroke()
  } else {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size * 1.8)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.28, particle.color)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, particle.size * (0.6 + t * 0.7), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawWorldDetails(ox: number, oy: number) {
  ctx.save()
  const cx = state.hero.x
  const cy = state.hero.y
  const startX = Math.floor((cx - 720) / 180) - 1
  const endX = Math.floor((cx + 720) / 180) + 1
  const startY = Math.floor((cy - 960) / 180) - 1
  const endY = Math.floor((cy + 960) / 180) + 1

  for (let gx = startX; gx <= endX; gx += 1) {
    for (let gy = startY; gy <= endY; gy += 1) {
      drawMapCell(gx, gy, ox, oy)
    }
  }

  for (let i = -4; i <= 4; i += 1) {
    const x = i * 260 + ox * 0.05
    const y = Math.sin(i * 1.7) * 130 + oy * 0.04
    if (state.mode === 'wild') drawFloatingRuneCloud(x, y)
    else drawMysticArray(x, y)
  }
  ctx.restore()
  if (state.mode === 'dungeon' && state.dungeonGateFound) drawExtractionGate(ox, oy)
}

function cellRandom(x: number, y: number, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function drawMapCell(gx: number, gy: number, ox: number, oy: number) {
  const baseX = gx * 180
  const baseY = gy * 180
  const x = baseX + cellRandom(gx, gy, 1) * 140 + 20 + ox
  const y = baseY + cellRandom(gx, gy, 2) * 140 + 20 + oy
  const x2 = baseX + cellRandom(gx, gy, 21) * 150 + 15 + ox
  const y2 = baseY + cellRandom(gx, gy, 22) * 150 + 15 + oy
  const type = cellRandom(gx, gy, state.mode === 'dungeon' ? 9 : 3)

  if (state.mode === 'dungeon') {
    drawBrokenTile(x2, y2, cellRandom(gx, gy, 26))
    if (type < 0.34) drawRift(x, y, cellRandom(gx, gy, 4))
    else if (type < 0.68) {
      const cellKey = `${gx}:${gy}`
      const harvestable = cellRandom(gx, gy, 8) > 0.42 && !state.dungeonGateFound && !collectedMaterialCells.has(cellKey)
      drawRuneStone(x, y, cellRandom(gx, gy, 5), harvestable)
      if (harvestable && Math.hypot(state.hero.x - (x - ox), state.hero.y - (y - oy)) < 48) {
        collectedMaterialCells.add(cellKey)
        gainDungeonMaterial(x - ox, y - oy, '符文碎片')
      }
    }
    else drawBrokenTile(x, y, cellRandom(gx, gy, 6))
    if (cellRandom(gx, gy, 28) > 0.62) drawDungeonPillar(x2 + 36, y2 - 24, cellRandom(gx, gy, 29))
    return
  }

  drawGroundPatch(x2, y2, cellRandom(gx, gy, 27))
  if (type < 0.3) drawSpiritGrass(x, y, cellRandom(gx, gy, 4))
  else if (type < 0.55) drawSpiritStone(x, y, cellRandom(gx, gy, 5))
  else if (type < 0.8) drawAncientTablet(x, y, cellRandom(gx, gy, 6))
  else drawPineSilhouette(x, y, cellRandom(gx, gy, 7))
  if (cellRandom(gx, gy, 30) > 0.58) drawSpiritGrass(x2 + 22, y2 - 18, cellRandom(gx, gy, 31))
}

function drawFloatingRuneCloud(x: number, y: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = theme.detail
  ctx.fillStyle = theme.cloud
  ctx.beginPath()
  ctx.ellipse(x, y, 42, 15, 0, 0, Math.PI * 2)
  ctx.ellipse(x + 34, y + 6, 40, 13, 0, 0, Math.PI * 2)
  ctx.ellipse(x - 30, y + 8, 32, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + 5, y + 2, 18, Math.PI * 0.1, Math.PI * 1.35)
  ctx.stroke()
  ctx.restore()
}

function drawMysticArray(x: number, y: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = theme.accent
  ctx.beginPath()
  ctx.arc(x, y, 34, 0, Math.PI * 2)
  ctx.moveTo(x - 25, y + 18)
  ctx.lineTo(x, y - 26)
  ctx.lineTo(x + 25, y + 18)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function drawSpiritGrass(x: number, y: number, seed: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(seed * Math.PI)
  ctx.globalAlpha = 0.62
  ctx.strokeStyle = theme.detail
  ctx.shadowColor = theme.accent
  ctx.shadowBlur = 10
  ctx.lineWidth = 3
  for (let i = 0; i < 6; i += 1) {
    const a = -0.7 + i * 0.28
    ctx.beginPath()
    ctx.moveTo(0, 8)
    ctx.quadraticCurveTo(Math.cos(a) * 12, -12 - i * 2, Math.cos(a) * 28, Math.sin(a) * 12)
    ctx.stroke()
  }
  ctx.fillStyle = theme.accent
  ctx.beginPath()
  ctx.arc(4, -14, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSpiritStone(x: number, y: number, seed: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(seed * Math.PI)
  ctx.globalAlpha = 0.72
  ctx.shadowColor = theme.accent
  ctx.shadowBlur = 14
  ctx.fillStyle = `${theme.enemyDark}aa`
  ctx.strokeStyle = 'rgba(236,254,255,.64)'
  ctx.beginPath()
  ctx.moveTo(0, -26)
  ctx.lineTo(20, -5)
  ctx.lineTo(9, 24)
  ctx.lineTo(-16, 18)
  ctx.lineTo(-20, -6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = theme.detail
  ctx.beginPath()
  ctx.moveTo(-9, 2)
  ctx.lineTo(7, -9)
  ctx.lineTo(3, 9)
  ctx.stroke()
  ctx.restore()
}

function drawAncientTablet(x: number, y: number, seed: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((seed - 0.5) * 0.25)
  ctx.globalAlpha = 0.46
  ctx.fillStyle = '#334155'
  ctx.strokeStyle = 'rgba(226,232,240,.3)'
  ctx.beginPath()
  ctx.roundRect(-18, -38, 36, 68, 8)
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = theme.detail
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-8, -18)
  ctx.lineTo(8, -18)
  ctx.moveTo(-10, -4)
  ctx.quadraticCurveTo(0, -12, 10, -4)
  ctx.moveTo(-7, 10)
  ctx.lineTo(7, 10)
  ctx.stroke()
  ctx.restore()
}

function drawPineSilhouette(x: number, y: number, seed: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(0.9 + seed * 0.35, 0.9 + seed * 0.2)
  ctx.globalAlpha = 0.38
  ctx.fillStyle = darkenHex(theme.ground, 0.58)
  ctx.fillRect(-3, -24, 6, 48)
  ctx.fillStyle = theme.enemyDark
  for (let i = 0; i < 4; i += 1) {
    const yy = -38 + i * 15
    ctx.beginPath()
    ctx.moveTo(0, yy)
    ctx.lineTo(30 - i * 4, yy + 24)
    ctx.lineTo(-30 + i * 4, yy + 24)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawGroundPatch(x: number, y: number, seed: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(seed * Math.PI)
  ctx.globalAlpha = 0.18
  ctx.fillStyle = theme.detail
  ctx.beginPath()
  ctx.ellipse(0, 0, 58, 22, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawRift(x: number, y: number, seed: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(seed * Math.PI)
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = theme.accent
  ctx.shadowColor = theme.accent
  ctx.shadowBlur = 16
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-42, -6)
  ctx.lineTo(-18, 4)
  ctx.lineTo(2, -12)
  ctx.lineTo(22, 7)
  ctx.lineTo(46, -2)
  ctx.stroke()
  ctx.restore()
}

function drawRuneStone(x: number, y: number, seed: number, harvestable = false) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(seed * Math.PI)
  ctx.globalAlpha = harvestable ? 0.78 : 0.5
  ctx.fillStyle = theme.enemyDark
  ctx.strokeStyle = harvestable ? theme.accent : theme.detail
  ctx.shadowColor = harvestable ? theme.accent : 'transparent'
  ctx.shadowBlur = harvestable ? 16 : 0
  ctx.beginPath()
  ctx.roundRect(-22, -20, 44, 40, 8)
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = theme.detail
  ctx.beginPath()
  ctx.arc(0, 0, 10, 0, Math.PI * 1.5)
  ctx.stroke()
  ctx.restore()
}

function drawBrokenTile(x: number, y: number, seed: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(seed * Math.PI)
  ctx.globalAlpha = 0.28
  ctx.fillStyle = darkenHex(theme.ground, 0.62)
  ctx.fillRect(-36, -24, 30, 22)
  ctx.fillRect(-2, -18, 38, 26)
  ctx.fillRect(-24, 8, 46, 18)
  ctx.restore()
}

function drawDungeonPillar(x: number, y: number, seed: number) {
  const theme = activeStageTheme()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(seed * 0.8)
  ctx.globalAlpha = 0.42
  ctx.fillStyle = darkenHex(theme.ground, 0.58)
  ctx.strokeStyle = theme.groundLine
  ctx.beginPath()
  ctx.roundRect(-18, -34, 36, 68, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = `${theme.accent}52`
  ctx.fillRect(-12, -22, 24, 8)
  ctx.fillRect(-12, 8, 24, 8)
  ctx.restore()
}

function drawExtractionGate(ox: number, oy: number) {
  const theme = activeStageTheme()
  const x = state.dungeonExtractX + ox
  const y = state.dungeonExtractY + oy
  const pulse = Math.sin(performance.now() * 0.004) * 0.5 + 0.5
  ctx.save()
  ctx.translate(x, y)
  ctx.shadowColor = theme.accent
  ctx.shadowBlur = 26
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(0, 0, 48 + pulse * 8, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = theme.detail
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(0, 0, 30, -Math.PI * 0.2, Math.PI * 1.25)
  ctx.stroke()
  ctx.fillStyle = 'rgba(8,47,73,.72)'
  ctx.beginPath()
  ctx.arc(0, 0, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e0f2fe'
  ctx.font = 'bold 16px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('撤离', 0, 6)
  ctx.restore()
}

function drawEffect(effect: Effect, ox: number, oy: number) {
  const t = effect.life / effect.maxLife
  const progress = 1 - t
  const x = effect.x + ox
  const y = effect.y + oy
  const dir = Math.cos(effect.angle ?? 0) < 0 ? -1 : 1

  const drawFlyingSword = (length: number, width: number) => {
    ctx.beginPath()
    ctx.moveTo(length * 0.5, 0)
    ctx.lineTo(length * 0.18, -width)
    ctx.lineTo(-length * 0.34, -width * 0.48)
    ctx.lineTo(-length * 0.44, 0)
    ctx.lineTo(-length * 0.34, width * 0.48)
    ctx.lineTo(length * 0.18, width)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-length * 0.28, 0)
    ctx.lineTo(length * 0.32, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-length * 0.48, -width * 1.18)
    ctx.lineTo(-length * 0.36, 0)
    ctx.lineTo(-length * 0.48, width * 1.18)
    ctx.stroke()
  }

  const drawTalisman = (height: number) => {
    const width = height * 0.48
    ctx.beginPath()
    ctx.roundRect(-width / 2, -height / 2, width, height, 5)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-width * 0.24, -height * 0.24)
    ctx.lineTo(width * 0.14, -height * 0.08)
    ctx.lineTo(-width * 0.08, height * 0.1)
    ctx.lineTo(width * 0.24, height * 0.3)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-width * 0.22, -height * 0.36)
    ctx.lineTo(width * 0.22, -height * 0.36)
    ctx.moveTo(-width * 0.22, height * 0.38)
    ctx.lineTo(width * 0.22, height * 0.38)
    ctx.stroke()
  }

  const drawVfxImage = (sprite: HTMLImageElement, dx: number, dy: number, size: number, alpha: number, rotation = 0, scaleX = 1) => {
    if (!sprite.complete || sprite.naturalWidth <= 0) return
    ctx.save()
    ctx.globalAlpha *= alpha
    ctx.globalCompositeOperation = 'lighter'
    ctx.translate(dx, dy)
    ctx.rotate(rotation)
    ctx.scale(scaleX, 1)
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size)
    ctx.restore()
  }

  ctx.save()
  if (effect.kind === 'impact') {
    ctx.translate(x, y)
    const size = Math.min(230, 100 + effect.radius * 0.92)
    drawVfxImage(vfxSprites.impact, 0, 0, size, Math.min(1, 0.35 + t * 0.95), (effect.angle ?? 0) * 0.12)
    ctx.globalAlpha = t
    ctx.strokeStyle = effect.color
    ctx.shadowColor = effect.color
    ctx.shadowBlur = 22
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, effect.radius * (0.35 + progress * 0.72), 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.9)'
    ctx.lineWidth = 2
    for (let i = 0; i < 9; i += 1) {
      const a = i * Math.PI * 2 / 9 + progress * 0.4
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * effect.radius * 0.18, Math.sin(a) * effect.radius * 0.12)
      ctx.lineTo(Math.cos(a) * effect.radius * (0.54 + progress * 0.42), Math.sin(a) * effect.radius * (0.34 + progress * 0.34))
      ctx.stroke()
    }
  } else if (effect.kind === 'heal') {
    ctx.translate(x, y - 26)
    drawVfxImage(vfxSprites.heal, 0, -18, Math.min(240, 128 + effect.radius * 0.72), 0.5 + t * 0.55, progress * 0.18)
    ctx.globalAlpha = t * 0.55
    ctx.strokeStyle = '#bbf7d0'
    ctx.shadowColor = '#86efac'
    ctx.shadowBlur = 20
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath()
      ctx.ellipse(0, 24, effect.radius * (0.38 + i * 0.1 + progress * 0.08), 18 + i * 7, i * 0.18, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (effect.kind === 'swordrain') {
    const w = canvas.width
    const h = canvas.height
    const centerX = x
    const centerY = y - 40
    const count = Math.min(54, 18 + Math.floor(effect.radius / 22))
    const sweep = progress * (w * 0.9 + 180)
    ctx.globalAlpha = t
    const wash = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, Math.max(w, h) * 0.72)
    wash.addColorStop(0, 'rgba(224,242,254,.22)')
    wash.addColorStop(0.45, 'rgba(34,211,238,.12)')
    wash.addColorStop(1, 'rgba(34,211,238,0)')
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, w, h)
    ctx.shadowColor = '#a5f3fc'
    ctx.shadowBlur = 20
    for (let i = 0; i < count; i += 1) {
      const lane = i / Math.max(1, count - 1)
      const px = w + 90 - sweep + (i % 7) * 34 - lane * w * 0.18
      const py = 42 + lane * (h - 120) + Math.sin(i * 1.7 + progress * 8) * 22
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(-0.18 - Math.PI * 0.08)
      ctx.fillStyle = i % 3 === 0 ? '#f8fafc' : '#dff9ff'
      ctx.strokeStyle = i % 2 === 0 ? '#67e8f9' : '#bae6fd'
      ctx.lineWidth = 1.5
      drawFlyingSword(58 + (i % 4) * 12, 5.5 + (i % 3))
      ctx.restore()
      ctx.strokeStyle = `rgba(103,232,249,${0.34 * t})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px - 92, py + 24)
      ctx.lineTo(px - 22, py + 5)
      ctx.stroke()
    }
  } else if (effect.kind === 'thunderstorm') {
    const w = canvas.width
    const h = canvas.height
    const count = Math.min(18, 7 + Math.floor(effect.radius / 70))
    ctx.globalAlpha = t
    drawVfxImage(vfxSprites.thunder, x, y - 66, Math.min(540, 240 + effect.radius * 0.44), 0.42 + t * 0.42, progress * 0.08)
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, 'rgba(8,47,73,.34)')
    sky.addColorStop(0.52, 'rgba(14,165,233,.1)')
    sky.addColorStop(1, 'rgba(8,47,73,0)')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    ctx.shadowColor = '#bae6fd'
    ctx.shadowBlur = 24
    for (let i = 0; i < count; i += 1) {
      const px = ((i * 97 + progress * 260) % (w + 160)) - 80
      const top = 54 + (i % 4) * 24
      const length = 155 + (i % 5) * 28 + effect.radius * 0.05
      ctx.strokeStyle = i % 2 === 0 ? '#e0f2fe' : '#38bdf8'
      ctx.lineWidth = i % 3 === 0 ? 5 : 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(px, top)
      for (let j = 1; j <= 5; j += 1) {
        ctx.lineTo(px + (j % 2 === 0 ? -18 : 22), top + (length / 5) * j)
      }
      ctx.stroke()
      ctx.strokeStyle = `rgba(186,230,253,${0.38 * t})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(px, top + length + 16, 22 + progress * 18, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (effect.kind === 'firesea') {
    const w = canvas.width
    const h = canvas.height
    const count = Math.min(32, 12 + Math.floor(effect.radius / 42))
    ctx.globalAlpha = t
    drawVfxImage(vfxSprites.lotus, x, y - 34, Math.min(620, 230 + effect.radius * 0.56), 0.5 + t * 0.45, -progress * 0.06)
    const heat = ctx.createRadialGradient(x, y, 20, x, y, Math.max(w, h) * 0.72)
    heat.addColorStop(0, 'rgba(254,240,138,.34)')
    heat.addColorStop(0.36, 'rgba(249,115,22,.18)')
    heat.addColorStop(1, 'rgba(127,29,29,0)')
    ctx.fillStyle = heat
    ctx.fillRect(0, 0, w, h)
    ctx.shadowColor = '#fb923c'
    ctx.shadowBlur = 24
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.399 + progress * 2.6
      const ring = 0.2 + (i % 5) * 0.17
      const px = w / 2 + Math.cos(a) * w * ring * 0.62
      const py = h * 0.52 + Math.sin(a) * h * ring * 0.34
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(Math.sin(a) * 0.42)
      ctx.fillStyle = i % 2 === 0 ? 'rgba(254,202,202,.94)' : 'rgba(254,240,138,.9)'
      ctx.strokeStyle = i % 2 === 0 ? '#f97316' : '#facc15'
      ctx.lineWidth = 2
      drawTalisman(42 + (i % 4) * 8)
      ctx.restore()
      ctx.fillStyle = `rgba(251,146,60,${0.18 * t})`
      ctx.beginPath()
      ctx.arc(px, py, 34 + (i % 3) * 12 + progress * 20, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (effect.kind === 'bolt') {
    ctx.translate(x, y)
    drawVfxImage(vfxSprites.thunder, 0, 0, Math.min(210, 96 + effect.radius * 0.28), 0.46 + t * 0.38, progress * 0.12)
    ctx.rotate(effect.angle ?? 0)
    ctx.globalAlpha = t
    ctx.shadowColor = effect.color
    ctx.shadowBlur = 26
    ctx.strokeStyle = '#bae6fd'
    ctx.lineWidth = Math.min(8, 3.5 + effect.radius / 170)
    ctx.lineCap = 'round'
    ctx.beginPath()
    const half = effect.radius / 2
    ctx.moveTo(-half, 0)
    for (let i = 1; i <= 7; i += 1) {
      const px = -half + (effect.radius / 7) * i
      const py = (i % 2 === 0 ? -1 : 1) * (8 + progress * 16)
      ctx.lineTo(px, py)
    }
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.82)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-half, 0)
    ctx.lineTo(half, 0)
    ctx.stroke()
    ctx.rotate(-(effect.angle ?? 0))
    ctx.strokeStyle = `rgba(125,211,252,${0.72 * t})`
    ctx.lineWidth = 2
    const sealCount = Math.min(5, Math.max(3, Math.round(effect.radius / 120)))
    for (let i = 0; i < sealCount; i += 1) {
      const order = i - (sealCount - 1) / 2
      const sealX = order * effect.radius * 0.2
      ctx.beginPath()
      ctx.arc(sealX, 0, 16 + progress * 9, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(sealX - 8, -2)
      ctx.lineTo(sealX, -10)
      ctx.lineTo(sealX + 8, -2)
      ctx.lineTo(sealX, 10)
      ctx.closePath()
      ctx.stroke()
    }
  } else if (effect.kind === 'orbit') {
    ctx.translate(x, y - 28)
    ctx.globalAlpha = t
    ctx.shadowColor = effect.color
    ctx.shadowBlur = 26
    ctx.strokeStyle = `rgba(186,230,253,${0.5 * t})`
    ctx.lineWidth = 2
    const ringCount = Math.min(4, 2 + Math.floor(effect.radius / 135))
    for (let i = 0; i < ringCount; i += 1) {
      ctx.beginPath()
      ctx.ellipse(0, 0, effect.radius * (0.52 + progress * 0.08 + i * 0.05), 25 + i * 10, i * 0.18, 0, Math.PI * 2)
      ctx.stroke()
    }
    const swordCount = Math.min(14, 6 + Math.floor(effect.radius / 35))
    for (let i = 0; i < swordCount; i += 1) {
      const a = i * Math.PI * 2 / swordCount + progress * Math.PI * 2.3
      const sx = Math.cos(a) * effect.radius * (0.44 + (i % 2) * 0.06)
      const sy = Math.sin(a) * (25 + (i % ringCount) * 6)
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(a + Math.PI / 2)
      ctx.fillStyle = '#e0f2fe'
      ctx.strokeStyle = '#67e8f9'
      ctx.lineWidth = 1.5
      drawFlyingSword(42 + effect.radius * 0.04, 5.5)
      ctx.restore()
    }
  } else if (effect.kind === 'flare') {
    ctx.translate(x, y - 34)
    ctx.globalAlpha = t
    drawVfxImage(vfxSprites.lotus, 0, 0, Math.min(260, 100 + effect.radius * 0.9), 0.52 + t * 0.36, progress * 0.08)
    ctx.shadowColor = effect.color
    ctx.shadowBlur = 34
    const burst = ctx.createRadialGradient(0, 0, 8, 0, 0, effect.radius * (0.5 + progress * 0.24))
    burst.addColorStop(0, 'rgba(254,249,195,.78)')
    burst.addColorStop(0.36, 'rgba(251,113,133,.28)')
    burst.addColorStop(1, 'rgba(239,68,68,0)')
    ctx.fillStyle = burst
    ctx.beginPath()
    ctx.arc(0, 0, effect.radius * (0.48 + progress * 0.24), 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(254,240,138,${0.74 * t})`
    ctx.lineWidth = 3
    const rayCount = Math.min(14, 8 + Math.floor(effect.radius / 42))
    for (let i = 0; i < rayCount; i += 1) {
      const a = i * Math.PI * 2 / rayCount + progress * 0.7
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 18)
      ctx.lineTo(Math.cos(a) * effect.radius * (0.42 + progress * 0.2), Math.sin(a) * effect.radius * (0.32 + progress * 0.18))
      ctx.stroke()
    }
    const talismanCount = Math.min(8, 4 + Math.floor(effect.radius / 55))
    for (let i = 0; i < talismanCount; i += 1) {
      const a = i * Math.PI * 2 / talismanCount + progress * 1.8
      ctx.save()
      ctx.translate(Math.cos(a) * (42 + effect.radius * 0.12), Math.sin(a) * (22 + effect.radius * 0.08))
      ctx.rotate(Math.sin(a) * 0.25)
      ctx.fillStyle = 'rgba(254,202,202,.9)'
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 2
      drawTalisman(40 + effect.radius * 0.05)
      ctx.restore()
    }
  } else if (effect.kind === 'blade' || effect.kind === 'slash') {
    ctx.translate(x + dir * progress * 34, y - 54)
    ctx.scale(dir, 1)
    ctx.globalAlpha = t
    drawVfxImage(vfxSprites.swordWave, 12 + progress * 22, -2, Math.min(250, 114 + effect.radius * 0.72), 0.56 + t * 0.36, -0.08)
    ctx.lineCap = 'round'
    ctx.shadowColor = effect.color
    ctx.shadowBlur = 24
    const length = 72 + effect.radius * 0.18
    const trail = ctx.createLinearGradient(-length, 0, length * 0.34, 0)
    trail.addColorStop(0, 'rgba(103,232,249,0)')
    trail.addColorStop(0.35, 'rgba(103,232,249,.46)')
    trail.addColorStop(1, 'rgba(255,255,255,.92)')
    ctx.strokeStyle = trail
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(-length, 12)
    ctx.quadraticCurveTo(-length * 0.25, -20 - progress * 12, length * 0.18, -4)
    ctx.stroke()
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = '#67e8f9'
    ctx.lineWidth = 2
    drawFlyingSword(82 + state.mutations.swordRide * 12, 8 + state.mutations.swordRide)
    ctx.strokeStyle = `rgba(186,230,253,${0.62 * t})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-length * 0.8, -10)
    ctx.lineTo(-length * 0.28, -10)
    ctx.moveTo(-length * 0.86, 22)
    ctx.lineTo(-length * 0.34, 22)
    ctx.stroke()
  } else if (effect.kind === 'shockwave') {
    ctx.translate(x + dir * progress * 64, y - 30)
    ctx.scale(dir, 1)
    ctx.globalAlpha = t
    drawVfxImage(vfxSprites.swordWave, 68 + progress * 52, -16, Math.min(430, 180 + effect.radius * 0.82), 0.52 + t * 0.42, -0.05)
    ctx.shadowColor = effect.color
    ctx.shadowBlur = 30
    const length = 150 + effect.radius * 0.58 + progress * 70
    const height = 30 + progress * 18
    const wave = ctx.createLinearGradient(-48, 0, length, 0)
    wave.addColorStop(0, 'rgba(186,230,253,0)')
    wave.addColorStop(0.18, 'rgba(224,242,254,.86)')
    wave.addColorStop(0.62, 'rgba(56,189,248,.82)')
    wave.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = wave
    ctx.beginPath()
    ctx.moveTo(-34, 0)
    ctx.bezierCurveTo(20, -height, length * 0.52, -height * 1.15, length, -8)
    ctx.bezierCurveTo(length * 0.7, 18, length * 0.2, 28, -34, 8)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(224,242,254,.88)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(12, -6)
    ctx.quadraticCurveTo(length * 0.32, -32, length * 0.7, -8)
    ctx.quadraticCurveTo(length * 0.82, 1, length * 0.96, -4)
    ctx.stroke()
    ctx.strokeStyle = `rgba(34,211,238,${0.72 * t})`
    ctx.lineWidth = 5
    const zigCount = Math.min(7, 3 + state.mutations.swordDomain)
    for (let i = 0; i < zigCount; i += 1) {
      const px = 22 + i * 52 + progress * 36
      ctx.beginPath()
      ctx.moveTo(px, 18)
      ctx.lineTo(px + 18, -6)
      ctx.lineTo(px + 42, 14)
      ctx.stroke()
    }
    ctx.fillStyle = '#ecfeff'
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = 1.5
    const waveSwordCount = Math.min(10, 4 + state.mutations.swordDomain * 2)
    for (let i = 0; i < waveSwordCount; i += 1) {
      ctx.save()
      ctx.translate(30 + i * 46 + progress * 46, -30 + Math.sin(i + progress * 5) * (12 + state.mutations.swordDomain * 2))
      ctx.rotate(-0.12 + i * 0.04)
      drawFlyingSword(56 + state.mutations.swordDomain * 8, 5 + state.mutations.swordDomain * 0.6)
      ctx.restore()
    }
    ctx.strokeStyle = `rgba(165,243,252,${0.38 * t})`
    ctx.lineWidth = 2
    for (let i = 0; i < 3 + state.mutations.swordDomain; i += 1) {
      ctx.beginPath()
      ctx.ellipse(length * (0.16 + i * 0.14), 24 + (i % 2) * 10, 28 + progress * 16, 10 + i * 2, -0.1, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else {
    ctx.globalAlpha = t * 0.9
    ctx.strokeStyle = effect.color
    ctx.lineWidth = 3
    ctx.shadowColor = effect.color
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.ellipse(x, y - 18, effect.radius * (0.55 + progress * 0.18), 22 + progress * 12, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = `rgba(236,254,255,${0.68 * t})`
    ctx.lineWidth = 1.5
    for (let i = 0; i < 12; i += 1) {
      const a = i * Math.PI / 6
      const rx = Math.cos(a) * effect.radius * (0.5 + progress * 0.16)
      const ry = Math.sin(a) * (22 + progress * 12)
      ctx.beginPath()
      ctx.moveTo(x + rx * 0.86, y - 18 + ry * 0.86)
      ctx.lineTo(x + rx, y - 18 + ry)
      ctx.stroke()
    }
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = effect.color
    ctx.lineWidth = 1.4
    for (let i = 0; i < 8; i += 1) {
      const a = i * Math.PI / 4 + progress * Math.PI
      const rx = Math.cos(a) * effect.radius * (0.44 + progress * 0.12)
      const ry = Math.sin(a) * (24 + progress * 13)
      ctx.save()
      ctx.translate(x + rx, y - 18 + ry)
      ctx.rotate(a + Math.PI / 2)
      drawFlyingSword(34, 4)
      ctx.restore()
    }
  }
  ctx.restore()
}

function drawEnemySide(enemy: Enemy, x: number, groundY: number) {
  if (drawEnemySprite(enemy, x, groundY)) return
  if (enemy.kind === 'bat') {
    drawBatEnemy(enemy, x, groundY)
    return
  }
  if (enemy.kind === 'wolf') {
    drawWolfEnemy(enemy, x, groundY)
    return
  }
  if (enemy.kind === 'crystal' || enemy.kind === 'warden') {
    drawCrystalEnemy(enemy, x, groundY)
    return
  }
  drawSpiritEnemy(enemy, x, groundY)
}

function enemySpriteLayout(enemy: Enemy) {
  if (enemy.kind === 'warden' || enemy.boss) return { width: 186, height: 186, lift: 4, barWidth: 118, barY: 164 }
  if (enemy.kind === 'bat') return { width: enemy.elite ? 132 : 112, height: enemy.elite ? 132 : 112, lift: 50, barWidth: enemy.elite ? 82 : 68, barY: 112 }
  if (enemy.kind === 'crystal') return { width: enemy.elite ? 142 : 122, height: enemy.elite ? 142 : 122, lift: 0, barWidth: enemy.elite ? 86 : 72, barY: 120 }
  if (enemy.kind === 'wolf') return { width: enemy.elite ? 132 : 116, height: enemy.elite ? 132 : 116, lift: 0, barWidth: enemy.elite ? 84 : 70, barY: 112 }
  return { width: enemy.elite ? 112 : 92, height: enemy.elite ? 112 : 92, lift: 0, barWidth: enemy.elite ? 76 : 62, barY: 92 }
}

function drawEnemySprite(enemy: Enemy, x: number, groundY: number) {
  const sprite = monsterSprites[enemy.kind]
  if (!sprite?.complete || sprite.naturalWidth <= 0) return false
  const theme = activeStageTheme()
  const layout = enemySpriteLayout(enemy)
  const pulse = Math.sin(performance.now() * 0.006 + enemy.id) * 0.5 + 0.5
  const float = enemy.kind === 'bat' ? Math.sin(performance.now() * 0.006 + enemy.id) * 7 : Math.sin(performance.now() * 0.003 + enemy.id) * 2
  const baseY = groundY - layout.lift + float
  const faceRight = state.hero.x > enemy.x
  ctx.save()
  ctx.translate(x, baseY)
  ctx.globalAlpha = enemy.hit > 0 ? 0.72 : 1
  ctx.fillStyle = 'rgba(0,0,0,.34)'
  ctx.beginPath()
  ctx.ellipse(0, 8, layout.width * (enemy.kind === 'bat' ? 0.28 : 0.33), enemy.kind === 'bat' ? 6 : 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = enemy.boss ? '#facc15' : enemy.elite ? '#fb923c' : theme.accent
  ctx.shadowBlur = enemy.boss ? 26 : enemy.elite ? 20 : 12
  if (faceRight) ctx.scale(-1, 1)
  const hitScale = 1 + (enemy.hit > 0 ? 0.04 : 0) + (enemy.elite ? pulse * 0.018 : 0)
  ctx.scale(hitScale, hitScale)
  ctx.drawImage(sprite, -layout.width / 2, -layout.height + 12, layout.width, layout.height)
  ctx.restore()

  if (enemy.elite || enemy.boss) {
    ctx.save()
    ctx.globalAlpha = enemy.boss ? 0.36 : 0.22
    ctx.strokeStyle = enemy.boss ? '#facc15' : theme.accent
    ctx.lineWidth = enemy.boss ? 3 : 2
    ctx.shadowColor = ctx.strokeStyle
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.ellipse(x, baseY - layout.height * 0.44, layout.width * 0.44, layout.height * 0.38, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  drawEnemyBar(enemy, x, baseY - layout.barY, layout.barWidth)
  return true
}

function drawSpiritEnemy(enemy: Enemy, x: number, groundY: number) {
  const theme = activeStageTheme()
  const pulse = Math.sin(performance.now() * 0.006 + enemy.id) * 0.5 + 0.5
  const y = groundY - 36 + Math.sin(performance.now() * 0.004 + enemy.id) * 6
  const size = enemy.boss ? 54 : enemy.elite ? 42 : 34
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = enemy.hit > 0 ? 0.72 : 1
  ctx.fillStyle = 'rgba(0,0,0,.3)'
  ctx.beginPath()
  ctx.ellipse(0, size * 0.92, size * 0.72, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = enemy.elite ? '#fb923c' : theme.accent
  ctx.shadowBlur = enemy.elite ? 24 : 18
  const core = ctx.createRadialGradient(-size * 0.18, -size * 0.22, 4, 0, 0, size * 1.1)
  core.addColorStop(0, '#f8fafc')
  core.addColorStop(0.35, theme.enemy)
  core.addColorStop(1, theme.enemyDark)
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.ellipse(0, 0, size * (0.82 + pulse * 0.06), size * (0.72 + pulse * 0.08), 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = enemy.elite ? 4 : 3
  ctx.beginPath()
  ctx.arc(0, 0, size * (0.96 + pulse * 0.1), -Math.PI * 0.15, Math.PI * 1.32)
  ctx.stroke()
  ctx.strokeStyle = `${theme.detail}cc`
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i += 1) {
    const tailY = size * 0.18 + i * 8
    ctx.beginPath()
    ctx.moveTo(-size * 0.2 + i * 4, tailY)
    ctx.quadraticCurveTo(-size * (0.56 + i * 0.08), tailY + 18 + pulse * 10, -size * (0.26 + i * 0.08), tailY + 34)
    ctx.stroke()
  }
  ctx.fillStyle = '#020617'
  ctx.beginPath()
  ctx.arc(-size * 0.18, -size * 0.1, 3.2, 0, Math.PI * 2)
  ctx.arc(size * 0.2, -size * 0.08, 3.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  drawEnemyBar(enemy, x, y - size - 18, enemy.elite ? 76 : 62)
}

function enemyHealthColor(enemy: Enemy) {
  if (enemy.boss) return '#facc15'
  const theme = activeStageTheme()
  if (enemy.kind === 'bat') return theme.detail
  if (enemy.kind === 'wolf') return theme.enemy
  if (enemy.kind === 'crystal') return theme.accent
  return enemy.elite ? '#fb923c' : theme.enemy
}

function drawEnemyName(enemy: Enemy, x: number, y: number) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = 'bold 13px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = enemy.boss ? '#fef08a' : enemy.elite ? '#fed7aa' : '#c7d2fe'
  ctx.fillText(enemyDisplayName(enemy), x, y)
  ctx.restore()
}

function drawEnemyBar(enemy: Enemy, x: number, y: number, width: number) {
  ctx.fillStyle = 'rgba(0,0,0,.58)'
  ctx.beginPath()
  ctx.roundRect(x - width / 2, y, width, 7, 4)
  ctx.fill()
  ctx.fillStyle = enemyHealthColor(enemy)
  ctx.beginPath()
  ctx.roundRect(x - width / 2, y, width * Math.max(0, enemy.hp / enemy.maxHp), 7, 4)
  ctx.fill()
  drawEnemyName(enemy, x, y - 7)
}

function drawBatEnemy(enemy: Enemy, x: number, groundY: number) {
  const theme = activeStageTheme()
  const flap = Math.sin(performance.now() * 0.014 + enemy.id) * 9
  const y = groundY - (enemy.elite ? 78 : 62) + Math.sin(performance.now() * 0.004 + enemy.id) * 7
  const scale = enemy.elite ? 1.16 : 1
  const facing = state.hero.x < enemy.x ? -1 : 1
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(facing * scale, scale)
  ctx.globalAlpha = enemy.hit > 0 ? 0.72 : 1
  ctx.shadowColor = theme.accent
  ctx.shadowBlur = enemy.elite ? 20 : 12
  ctx.fillStyle = enemy.elite ? theme.enemyDark : '#0f172a'
  ctx.beginPath()
  ctx.moveTo(-8, -2)
  ctx.quadraticCurveTo(-50, -34 - flap, -74, 10)
  ctx.quadraticCurveTo(-40, 0 + flap, -14, 18)
  ctx.quadraticCurveTo(0, 12, 14, 18)
  ctx.quadraticCurveTo(40, 0 + flap, 74, 10)
  ctx.quadraticCurveTo(50, -34 - flap, 8, -2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = enemy.elite ? theme.accent : theme.detail
  ctx.beginPath()
  ctx.ellipse(0, 0, 17, 21, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#020617'
  ctx.beginPath()
  ctx.arc(-5, -4, 3, 0, Math.PI * 2)
  ctx.arc(7, -4, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  drawEnemyBar(enemy, x, y - 42, enemy.elite ? 76 : 62)
}

function drawWolfEnemy(enemy: Enemy, x: number, groundY: number) {
  const theme = activeStageTheme()
  const run = Math.sin(performance.now() * 0.012 + enemy.id)
  const width = enemy.elite ? 92 : 78
  const height = enemy.elite ? 54 : 46
  const facing = state.hero.x < enemy.x ? -1 : 1
  ctx.save()
  ctx.translate(x, groundY - 2)
  ctx.scale(facing, 1)
  ctx.fillStyle = 'rgba(0,0,0,.34)'
  ctx.beginPath()
  ctx.ellipse(0, 11, width * 0.38, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = enemy.hit > 0 ? 0.72 : 1
  ctx.shadowColor = theme.enemy
  ctx.shadowBlur = enemy.elite ? 18 : 10
  ctx.fillStyle = enemy.elite ? theme.enemyDark : darkenHex(theme.enemyDark, 0.82)
  ctx.beginPath()
  ctx.ellipse(0, -24, width * 0.38, height * 0.42, -0.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(width * 0.28, -30)
  ctx.lineTo(width * 0.58, -38)
  ctx.lineTo(width * 0.48, -12)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = enemy.elite ? theme.accent : theme.detail
  ctx.beginPath()
  ctx.moveTo(width * 0.42, -44)
  ctx.lineTo(width * 0.5, -64)
  ctx.lineTo(width * 0.58, -42)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-width * 0.22, -4)
  ctx.lineTo(-width * 0.22 + run * 5, 9)
  ctx.moveTo(width * 0.1, -5)
  ctx.lineTo(width * 0.1 - run * 5, 10)
  ctx.stroke()
  ctx.restore()
  drawEnemyBar(enemy, x, groundY - height - 30, enemy.elite ? 82 : 68)
}

function drawCrystalEnemy(enemy: Enemy, x: number, groundY: number) {
  const theme = activeStageTheme()
  const boss = enemy.kind === 'warden' || enemy.boss
  const pulse = Math.sin(performance.now() * 0.005 + enemy.id) * 0.5 + 0.5
  const size = boss ? 76 : enemy.elite ? 56 : 46
  ctx.save()
  ctx.translate(x, groundY)
  ctx.fillStyle = 'rgba(0,0,0,.38)'
  ctx.beginPath()
  ctx.ellipse(0, 9, size * 0.48, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = enemy.hit > 0 ? 0.72 : 1
  ctx.shadowColor = boss ? '#facc15' : theme.accent
  ctx.shadowBlur = boss ? 30 : 18
  ctx.fillStyle = boss ? theme.enemyDark : enemy.elite ? theme.enemyDark : darkenHex(theme.enemyDark, 0.86)
  ctx.beginPath()
  ctx.moveTo(0, -size - 18 - pulse * 6)
  ctx.lineTo(size * 0.48, -size * 0.34)
  ctx.lineTo(size * 0.32, -6)
  ctx.lineTo(0, 7)
  ctx.lineTo(-size * 0.38, -7)
  ctx.lineTo(-size * 0.5, -size * 0.36)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = boss ? '#fef08a' : theme.detail
  ctx.lineWidth = boss ? 4 : 3
  ctx.stroke()
  ctx.fillStyle = boss ? '#facc15' : theme.accent
  ctx.globalAlpha = 0.72
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.78)
  ctx.lineTo(size * 0.16, -size * 0.36)
  ctx.lineTo(0, -size * 0.12)
  ctx.lineTo(-size * 0.14, -size * 0.36)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  drawEnemyBar(enemy, x, groundY - size - 34, boss ? 112 : enemy.elite ? 82 : 66)
}

function drawLegacyHero(x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(heroFacing + Math.PI / 2)

  ctx.strokeStyle = 'rgba(34,211,238,.22)'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.arc(0, 3, 36, Math.PI * 0.06, Math.PI * 0.94)
  ctx.stroke()

  const heroSprite = sprites.player
  if (heroSprite.complete && heroSprite.naturalWidth > 0) {
    ctx.fillStyle = 'rgba(0,0,0,.34)'
    ctx.beginPath()
    ctx.ellipse(0, 22, 24, 11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = '#22d3ee'
    ctx.shadowBlur = 20
    ctx.drawImage(heroSprite, -30, -36, 60, 72)
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(18, -2)
    ctx.lineTo(34, -24)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(250,204,21,.38)'
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(33, -22)
    ctx.lineTo(43, -38)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(103,232,249,.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 42, -Math.PI * 0.95, -Math.PI * 0.08)
    ctx.stroke()
    ctx.restore()
    return
  }

  ctx.shadowColor = '#22d3ee'
  ctx.shadowBlur = 22

  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.roundRect(-13, -16, 26, 34, 9)
  ctx.fill()

  ctx.fillStyle = '#38bdf8'
  ctx.beginPath()
  ctx.roundRect(-9, -12, 18, 24, 6)
  ctx.fill()

  ctx.fillStyle = '#0284c7'
  ctx.beginPath()
  ctx.roundRect(-23, -10, 11, 24, 7)
  ctx.roundRect(12, -10, 11, 24, 7)
  ctx.fill()

  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.roundRect(-8, -31, 16, 15, 7)
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.fillStyle = '#e0f2fe'
  ctx.beginPath()
  ctx.roundRect(-5, -28, 10, 5, 3)
  ctx.fill()

  ctx.fillStyle = '#facc15'
  ctx.fillRect(-7, -20, 14, 3)

  ctx.fillStyle = '#1d4ed8'
  ctx.beginPath()
  ctx.roundRect(-12, 13, 8, 23, 5)
  ctx.roundRect(4, 13, 8, 23, 5)
  ctx.fill()

  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(20, -2)
  ctx.lineTo(34, -22)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(250,204,21,.38)'
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(33, -20)
  ctx.lineTo(42, -34)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(103,232,249,.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 42, -Math.PI * 0.95, -Math.PI * 0.08)
  ctx.stroke()
  ctx.restore()
}

function drawRideSword(t: number, strong = false) {
  const pulse = Math.sin(t * 0.7) * 0.5 + 0.5
  const length = strong ? 112 : 96
  const lift = strong ? -4 : -1
  ctx.save()
  ctx.translate(0, 12 + lift + Math.sin(t * 0.32) * 1.6)
  ctx.shadowColor = strong ? '#e0f2fe' : '#67e8f9'
  ctx.shadowBlur = strong ? 28 : 20
  const glow = ctx.createLinearGradient(-length * 0.58, 0, length * 0.58, 0)
  glow.addColorStop(0, 'rgba(34,211,238,0)')
  glow.addColorStop(0.5, `rgba(125,211,252,${0.72 + pulse * 0.18})`)
  glow.addColorStop(1, 'rgba(34,211,238,0)')
  ctx.strokeStyle = glow
  ctx.lineWidth = strong ? 12 : 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-length * 0.54, 4)
  ctx.quadraticCurveTo(0, -5, length * 0.54, 4)
  ctx.stroke()

  ctx.shadowBlur = 14
  ctx.fillStyle = '#ecfeff'
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(length * 0.58, 0)
  ctx.lineTo(length * 0.32, -7)
  ctx.lineTo(-length * 0.38, -5)
  ctx.lineTo(-length * 0.5, 0)
  ctx.lineTo(-length * 0.38, 5)
  ctx.lineTo(length * 0.32, 7)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = `rgba(186,230,253,${0.7 + pulse * 0.2})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-length * 0.34, 0)
  ctx.lineTo(length * 0.42, 0)
  ctx.stroke()
  ctx.strokeStyle = `rgba(94,234,212,${0.34 + pulse * 0.28})`
  ctx.lineWidth = 2
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath()
    ctx.moveTo(-length * (0.5 + i * 0.08), 9 + i * 4)
    ctx.lineTo(-length * (0.18 + i * 0.08), 7 + i * 3)
    ctx.stroke()
  }
  ctx.restore()
}

function drawHeroMotionAura(t: number, moving: boolean, attackPulse: number) {
  const step = Math.sin(t)
  ctx.save()
  if (moving) {
    ctx.globalAlpha = 0.3
    ctx.strokeStyle = 'rgba(125,211,252,.7)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 0; i < 5; i += 1) {
      const y = -82 + i * 20 + step * 3
      ctx.beginPath()
      ctx.moveTo(-72 - i * 8, y)
      ctx.quadraticCurveTo(-44, y + 8, -18, y + 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#67e8f9'
    ctx.beginPath()
    ctx.ellipse(-42, 18, 28 + Math.abs(step) * 8, 7, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (attackPulse > 0) {
    ctx.globalAlpha = 0.28 + attackPulse * 0.28
    ctx.strokeStyle = '#e0f2fe'
    ctx.shadowColor = '#67e8f9'
    ctx.shadowBlur = 24
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(14, -70, 82 + attackPulse * 18, -0.65, 0.48)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(250,204,21,.82)'
    ctx.beginPath()
    ctx.arc(18, -70, 58 + attackPulse * 14, -0.52, 0.38)
    ctx.stroke()
  }
  ctx.restore()
}

function drawHeroImageAnimated(heroSprite: HTMLImageElement, width: number, height: number, moving: boolean, attackPulse: number, t: number) {
  const step = Math.sin(t)
  const tilt = moving ? step * 0.035 : 0
  const lean = moving ? 4 + Math.max(0, step) * 2 : 0
  const attackLean = attackPulse * 10
  if (moving) {
    ctx.save()
    ctx.globalAlpha = 0.13
    ctx.translate(-18 - Math.abs(step) * 5, 2)
    ctx.rotate(tilt * 0.7)
    ctx.drawImage(heroSprite, -width * 0.54, -height + 12, width, height)
    ctx.restore()
  }
  ctx.save()
  ctx.translate(lean + attackLean, moving ? Math.abs(step) * -1.5 : 0)
  ctx.rotate(tilt - attackPulse * 0.05)
  ctx.scale(1 + attackPulse * 0.035, 1 - attackPulse * 0.015)
  ctx.drawImage(heroSprite, -width * 0.54, -height + 12, width, height)
  ctx.restore()
}

function getHeroActionSprite(isMoving: boolean, attackPulse: number) {
  if (state.activeCharacter !== 'sword') return null
  if (attackPulse > 0.12) return swordActionSprites.slash
  if (isMoving) return swordActionSprites.fly
  return swordActionSprites.idle
}

function drawHeroSide(x: number, groundY: number) {
  if (!ctx) {
    drawLegacyHero(x, groundY)
    return
  }
  const attackAge = performance.now() - lastAttackFlash
  const attackPulse = Math.max(0, 1 - attackAge / 360)
  const isAttacking = attackPulse > 0
  const isMoving = heroIsMoving()
  const t = performance.now() * 0.01
  const step = isMoving ? Math.sin(t) : 0
  const actionSprite = getHeroActionSprite(isMoving, attackPulse)
  const heroSprite = actionSprite ?? characterSprites[state.activeCharacter] ?? sprites.cultivator
  if (heroSprite.complete && heroSprite.naturalWidth > 0) {
    const usingActionSprite = heroSprite === actionSprite
    const bob = isMoving ? Math.sin(t) * 2 : Math.sin(t * 0.35) * 1.2
    ctx.save()
    ctx.translate(x, groundY + bob)
    if (shouldFlipHeroSprite()) ctx.scale(-1, 1)
    if (!usingActionSprite) drawRideSword(t, state.mutations.swordRide > 0)
    drawHeroMotionAura(t, isMoving, attackPulse)
    ctx.fillStyle = 'rgba(0,0,0,.34)'
    ctx.beginPath()
    ctx.ellipse(isMoving ? -8 - Math.abs(step) * 4 : 0, 18, usingActionSprite ? 68 : isMoving ? 48 : 42, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = isAttacking ? '#e0f2fe' : '#67e8f9'
    ctx.shadowBlur = isAttacking ? 28 : 18
    const width = usingActionSprite ? 210 : 142
    const height = usingActionSprite ? 210 : 154
    drawHeroImageAnimated(heroSprite, width, height, usingActionSprite ? false : isMoving, usingActionSprite ? attackPulse * 0.25 : attackPulse, t)
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(186,230,253,.68)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(attackPulse * 8, -55, 34 + attackPulse * 8, 52, 0, -0.15, Math.PI * 1.1)
    ctx.stroke()
    ctx.restore()
    return
  }
  ctx.save()
  ctx.translate(x, groundY)
  if (shouldFlipHeroSprite()) ctx.scale(-1, 1)
  drawRideSword(t, state.mutations.swordRide > 0)
  ctx.fillStyle = 'rgba(0,0,0,.38)'
  ctx.beginPath()
  ctx.ellipse(0, 18, 38, 10, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowColor = '#67e8f9'
  ctx.shadowBlur = 18
  ctx.strokeStyle = 'rgba(125,211,252,.42)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(0, -32, 30 + Math.sin(t * 0.4) * 3, 46, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.shadowBlur = 0
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(0, -68, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(-9, -72, 18, 38)

  ctx.fillStyle = '#f6c8a2'
  ctx.beginPath()
  ctx.arc(0, -62, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.moveTo(-16, -65)
  ctx.quadraticCurveTo(0, -86, 18, -65)
  ctx.quadraticCurveTo(5, -68, -16, -65)
  ctx.fill()

  const robe = ctx.createLinearGradient(0, -52, 0, 10)
  robe.addColorStop(0, '#ecfeff')
  robe.addColorStop(0.42, '#38bdf8')
  robe.addColorStop(1, '#1e3a8a')
  ctx.fillStyle = robe
  ctx.beginPath()
  ctx.moveTo(-18, -48)
  ctx.quadraticCurveTo(0, -58, 18, -48)
  ctx.lineTo(26, 6)
  ctx.quadraticCurveTo(0, 16, -26, 6)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(224,242,254,.72)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -48)
  ctx.lineTo(-8, 6)
  ctx.moveTo(0, -48)
  ctx.lineTo(9, 6)
  ctx.stroke()

  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-10, 4)
  ctx.lineTo(-12 + step * 5, 16)
  ctx.moveTo(10, 4)
  ctx.lineTo(12 - step * 5, 16)
  ctx.stroke()

  ctx.shadowColor = '#bae6fd'
  ctx.shadowBlur = isAttacking ? 26 : 16
  ctx.fillStyle = '#e0f2fe'
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 2
  const swordLift = isAttacking ? -7 : Math.sin(t * 0.5) * 3
  ctx.beginPath()
  ctx.moveTo(29, -52 + swordLift)
  ctx.lineTo(55, -67 + swordLift)
  ctx.lineTo(45, -42 + swordLift)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = 'rgba(125,211,252,.55)'
  ctx.beginPath()
  ctx.arc(28, -43, 18, -0.9, 0.8)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()
}

function updateHeroShowcase() {
  const character = activeCharacter()
  if (!heroShowcaseImg.src.endsWith(character.portrait)) heroShowcaseImg.src = character.portrait
  const weapon = state.gear.weapon?.name ?? '无武器'
  const armor = state.gear.armor?.name ?? '无护甲'
  heroShowcaseLevel.textContent = `Lv.${state.hero.level}`
  heroShowcaseTitle.textContent = `${character.name} · ${state.mode === 'dungeon' ? dungeonStageTitle() : worldStageTitle()}`
  heroShowcaseGear.textContent = `${character.title} | ${weapon} / ${armor}`
  heroShowcaseImg.classList.toggle('facing-left', shouldFlipHeroSprite())
}

function updateHud() {
  updateHeroShowcase()
  setText('ticket-count', String(state.tickets))
  setText('level-label', `Lv.${state.hero.level}`)
  setText('atk-label', `攻击 ${totalAtk()}`)
  setText('kill-label', `击杀 ${state.kills}`)
  setText('soul-label', `魂Lv.${state.hero.level} ${state.soulExp}/${soulNeed()}`)
  const currentStage = worldStageNo()
  setText('wave-label', state.mode === 'dungeon' ? `副本 ${Math.ceil(state.dungeonTime)}s` : `第${currentStage}关`)
  setText('mode-label', state.mode === 'dungeon' ? `副本·${dungeonStageTitle()}` : `世界地图·${worldStageTitle(currentStage)}`)
  setText('message', state.message)
  const extractDistance = state.dungeonGateFound
    ? Math.round(Math.hypot(state.hero.x - state.dungeonExtractX, state.hero.y - state.dungeonExtractY))
    : 0
  const dungeon = activeDungeonDef()
  const dungeonKills = Math.max(0, state.kills - state.dungeonStartKills)
  const dungeonProgress = state.mode === 'dungeon'
    ? state.bossSpawned
      ? `Boss 战 | 碎片 ${state.dungeonMaterials}/${state.dungeonMaterialGoal} | 携带 券${state.dungeonLootTickets}/经${state.dungeonLootExp}/精${state.dungeonLootSkill} | ${state.dungeonGateFound ? `撤离 ${extractDistance}m` : '找门'}`
      : `清怪 ${dungeonKills}/${dungeon.killGoal} | 碎片 ${state.dungeonMaterials}/${state.dungeonMaterialGoal} | 携带 券${state.dungeonLootTickets}/经${state.dungeonLootExp}/精${state.dungeonLootSkill} | ${state.dungeonGateFound ? `撤离 ${extractDistance}m` : '找门'}`
    : ''
  setText('quest-label', dungeonProgress || (state.questClaimed ? `当前：第${currentStage}关 ${worldStageTitle(currentStage)}，每日副本 ${state.dungeonEntries}/3，进副本拿抽卡券和法宝` : `当前：第${currentStage}关 ${worldStageTitle(currentStage)} | 任务击杀 ${Math.min(state.kills, state.questTarget)}/${state.questTarget}`))
  const artifactCount = artifactKeys.filter((key) => hasArtifact(key)).length
  setText('gear-label', `法宝 ${artifactCount}/${artifactKeys.length} | 精华 ${state.skills.points} | 质变：${mutationSummary()} | 装备：${state.gear.weapon?.name ?? '无武器'} | ${state.gear.armor?.name ?? '无护甲'} | ${state.gear.core?.name ?? '无核心'}`)
  document.querySelector<HTMLElement>('#hp-bar')!.style.width = `${Math.max(0, state.hero.hp / maxHp()) * 100}%`
  modeBtn.textContent = state.mode === 'dungeon' ? '撤离' : '选择副本'
  autoOrb.classList.toggle('manual', !!moveTarget)
  autoOrb.classList.toggle('paused', state.mode === 'wild' && !state.autoExplore && !moveTarget)
  autoOrbLabel.innerHTML = moveTarget ? '手动<br>目标' : state.mode === 'dungeon' ? '副本<br>探索' : state.autoExplore ? '自动<br>推进' : '暂停<br>推进'
  pullOne.disabled = pulling || state.tickets < 1
  pullTen.disabled = pulling || state.tickets < 10
  gachaTicketCount.textContent = String(state.tickets)
  gachaPityCount.textContent = `${Math.min(state.pity, 10)}/10`
  gachaPityBar.style.width = `${Math.min(100, state.pity * 10)}%`
  if (!dungeonPanel.hidden) renderDungeonPanel()
  if (!equipPanel.hidden) renderEquipPanel()
  if (!bagPanel.hidden) renderBagPanel()
  if (!skillPanel.hidden) renderSkillPanel()
}

function setText(id: string, text: string) {
  document.querySelector<HTMLElement>(`#${id}`)!.textContent = text
}

function toast(text: string) {
  state.message = text
}

function prepareGachaPage() {
  gateCore.classList.remove('opening')
  const label = gateCore.querySelector('span')
  if (label) label.textContent = '等待连接'
  if (!pullResults.innerHTML.trim()) {
    pullResults.innerHTML = '<div class="gacha-empty">星门尚未开启。抽卡券来自副本撤离和通关，可召回装备、角色碎片与修炼材料。</div>'
  }
}

function showPage(page: AppPage) {
  activePage = page
  Object.entries(pagePanels).forEach(([key, panel]) => {
    panel.hidden = key !== page
  })
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.page === page)
  })
  if (page === 'gacha') prepareGachaPage()
  if (page === 'dungeon') renderDungeonPanel()
  if (page === 'equip') {
    renderEquipPanel()
    advanceGuide(3)
  }
  if (page === 'bag') {
    renderBagPanel()
    advanceGuide(3)
  }
  if (page === 'artifact') renderSkillPanel()
  updateHud()
}

function loop(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000)
  last = now
  update(dt)
  draw()
  requestAnimationFrame(loop)
}

function bindControls() {
  window.addEventListener('pointerdown', unlockAudio, { passive: true })
  window.addEventListener('click', unlockAudio)
  canvas.addEventListener('pointerdown', (event) => {
    unlockAudio()
    dragMovePointer = event.pointerId
    canvas.setPointerCapture(event.pointerId)
    setMoveTargetFromPointer(event, true)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (dragMovePointer === event.pointerId) setMoveTargetFromPointer(event, false)
  })
  canvas.addEventListener('pointerup', () => { dragMovePointer = null })
  canvas.addEventListener('pointercancel', () => { dragMovePointer = null })
  autoOrb.addEventListener('click', toggleAutoExplore)
  modeBtn.addEventListener('click', () => {
    if (state.mode === 'dungeon') enterDungeon()
    else showPage('dungeon')
  })
  profileBtn.addEventListener('click', () => showProfilePanel(false))
  closeProfile.addEventListener('click', () => { if (activeProfile) profilePanel.hidden = true })
  profileSwitch.addEventListener('click', () => showProfilePanel(true))
  profileForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const name = normalizeProfileName(profileNameInput.value)
    const pin = profilePinInput.value.trim()
    if (!name) {
      setProfileError('先输入玩家名。')
      profileNameInput.focus()
      return
    }
    const index = readProfileIndex()
    const existing = index.profiles.find((profile) => profile.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (existing.pin && existing.pin !== pin) {
        setProfileError('本机口令不对。')
        profilePinInput.focus()
        return
      }
      activateProfile(existing.id)
      return
    }
    const profile = createProfile(name, pin)
    index.profiles.push(profile)
    index.activeId = profile.id
    writeProfileIndex(index)
    activateProfile(profile.id)
  })
  loreBtn.addEventListener('click', () => { lorePanel.hidden = false })
  dungeonBtn.addEventListener('click', () => showPage('dungeon'))
  gachaBtn.addEventListener('click', () => showPage('gacha'))
  equipBtn.addEventListener('click', () => showPage('equip'))
  bagBtn.addEventListener('click', () => showPage('bag'))
  trainBtn.addEventListener('click', () => showPage('artifact'))
  navButtons.forEach((button) => {
    const page = button.dataset.page as AppPage | undefined
    if (page === 'battle') button.addEventListener('click', () => showPage('battle'))
  })
  closeGacha.addEventListener('click', () => { showPage('battle') })
  closeDungeon.addEventListener('click', () => { showPage('battle') })
  closeLore.addEventListener('click', () => { lorePanel.hidden = true })
  closeSettlement.addEventListener('click', () => { settlementPanel.hidden = true })
  closeEquip.addEventListener('click', () => { showPage('battle') })
  closeBag.addEventListener('click', () => { showPage('battle') })
  closeSkillPanel.addEventListener('click', () => { showPage('battle') })
  pullOne.addEventListener('click', () => pull(1))
  pullTen.addEventListener('click', () => pull(10))
}

function toggleAutoExplore() {
  if (state.mode !== 'wild') {
    toast('副本中使用点击落点移动，撤离后可切换自动推进。')
    updateHud()
    return
  }
  state.autoExplore = !state.autoExplore
  if (state.autoExplore) {
    moveTarget = null
    input = { x: 0, y: 0 }
    toast('自动推进已开启。')
  } else {
    autoWorldWalk = 0
    toast('自动推进已暂停，点击战斗画面移动。')
  }
  saveGame()
  updateHud()
}

function setMoveTargetFromPointer(event: PointerEvent, allowDash: boolean) {
  if (activePage !== 'battle' || !evolutionPanel.hidden || !settlementPanel.hidden || !lorePanel.hidden || !profilePanel.hidden) return
  const rect = canvas.getBoundingClientRect()
  const sx = ((event.clientX - rect.left) / rect.width) * canvas.width
  const sy = ((event.clientY - rect.top) / rect.height) * canvas.height
  const groundY = canvas.height * 0.72
  const ox = canvas.width / 2 - state.hero.x
  const oy = groundY - state.hero.y
  moveTarget = {
    x: sx - ox,
    y: Math.max(-44, Math.min(44, sy - oy)),
  }
  moveTargetPulse = 0.45
  heroFacing = moveTarget.x < state.hero.x ? Math.PI : 0
  const now = performance.now()
  if (allowDash && now - lastCanvasTapAt < 320) {
    dashToMoveTarget()
    moveTargetPulse = 0.65
  }
  if (allowDash) lastCanvasTapAt = now
  advanceGuide(0)
}

bindControls()
initProfiles()
if (activeProfile) loadGame()
ensureEnemies()
updateHud()
updateGuide()
setInterval(saveGame, 5000)
window.addEventListener('beforeunload', saveGame)
requestAnimationFrame(loop)
