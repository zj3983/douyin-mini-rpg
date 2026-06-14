import './style.css'

type Rarity = '普通' | '稀有' | '史诗' | '传说'
type Mode = 'wild' | 'dungeon'
type AppPage = 'battle' | 'dungeon' | 'gacha' | 'equip' | 'bag' | 'artifact'
type Slot = 'weapon' | 'armor' | 'core'
type AttackSource = 'manual' | 'skill'
type EvolutionTier = '初阶' | '进阶' | '高阶'
type ProfileAuthMode = 'login' | 'register'
type EnemyKind = 'slime' | 'bat' | 'wolf' | 'crystal' | 'warden'
type CharacterId = 'sword' | 'thunder' | 'flame' | 'wood'
type ArtifactKey = 'slash' | 'burst' | 'regen' | 'chain' | 'orbit' | 'flame' | 'bell' | 'needle' | 'mirror' | 'fan' | 'banner' | 'seal'
type DungeonId = 'mossCave' | 'starHall' | 'mistMaze' | 'crystalMine' | 'bloodRift' | 'kingTomb'
type MaterialKind = 'herb' | 'ore' | 'relic'
type EnemySkillKind = 'spiritOrb' | 'wingBlade' | 'earthSpike' | 'bossDomain'
type SettlementTone = 'clear' | 'extract' | 'fail' | 'world'

interface Vec { x: number; y: number }
interface Enemy extends Vec { id: number; hp: number; maxHp: number; speed: number; elite: boolean; kind: EnemyKind; boss?: boolean; hit: number; castCd?: number; casting?: number; attack?: number; attackCd?: number }
interface FloatingText extends Vec { text: string; color: string; life: number }
type EffectKind = 'ring' | 'slash' | 'blade' | 'shockwave' | 'bolt' | 'orbit' | 'flare' | 'swordrain' | 'thunderstorm' | 'firesea' | 'impact' | 'heal' | 'swordflight' | 'thunderseal'
interface Effect extends Vec { radius: number; color: string; life: number; maxLife: number; kind?: EffectKind; angle?: number; tx?: number; ty?: number; arc?: number }
interface EnemySkill extends Vec { id: number; enemyId: number; kind: EnemySkillKind; targetX: number; targetY: number; radius: number; damage: number; color: string; life: number; maxLife: number; windup: number; hit: boolean; angle: number; boss?: boolean; label: string }
type ParticleKind = 'spark' | 'ember' | 'soul' | 'shard' | 'rune'
interface Particle extends Vec { vx: number; vy: number; size: number; color: string; life: number; maxLife: number; kind: ParticleKind; spin: number }
interface ScreenFlash { color: string; life: number; maxLife: number; strength: number }
interface SoulOrb extends Vec { id: number; value: number; life: number; phase: number }
interface Reward { name: string; rarity: Rarity; count: number; slot?: Slot; atk?: number; hp?: number; skill?: number; characterId?: CharacterId; artifact?: ArtifactKey; material?: MaterialKind; forge?: number }
interface SettlementRewards { tickets?: number; passes?: number; stones?: number; exp?: number; skill?: number; materials?: number }
interface SettlementRewardTile { label: string; value: string; iconHtml?: string; accent?: string }
interface SkillTree { slash: number; burst: number; regen: number; chain: number; orbit: number; flame: number; bell: number; needle: number; mirror: number; fan: number; banner: number; seal: number; points: number }
interface MutationTree { swordRide: number; thunderFork: number; swordDomain: number; flameLotus: number }
interface CharacterTechniqueTree { swordPierce: number; swordReturn: number; swordShadow: number }
interface CharacterDef { id: CharacterId; name: string; title: string; need: number; color: string; portrait: string; battle: string; starter: Partial<SkillTree>; innateSkill: string; desc: string }
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
  image: string
}
interface MainQuest {
  title: string
  desc: string
  goal: number
  reward: string
  progress: () => number
  apply: () => void
}
interface StageTheme {
  name: string
  subtitle: string
  dungeon: string
  bg: string
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
interface EvolutionOption { id: string; iconId: string; iconHtml?: string; title: string; desc: string; color: string; tier: EvolutionTier; mutation?: boolean; apply: () => void }
interface EvolutionTemplate { id: string; title: string; color: string; build: (rank: number, tier: EvolutionTier) => EvolutionOption }
interface SaveData {
  hero: { x: number; y: number; hp: number; baseHp: number; level: number; exp: number; baseAtk: number; skillPower: number }
  gear: Record<Slot, Reward | null>
  skills: SkillTree
  kills: number
  tickets: number
  spiritStones?: number
  dungeonEntries?: number
  pity: number
  wave: number
  worldStage?: number
  worldStageKills?: number
  questClaimed: boolean
  mainQuestIndex?: number
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
  techniques?: Partial<CharacterTechniqueTree>
  activeCharacter?: CharacterId
  ownedCharacters?: CharacterId[]
  characterShards?: Partial<Record<CharacterId, number>>
  artifacts?: Partial<Record<ArtifactKey, number>>
  activeDungeon?: DungeonId
  characterName?: string
}

type CharacterSlotId = 'slot-1' | 'slot-2' | 'slot-3'

interface CloudSlotSave {
  id: CharacterSlotId
  label: string
  updatedAt: number
  save: SaveData | null
}

interface CloudSaveEnvelope {
  kind: 'void-trial-cloud-slots'
  version: 2
  activeSlotId: CharacterSlotId
  slots: CloudSlotSave[]
}

interface PlayerProfile {
  id: string
  name: string
  pin: string
  createdAt: number
  lastLoginAt: number
  activeSlotId: CharacterSlotId
}

interface ServerUser {
  id: string
  username: string
  createdAt: number
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
const baseHeroStats = { hp: 120, atk: 16, mana: 0 }
const levelStatGrowth = { atk: 3, hp: 12, mana: 2 }
const cultivationRealms = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '真仙', '玄仙', '金仙', '仙尊', '道祖']
const cultivationStages = ['一重', '二重', '三重', '四重', '五重', '六重', '七重', '八重', '九重']
const baseMutations: MutationTree = { swordRide: 0, thunderFork: 0, swordDomain: 0, flameLotus: 0 }
const baseTechniques: CharacterTechniqueTree = { swordPierce: 0, swordReturn: 0, swordShadow: 0 }
const techniqueMaxLevel = 6
const mutationMaxLevel = 3
const baseCharacterShards: Record<CharacterId, number> = { sword: 0, thunder: 0, flame: 0, wood: 0 }
const artifactKeys: ArtifactKey[] = ['slash', 'burst', 'chain', 'orbit', 'flame', 'regen', 'bell', 'needle', 'mirror', 'fan', 'banner', 'seal']
const artifactRarityOrder: Rarity[] = ['传说', '史诗', '稀有', '普通']
const materialDefs: Record<MaterialKind, { name: string; rarity: Rarity; desc: string }> = {
  herb: { name: '凝露灵草', rarity: '普通', desc: '副本灵草采集所得，用于温养回复、护身和魂镜类法宝。' },
  ore: { name: '玄铁灵矿', rarity: '稀有', desc: '副本灵矿采集所得，用于淬炼重兵、飞剑和破障类法宝。' },
  relic: { name: '秘境残符', rarity: '史诗', desc: '开启秘境宝匣所得，用于淬炼雷印、符火、镇界和高阶法宝。' },
}
const baseArtifacts: Record<ArtifactKey, number> = {
  slash: 0,
  burst: 0,
  regen: 0,
  chain: 0,
  orbit: 0,
  flame: 0,
  bell: 0,
  needle: 0,
  mirror: 0,
  fan: 0,
  banner: 0,
  seal: 0,
}

const stageSpan = 620
const stageThemes: StageTheme[] = [
  {
    name: '青苔丘陵',
    subtitle: '灵雾初醒',
    dungeon: '青苔丘陵·灵根洞天',
    bg: '/assets/generated/world-moss-hills.webp',
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
    bg: '/assets/generated/world-star-outpost.webp',
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
    bg: '/assets/generated/world-mist-forest.webp',
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
    bg: '/assets/generated/world-crystal-mine.webp',
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
    bg: '/assets/generated/world-blood-rift.webp',
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
    bg: '/assets/generated/world-royal-ruins.webp',
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
    bg: '/assets/generated/world-star-sea.webp',
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
    artifactFocus: ['slash', 'regen', 'bell'],
    trait: '门钥碎片多，适合新手撤离。',
    threat: '灵草傀和青苔兽',
    color: '#5eead4',
    image: '/assets/generated/dungeon-moss-cave.webp',
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
    artifactFocus: ['chain', 'burst', 'needle'],
    trait: '抽卡券收益更高，怪潮更密。',
    threat: '裂隙飞魇和星核晶卫',
    color: '#38bdf8',
    image: '/assets/generated/dungeon-star-hall.webp',
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
    artifactFocus: ['orbit', 'regen', 'mirror'],
    trait: '法宝精华更多，撤离门距离更远。',
    threat: '雾翅妖蝠和司命幻影',
    color: '#99f6e4',
    image: '/assets/generated/dungeon-mist-maze.webp',
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
    artifactFocus: ['burst', 'orbit', 'fan'],
    trait: '精英比例更高，通关更容易出史诗法宝。',
    threat: '晶甲妖兽和紫晶镇守',
    color: '#c084fc',
    image: '/assets/generated/dungeon-crystal-mine.webp',
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
    artifactFocus: ['flame', 'slash', 'banner'],
    trait: '怪物压迫最强，莲火和重尺掉落权重更高。',
    threat: '血牙魔狼和裂隙守门人',
    color: '#fb7185',
    image: '/assets/generated/dungeon-blood-rift.webp',
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
    artifactFocus: ['flame', 'orbit', 'chain', 'seal'],
    trait: '高阶副本，通关结算奖励最高。',
    threat: '铜甲影卫和古庭镇灵',
    color: '#fbbf24',
    image: '/assets/generated/dungeon-king-tomb.webp',
  },
]

const characters: Record<CharacterId, CharacterDef> = {
  sword: { id: 'sword', name: '青岚剑修', title: '剑匣亲和 / 重尺成长', need: 20, color: '#67e8f9', portrait: '/assets/generated/portrait-sword.webp', battle: '/assets/generated/character-sword.png', starter: { slash: 2, orbit: 1 }, innateSkill: '御剑术', desc: '自带御剑术，飞剑会自动出鞘穿刺再回到身边；获得剑类法宝后亲和更高。' },
  thunder: { id: 'thunder', name: '九霄雷使', title: '雷印亲和 / 群怪压制', need: 30, color: '#38bdf8', portrait: '/assets/generated/portrait-thunder.webp', battle: '/assets/generated/character-thunder.png', starter: { chain: 3, burst: 1 }, innateSkill: '雷印诀', desc: '自带雷印诀，后续会扩展为标记和弹射；获得雷印法宝后更适合处理密集怪潮。' },
  flame: { id: 'flame', name: '莲火符师', title: '火鼎亲和 / 范围爆发', need: 30, color: '#fb923c', portrait: '/assets/generated/portrait-flame.webp', battle: '/assets/generated/character-flame.png', starter: { flame: 3, burst: 1 }, innateSkill: '莲火符', desc: '自带莲火符，后续会扩展为符阵铺场；获得火鼎法宝后莲火范围更大。' },
  wood: { id: 'wood', name: '青木灵医', title: '灵瓶亲和 / 稳定刷图', need: 25, color: '#86efac', portrait: '/assets/generated/portrait-wood.webp', battle: '/assets/generated/character-wood.png', starter: { regen: 3, slash: 1 }, innateSkill: '回元息', desc: '自带回元息，后续会扩展为护身和回复；获得回复法宝后续航更强。' },
}

const artifactDefs: Record<ArtifactKey, ArtifactDef> = {
  slash: { key: 'slash', name: '焚海重尺', type: '尺类重兵', color: '#fb923c', rarity: '史诗', iconId: 'blade-3', image: '/assets/generated/artifact-slash.png', max: 10, source: '参考经典玄幻“重尺破浪”类型，使用原创名称。', desc: '获得后强化御剑术距离与飞剑穿刺伤害。' },
  burst: { key: 'burst', name: '太虚镇海葫', type: '葫芦法宝', color: '#a855f7', rarity: '史诗', iconId: 'nova-3', image: '/assets/generated/artifact-burst.png', max: 10, source: '参考葫芦、瓶类收摄法宝的常见设定。', desc: '获得后开启自动剑罡爆发，怪物聚集时释放范围冲击。' },
  chain: { key: 'chain', name: '九霄引雷印', type: '雷印法宝', color: '#38bdf8', rarity: '史诗', iconId: 'chain-3', image: '/assets/generated/artifact-chain.png', max: 10, source: '参考雷印、雷翅、雷法类网文法宝。', desc: '获得后自动引雷弹射，适合清理一条线上的怪潮。' },
  orbit: { key: 'orbit', name: '青竹云剑匣', type: '成套飞剑', color: '#67e8f9', rarity: '传说', iconId: 'orbit-3', image: '/assets/generated/artifact-orbit.png', max: 10, source: '参考成套飞剑和剑匣体系，使用原创名称。', desc: '获得后开启护体剑阵，被围住时飞剑自动环切。' },
  flame: { key: 'flame', name: '琉璃莲火鼎', type: '火鼎法宝', color: '#fb923c', rarity: '传说', iconId: 'flame-3', image: '/assets/generated/artifact-flame.png', max: 10, source: '参考异火、火鼎、莲火类玄幻体系。', desc: '获得后自动铺开莲火符海，密集怪物会被连环引爆。' },
  regen: { key: 'regen', name: '青木回元瓶', type: '灵瓶法宝', color: '#86efac', rarity: '稀有', iconId: 'guard-3', image: '/assets/generated/artifact-regen.png', max: 8, source: '参考灵瓶、药园、青木回复类修仙法宝。', desc: '获得后开启持续回元，战斗中自动恢复生命。' },
  bell: { key: 'bell', name: '清心镇魂铃', type: '铃类法宝', color: '#facc15', rarity: '普通', iconId: 'guard-1', image: '/assets/generated/artifact-bell.png', max: 6, source: '低阶护魂法器，常见于外门试炼和灵根洞天。', desc: '镇定神魂，提升生命上限，并让低阶战斗容错更高。' },
  needle: { key: 'needle', name: '太乙破障针', type: '针类暗宝', color: '#e5e7eb', rarity: '普通', iconId: 'quick-1', image: '/assets/generated/artifact-needle.png', max: 6, source: '参考破障针、飞针、暗器类修仙法器，定位为前期攻击法宝。', desc: '细如银芒，强化飞针斩击，适合补足前期清怪速度。' },
  mirror: { key: 'mirror', name: '玄照映魂镜', type: '魂镜法宝', color: '#22d3ee', rarity: '稀有', iconId: 'nova-2', image: '/assets/generated/artifact-mirror.png', max: 8, source: '参考照妖镜、轮回镜、魂镜类法宝，使用原创名称。', desc: '映照魂魄弱点，提升法宝威力，并略微提高副本精华收益。' },
  fan: { key: 'fan', name: '流云御风扇', type: '风系法宝', color: '#7dd3fc', rarity: '稀有', iconId: 'quick-2', image: '/assets/generated/artifact-fan.png', max: 8, source: '参考芭蕉扇、风雷扇、御风法器的常见设定。', desc: '御风提速，缩短本命术节奏，并提升世界地图自动推进速度。' },
  banner: { key: 'banner', name: '玄阴万魂幡', type: '幡类法宝', color: '#c084fc', rarity: '史诗', iconId: 'magnet-3', image: '/assets/generated/artifact-banner.png', max: 10, source: '参考魂幡、阵旗、招魂幡体系，使用偏暗系原创法宝名。', desc: '收拢副本残魂，提高撤离和通关时携带的抽卡券收益。' },
  seal: { key: 'seal', name: '星斗镇界印', type: '印玺法宝', color: '#fde68a', rarity: '传说', iconId: 'gate-3', image: '/assets/generated/artifact-seal.png', max: 10, source: '参考翻天印、镇界印、星斗印类高阶法宝。', desc: '镇压一方世界线，提升攻击、生命和副本经验结算。' },
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
  hero: { x: 0, y: 0, hp: baseHeroStats.hp, baseHp: baseHeroStats.hp, level: 1, exp: 0, baseAtk: baseHeroStats.atk, skillPower: baseHeroStats.mana },
  gear: { weapon: null, armor: null, core: null } as Record<Slot, Reward | null>,
  skills: { slash: 0, burst: 0, regen: 0, chain: 0, orbit: 0, flame: 0, bell: 0, needle: 0, mirror: 0, fan: 0, banner: 0, seal: 0, points: 0 } as SkillTree,
  artifacts: { ...baseArtifacts },
  mutations: { ...baseMutations },
  techniques: { ...baseTechniques },
  activeDungeon: 'mossCave' as DungeonId,
  characterName: '',
  activeCharacter: 'sword' as CharacterId,
  ownedCharacters: ['sword'] as CharacterId[],
  characterShards: { ...baseCharacterShards },
  enemies: [] as Enemy[],
  enemySkills: [] as EnemySkill[],
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
  spiritStones: 0,
  dungeonEntries: 3,
  pity: 0,
  wave: 1,
  worldStage: 1,
  worldStageKills: 0,
  skillCd: 0,
  chainCd: 0,
  orbitCd: 0,
  flameCd: 0,
  characterSkillCd: 0,
  attackCd: 0,
  dungeonTime: 0,
  dungeonGoal: 12,
  dungeonStartKills: 0,
  dungeonFloorStartKills: 0,
  dungeonExtractX: 0,
  dungeonExtractY: 0,
  dungeonLootTickets: 0,
  dungeonLootExp: 0,
  dungeonLootSkill: 0,
  dungeonLootStones: 0,
  dungeonHerbs: 0,
  dungeonOres: 0,
  dungeonChests: 0,
  dungeonMaterials: 0,
  dungeonMaterialGoal: 3,
  dungeonFloor: 1,
  dungeonMaxFloors: 3,
  dungeonGateFound: false,
  bossSpawned: false,
  lastSettlement: '',
  questTarget: 15,
  questClaimed: false,
  mainQuestIndex: 0,
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
      <div class="currency"><button id="profile-btn" class="lore-btn" type="button">账号</button><button id="lore-btn" class="lore-btn" type="button">档案</button><span>抽卡券</span><b id="ticket-count">0</b><span>灵石</span><b id="stone-count">0</b></div>
      <div class="character-showcase">
        <div class="character-stage"><img id="hero-showcase-img" src="/assets/oga-rpg/hero-idle/FR_Adventurer_Idle_000.png" alt=""></div>
        <div class="character-meta">
          <b id="hero-showcase-level">炼气一重</b>
          <span id="hero-showcase-title">世界行者</span>
          <small id="hero-showcase-gear">无武器 / 无护甲</small>
        </div>
      </div>
      <div class="stat-line">
        <span id="level-label">炼气一重</span>
        <span id="atk-label">攻击 0</span>
        <span id="mana-label">法力 0</span>
        <span id="kill-label">击杀 0</span>
        <span id="soul-label">魂质 0/5</span>
        <span id="wave-label">波次 1</span>
      </div>
      <div class="bar"><i id="hp-bar"></i></div>
    </section>

    <section class="page-stack">
      <section id="battle-view" class="page-view battle-view" data-page="battle">
        <section class="viewport-wrap">
          <canvas id="game" width="540" height="720"></canvas>
        </section>

        <section class="progress-panel">
          <div class="progress-topline"><div id="message" class="message"></div></div>
          <div id="guide-tip" class="guide-tip"></div>
          <div id="main-quest-label" class="main-quest-label">主线：等待同步</div>
          <div id="quest-label">任务：击杀 0/15</div>
          <div id="gear-label">装备：无</div>
        </section>

        <section class="battle-actions">
          <div id="auto-orb" class="auto-orb"><i></i><span id="auto-orb-label">自动<br>探索</span></div>
          <button id="mode-btn" type="button">选择副本 3张</button>
        </section>
      </section>

      <section id="dungeon-panel" class="page-view page-sheet dungeon-sheet" data-page="dungeon" hidden>
      <div class="sheet-head dungeon-head">
        <div><h2>秘境副本</h2><small id="dungeon-entry-summary">入场卷 3张</small></div>
        <button id="close-dungeon" class="page-close" type="button">x</button>
      </div>
      <div class="dungeon-brief">
        <small>每日基础 3 张，世界 Boss 可掉落</small>
        <b>选择秘境，带回抽卡券、法宝和材料</b>
        <span id="dungeon-brief-copy">副本分 3 层推进：前两层收集门钥进入下层，最终层可撤离或击败 Boss 带走完整收益。</span>
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
        <div><small>灵石</small><b id="gacha-stone-count">0</b></div>
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
      <div class="sheet-head skill-head"><div><h2 id="artifact-page-title">法宝匣</h2><small id="artifact-page-subtitle">副本带回的法宝会在这里显形</small></div><button id="close-skill-panel" class="page-close" type="button">x</button></div>
      <div id="skill-points" class="rates"></div>
      <div id="skill-list" class="skill-list"></div>
    </section>
    </section>

    <section id="artifact-detail-panel" class="artifact-detail-panel" hidden></section>

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
      <div class="sheet-head"><h2 id="settlement-title">副本结算</h2><button id="close-settlement" type="button">x</button></div>
      <div id="settlement-results" class="results"></div>
    </section>

    <section id="evolution-panel" class="sheet evolution-sheet" hidden>
      <div class="sheet-head"><h2>魂质进化</h2></div>
      <p class="rates">魂质共鸣已满，选择法宝、技能形态或战斗机制强化本局模板。</p>
      <div id="evolution-list" class="evolution-list"></div>
    </section>

    <section id="profile-panel" class="profile-panel" hidden>
      <form id="profile-form" class="profile-card">
        <div class="profile-brand">
          <small>虚境试炼</small>
          <strong>灵契接入舱</strong>
          <span>云端账号 / 本机兜底</span>
        </div>
        <div class="profile-head">
          <div>
            <small>玩家认证</small>
            <h2 id="profile-auth-title">登录档案</h2>
          </div>
          <button id="close-profile" class="profile-close" type="button">x</button>
        </div>
        <div class="profile-tabs" role="tablist" aria-label="账号模式">
          <button id="profile-mode-login" class="active" type="button">登录</button>
          <button id="profile-mode-register" type="button">注册</button>
        </div>
        <p id="profile-mode-hint" class="profile-note">连接服务器账号，读取云端角色资料；服务器不可用时会退回本机档案。</p>
        <div class="profile-current">
          <span id="profile-current">未登录</span>
          <button id="profile-switch" type="button">切换</button>
        </div>
        <div id="profile-slots" class="profile-slots" hidden>
          <div class="profile-slots-head">
            <b>角色档案槽</b>
            <small>同一账号可保留 3 个角色进度</small>
          </div>
          <div id="profile-slot-list" class="profile-slot-list"></div>
        </div>
        <div id="profile-create-slot" class="profile-create-slot" hidden>
          <div class="profile-create-head">
            <b id="profile-create-title">创建角色</b>
            <button id="profile-create-cancel" type="button">取消</button>
          </div>
          <label class="profile-field compact">
            <span>角色名</span>
            <input id="profile-character-name" maxlength="10" autocomplete="off" placeholder="输入角色名">
          </label>
          <div>
            <small class="profile-create-label">选择职业</small>
            <div id="profile-character-options" class="profile-choice-grid"></div>
          </div>
          <div>
            <small class="profile-create-label">初始法宝倾向</small>
            <div id="profile-artifact-options" class="profile-choice-grid"></div>
          </div>
          <button id="profile-create-confirm" class="profile-create-confirm" type="button">创建并进入</button>
        </div>
        <div class="profile-cloud">
          <div>
            <b id="profile-cloud-status">本机档案</b>
            <small id="profile-cloud-detail">登录服务器账号后可同步云端存档。</small>
          </div>
          <div class="profile-cloud-actions">
            <button id="profile-sync" type="button">同步</button>
            <button id="profile-logout" type="button">退出</button>
          </div>
        </div>
        <div id="profile-password-box" class="profile-password" hidden>
          <div class="profile-password-head">
            <b>账号安全</b>
            <small>修改后下次登录使用新密码</small>
          </div>
          <div class="profile-password-fields">
            <input id="profile-current-pin" type="password" autocomplete="current-password" placeholder="当前密码">
            <input id="profile-new-pin" type="password" autocomplete="new-password" placeholder="新密码">
          </div>
          <button id="profile-change-password" type="button">修改密码</button>
        </div>
        <div id="profile-list" class="profile-list"></div>
        <label class="profile-field">
          <span>玩家名</span>
          <input id="profile-name" maxlength="12" autocomplete="username" placeholder="输入玩家名">
        </label>
        <label class="profile-field">
          <span>登录密码</span>
          <input id="profile-pin" maxlength="18" type="password" autocomplete="current-password" placeholder="输入本机密码">
        </label>
        <div id="profile-error" class="profile-error" hidden></div>
        <div class="profile-actions">
          <button id="profile-guest" class="profile-secondary" type="button">游客进入</button>
          <button id="profile-submit" class="profile-submit" type="submit">登录并进入</button>
        </div>
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
const gachaStoneCount = document.querySelector<HTMLElement>('#gacha-stone-count')!
const gachaPityCount = document.querySelector<HTMLElement>('#gacha-pity-count')!
const gachaPityBar = document.querySelector<HTMLElement>('#gacha-pity-bar')!
const lorePanel = document.querySelector<HTMLDivElement>('#lore-panel')!
const closeLore = document.querySelector<HTMLButtonElement>('#close-lore')!
const settlementPanel = document.querySelector<HTMLDivElement>('#settlement-panel')!
const settlementTitle = document.querySelector<HTMLHeadingElement>('#settlement-title')!
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
const artifactPageTitle = document.querySelector<HTMLElement>('#artifact-page-title')!
const artifactPageSubtitle = document.querySelector<HTMLElement>('#artifact-page-subtitle')!
const artifactDetailPanel = document.querySelector<HTMLElement>('#artifact-detail-panel')!
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
const mainQuestLabel = document.querySelector<HTMLDivElement>('#main-quest-label')!
const heroShowcaseImg = document.querySelector<HTMLImageElement>('#hero-showcase-img')!
const heroShowcaseLevel = document.querySelector<HTMLElement>('#hero-showcase-level')!
const heroShowcaseTitle = document.querySelector<HTMLElement>('#hero-showcase-title')!
const heroShowcaseGear = document.querySelector<HTMLElement>('#hero-showcase-gear')!
const profilePanel = document.querySelector<HTMLDivElement>('#profile-panel')!
const profileForm = document.querySelector<HTMLFormElement>('#profile-form')!
const closeProfile = document.querySelector<HTMLButtonElement>('#close-profile')!
const profileSwitch = document.querySelector<HTMLButtonElement>('#profile-switch')!
const profileCurrent = document.querySelector<HTMLElement>('#profile-current')!
const profileSlots = document.querySelector<HTMLDivElement>('#profile-slots')!
const profileSlotList = document.querySelector<HTMLDivElement>('#profile-slot-list')!
const profileCreateSlot = document.querySelector<HTMLDivElement>('#profile-create-slot')!
const profileCreateTitle = document.querySelector<HTMLElement>('#profile-create-title')!
const profileCreateCancel = document.querySelector<HTMLButtonElement>('#profile-create-cancel')!
const profileCharacterName = document.querySelector<HTMLInputElement>('#profile-character-name')!
const profileCharacterOptions = document.querySelector<HTMLDivElement>('#profile-character-options')!
const profileArtifactOptions = document.querySelector<HTMLDivElement>('#profile-artifact-options')!
const profileCreateConfirm = document.querySelector<HTMLButtonElement>('#profile-create-confirm')!
const profileCloudStatus = document.querySelector<HTMLElement>('#profile-cloud-status')!
const profileCloudDetail = document.querySelector<HTMLElement>('#profile-cloud-detail')!
const profileSync = document.querySelector<HTMLButtonElement>('#profile-sync')!
const profileLogout = document.querySelector<HTMLButtonElement>('#profile-logout')!
const profilePasswordBox = document.querySelector<HTMLDivElement>('#profile-password-box')!
const profileCurrentPin = document.querySelector<HTMLInputElement>('#profile-current-pin')!
const profileNewPin = document.querySelector<HTMLInputElement>('#profile-new-pin')!
const profileChangePassword = document.querySelector<HTMLButtonElement>('#profile-change-password')!
const profileList = document.querySelector<HTMLDivElement>('#profile-list')!
const profileNameInput = document.querySelector<HTMLInputElement>('#profile-name')!
const profilePinInput = document.querySelector<HTMLInputElement>('#profile-pin')!
const profileError = document.querySelector<HTMLDivElement>('#profile-error')!
const profileModeLogin = document.querySelector<HTMLButtonElement>('#profile-mode-login')!
const profileModeRegister = document.querySelector<HTMLButtonElement>('#profile-mode-register')!
const profileModeHint = document.querySelector<HTMLParagraphElement>('#profile-mode-hint')!
const profileAuthTitle = document.querySelector<HTMLHeadingElement>('#profile-auth-title')!
const profileSubmit = document.querySelector<HTMLButtonElement>('#profile-submit')!
const profileGuest = document.querySelector<HTMLButtonElement>('#profile-guest')!
const LEGACY_SAVE_KEY = 'void-trial-save-v1'
const PROFILE_INDEX_KEY = 'void-trial-profile-index-v1'
const PROFILE_SESSION_KEY = 'void-trial-profile-session-v1'
const PROFILE_SAVE_PREFIX = `${LEGACY_SAVE_KEY}:profile:`
const ACCOUNT_API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`
const DEFAULT_PROFILE_SLOT_ID: CharacterSlotId = 'slot-1'
const PROFILE_SLOT_IDS: CharacterSlotId[] = ['slot-1', 'slot-2', 'slot-3']
const PROFILE_SLOT_LABELS: Record<CharacterSlotId, string> = {
  'slot-1': '一号角色',
  'slot-2': '二号角色',
  'slot-3': '三号角色',
}
const CLOUD_SAVE_KIND = 'void-trial-cloud-slots'
const starterArtifactChoices: Record<CharacterId, ArtifactKey[]> = {
  sword: ['orbit', 'slash', 'needle'],
  thunder: ['chain', 'burst', 'seal'],
  flame: ['flame', 'burst', 'banner'],
  wood: ['regen', 'bell', 'mirror'],
}

const ASSET_VERSION = '20260607-webp-assets-v1'

function assetUrl(src: string) {
  if (/^(https?:|data:|blob:)/.test(src)) return src
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${src.replace(/^\/+/, '')}`
}

function versionedAsset(src: string) {
  const resolved = assetUrl(src)
  const separator = resolved.includes('?') ? '&' : '?'
  return `${resolved}${separator}v=${ASSET_VERSION}`
}

function loadSprite(src: string) {
  const image = new Image()
  image.src = versionedAsset(src)
  return image
}

const cultivatorAvatar = '/assets/generated/cultivator-hero.webp'

const sprites = {
  player: loadSprite('/assets/kenney-topdown/player.png'),
  zombie: loadSprite('/assets/kenney-topdown/zombie.png'),
  zombieElite: loadSprite('/assets/kenney-topdown/zombie_elite.png'),
  heroStand: loadSprite('/assets/kenney-topdown/hero_stand.png'),
  enemyStand: loadSprite('/assets/kenney-topdown/enemy_stand.png'),
  cultivator: loadSprite(cultivatorAvatar),
  worldBg: loadSprite('/assets/generated/bg-world-xianxia.webp'),
  dungeonBg: loadSprite('/assets/generated/bg-dungeon-xianxia.webp'),
}

const characterSprites: Record<CharacterId, HTMLImageElement> = {
  sword: loadSprite(characters.sword.battle),
  thunder: loadSprite(characters.thunder.battle),
  flame: loadSprite(characters.flame.battle),
  wood: loadSprite(characters.wood.battle),
}

const dungeonSprites: Record<DungeonId, HTMLImageElement> = {
  mossCave: loadSprite('/assets/generated/dungeon-moss-cave.webp'),
  starHall: loadSprite('/assets/generated/dungeon-star-hall.webp'),
  mistMaze: loadSprite('/assets/generated/dungeon-mist-maze.webp'),
  crystalMine: loadSprite('/assets/generated/dungeon-crystal-mine.webp'),
  bloodRift: loadSprite('/assets/generated/dungeon-blood-rift.webp'),
  kingTomb: loadSprite('/assets/generated/dungeon-king-tomb.webp'),
}

const worldSprites = stageThemes.map((theme) => loadSprite(theme.bg))

const swordActionSprites = {
  sheet: loadSprite('/assets/generated/action-sword-sheet-ai.webp'),
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

const worldMonsterSpritePaths = [
  '/assets/generated/monster-world-moss.webp',
  '/assets/generated/monster-world-star-outpost.webp',
  '/assets/generated/monster-world-mist-forest.webp',
  '/assets/generated/monster-world-crystal-mine.webp',
  '/assets/generated/monster-world-blood-rift.webp',
  '/assets/generated/monster-world-royal-ruins.webp',
  '/assets/generated/monster-world-star-sea.webp',
]
const worldMonsterSprites = worldMonsterSpritePaths.map(loadSprite)
type EnemySpriteMotion = 'ground' | 'flying' | 'heavy'
interface EnemySpriteLayout {
  width: number
  height: number
  lift: number
  barWidth: number
  barY: number
  motion?: EnemySpriteMotion
}
const worldMonsterVisuals: Array<Required<EnemySpriteLayout>> = [
  { width: 138, height: 164, lift: 0, barWidth: 86, barY: 146, motion: 'ground' },
  { width: 146, height: 142, lift: 4, barWidth: 88, barY: 126, motion: 'heavy' },
  { width: 168, height: 124, lift: 58, barWidth: 86, barY: 110, motion: 'flying' },
  { width: 178, height: 108, lift: 2, barWidth: 94, barY: 98, motion: 'heavy' },
  { width: 176, height: 106, lift: 2, barWidth: 94, barY: 98, motion: 'ground' },
  { width: 168, height: 126, lift: 2, barWidth: 96, barY: 114, motion: 'heavy' },
  { width: 190, height: 130, lift: 50, barWidth: 98, barY: 112, motion: 'flying' },
]

const vfxSprites = {
  swordWave: loadSprite('/assets/generated/vfx-sword-qi.webp'),
  impact: loadSprite('/assets/generated/vfx-impact-burst.png'),
  thunder: loadSprite('/assets/generated/vfx-thunder-seal.png'),
  lotus: loadSprite('/assets/generated/vfx-lotus-fire.png'),
  heal: loadSprite('/assets/generated/vfx-heal-aura.png'),
}

let input: Vec = { x: 0, y: 0 }
let last = performance.now()
let lastAutoSave = performance.now()
let enemyId = 1
let enemySkillId = 1
let soulId = 1
let pulling = false
let heroFacing = -Math.PI / 2
let lastAttackFlash = 0
let autoWorldWalk = 0
let autoSkillCastGap = 0
let lastFrameWorkMs = 0
let moveTarget: Vec | null = null
let moveTargetPulse = 0
let lastMoveTargetSetAt = 0
let dragMovePointer: number | null = null
let selectedArtifactKey: ArtifactKey = 'slash'
let activePage: AppPage = 'battle'
let activeProfile: PlayerProfile | null = null
let profileAuthMode: ProfileAuthMode = 'login'
let cloudAccountActive = false
let cloudSyncState: 'idle' | 'syncing' | 'error' = 'idle'
let cloudSyncMessage = ''
let lastCloudSyncAt = 0
let cloudSaveTimer: number | null = null
let cloudSaveInFlight = false
let pendingCloudSave: SaveData | null = null
let creatingSlotId: CharacterSlotId | null = null
let creatingCharacterId: CharacterId = 'sword'
let creatingArtifactKey: ArtifactKey = 'orbit'
let settlementAutoCloseTimer: number | null = null
let audioCtx: AudioContext | null = null
let audioMaster: GainNode | null = null
let audioMusic: GainNode | null = null
let audioUnlocked = false
let musicStarted = false
let musicStep = 0
let worldStageTransition: { from: number; to: number; life: number; maxLife: number } | null = null
const soundLast: Record<string, number> = {}

function unlockAudio() {
  const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return
  if (!audioCtx) {
    audioCtx = new AudioCtor()
    audioMaster = audioCtx.createGain()
    audioMaster.gain.value = 0.36
    audioMaster.connect(audioCtx.destination)
    audioMusic = audioCtx.createGain()
    audioMusic.gain.value = 0.22
    audioMusic.connect(audioMaster)
  }
  audioUnlocked = true
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().then(startBackgroundMusic)
  } else {
    startBackgroundMusic()
  }
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

function musicPluck(freq: number, delay: number, volume = 0.035, duration = 1.6) {
  if (!soundReady() || !audioCtx || !audioMusic) return
  const start = audioCtx.currentTime + delay
  const osc = audioCtx.createOscillator()
  const overtone = audioCtx.createOscillator()
  const filter = audioCtx.createBiquadFilter()
  const gain = audioCtx.createGain()
  osc.type = 'triangle'
  overtone.type = 'sine'
  osc.frequency.setValueAtTime(freq, start)
  overtone.frequency.setValueAtTime(freq * 2.01, start)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1900, start)
  filter.frequency.exponentialRampToValueAtTime(580, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.018)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(filter)
  overtone.connect(filter)
  filter.connect(gain)
  gain.connect(audioMusic)
  osc.start(start)
  overtone.start(start)
  osc.stop(start + duration + 0.05)
  overtone.stop(start + duration + 0.05)
}

function musicBell(freq: number, delay: number, volume = 0.026) {
  if (!soundReady() || !audioCtx || !audioMusic) return
  const start = audioCtx.currentTime + delay
  ;[1, 2.01, 2.98].forEach((mul, index) => {
    const osc = audioCtx!.createOscillator()
    const gain = audioCtx!.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * mul, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume / (index + 1), start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.4 + index * 0.32)
    osc.connect(gain)
    gain.connect(audioMusic!)
    osc.start(start)
    osc.stop(start + 2.8 + index * 0.32)
  })
}

function startBackgroundMusic() {
  if (!soundReady() || !audioCtx || !audioMusic || musicStarted) return
  musicStarted = true
  const windLength = Math.floor(audioCtx.sampleRate * 3.2)
  const windBuffer = audioCtx.createBuffer(1, windLength, audioCtx.sampleRate)
  const windData = windBuffer.getChannelData(0)
  for (let i = 0; i < windLength; i += 1) {
    const breath = Math.sin((i / windLength) * Math.PI * 2)
    windData[i] = (Math.random() * 2 - 1) * (0.18 + breath * 0.08)
  }
  const wind = audioCtx.createBufferSource()
  const windFilter = audioCtx.createBiquadFilter()
  const windGain = audioCtx.createGain()
  wind.buffer = windBuffer
  wind.loop = true
  windFilter.type = 'lowpass'
  windFilter.frequency.value = 760
  windGain.gain.value = 0.018
  wind.connect(windFilter)
  windFilter.connect(windGain)
  windGain.connect(audioMusic)
  wind.start()
  const root = audioCtx.createOscillator()
  const fifth = audioCtx.createOscillator()
  const droneGain = audioCtx.createGain()
  root.type = 'sine'
  fifth.type = 'sine'
  root.frequency.value = 110
  fifth.frequency.value = 165
  droneGain.gain.value = 0.012
  root.connect(droneGain)
  fifth.connect(droneGain)
  droneGain.connect(audioMusic)
  root.start()
  fifth.start()
  scheduleBackgroundPhrase()
  window.setInterval(scheduleBackgroundPhrase, 4200)
}

function scheduleBackgroundPhrase() {
  if (!soundReady()) return
  const phrases = [
    [220, 247, 294, 330, 294],
    [196, 220, 294, 247, 220],
    [247, 294, 392, 330, 294],
    [220, 330, 294, 247, 196],
  ]
  const phrase = phrases[musicStep % phrases.length]
  musicStep += 1
  phrase.forEach((freq, index) => musicPluck(freq, 0.18 + index * 0.54, 0.026, 1.7))
  if (musicStep % 2 === 0) musicBell(392, 2.95, 0.018)
}

const sfx = {
  slash(strong = false) {
    if (!canPlaySound(strong ? 'slash-strong' : 'slash', strong ? 120 : 72)) return
    tone(strong ? 620 : 520, strong ? 0.18 : 0.11, 'triangle', strong ? 0.058 : 0.036, strong ? 1320 : 980)
    tone(strong ? 1240 : 1040, strong ? 0.12 : 0.08, 'sine', strong ? 0.04 : 0.026, strong ? 680 : 620, 0.012)
    noiseBurst(strong ? 0.11 : 0.062, strong ? 0.034 : 0.019, strong ? 3200 : 2600)
  },
  hit(power = 1, killed = false) {
    if (!canPlaySound(killed ? 'kill' : 'hit', killed ? 80 : 45)) return
    tone(killed ? 98 : 150 + power * 18, killed ? 0.18 : 0.07, 'triangle', killed ? 0.052 : 0.026, killed ? 46 : 82)
    noiseBurst(killed ? 0.13 : 0.052, killed ? 0.045 : 0.018, killed ? 640 : 960)
    if (killed) tone(330, 0.16, 'sine', 0.026, 660, 0.035)
  },
  thunder() {
    if (!canPlaySound('thunder', 180)) return
    tone(74, 0.32, 'sine', 0.052, 42)
    noiseBurst(0.22, 0.052, 2600, 0.018)
    tone(1320, 0.08, 'square', 0.028, 520, 0.028)
    tone(1960, 0.06, 'triangle', 0.022, 880, 0.07)
  },
  flame() {
    if (!canPlaySound('flame', 220)) return
    noiseBurst(0.24, 0.04, 760)
    tone(196, 0.24, 'triangle', 0.035, 88)
    tone(660, 0.18, 'sine', 0.024, 990, 0.04)
    tone(880, 0.12, 'triangle', 0.018, 540, 0.09)
  },
  orbit() {
    if (!canPlaySound('orbit', 180)) return
    ;[392, 494, 587, 784].forEach((freq, i) => tone(freq, 0.12, 'sine', 0.022, freq * 1.22, i * 0.032))
    noiseBurst(0.08, 0.016, 3600, 0.02)
  },
  heal() {
    if (!canPlaySound('heal', 1200)) return
    tone(330, 0.2, 'sine', 0.02, 494)
    tone(494, 0.24, 'triangle', 0.018, 740, 0.07)
    tone(880, 0.28, 'sine', 0.014, 1320, 0.16)
  },
  soul(count = 1) {
    if (!canPlaySound('soul', 110)) return
    tone(660 + count * 22, 0.11, 'sine', 0.022, 990 + count * 28)
    tone(990 + count * 18, 0.15, 'triangle', 0.014, 1480, 0.045)
  },
  level() {
    if (!canPlaySound('level', 650)) return
    ;[294, 330, 392, 494, 587, 784].forEach((freq, i) => tone(freq, 0.22, 'sine', 0.026, freq * 1.5, i * 0.06))
    noiseBurst(0.18, 0.018, 4200, 0.14)
  },
  gacha(rank = 1) {
    if (!canPlaySound(`gacha-${rank}`, 110)) return
    const base = 247 + rank * 55
    tone(base, 0.18, 'triangle', 0.024 + rank * 0.006, base * 1.8)
    tone(base * 2, 0.32, 'sine', 0.018 + rank * 0.005, base * 2.8, 0.052)
    if (rank >= 3) musicBell(392 + rank * 42, 0.04, 0.028)
  },
}

function flashScreen(color: string, strength = 0.14, life = 0.16) {
  const current = state.screenFlash
  if (current && current.life / current.maxLife > strength) return
  state.screenFlash = { color, strength, life, maxLife: life }
}

function addParticleBurst(x: number, y: number, color: string, count: number, power = 1, kind: ParticleKind = 'spark') {
  if (state.particles.length > 190) state.particles.splice(0, state.particles.length - 160)
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
  if (state.particles.length > 190) state.particles.splice(0, state.particles.length - 160)
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

function safeSlotId(value: unknown): CharacterSlotId {
  return PROFILE_SLOT_IDS.includes(value as CharacterSlotId) ? value as CharacterSlotId : DEFAULT_PROFILE_SLOT_ID
}

function legacyProfileSaveKey(profileId: string) {
  return `${PROFILE_SAVE_PREFIX}${profileId}`
}

function activeSlotIdForProfile(profileId = activeProfile?.id) {
  if (activeProfile && activeProfile.id === profileId) return safeSlotId(activeProfile.activeSlotId)
  if (!profileId) return DEFAULT_PROFILE_SLOT_ID
  const profile = readProfileIndex().profiles.find((item) => item.id === profileId)
  return safeSlotId(profile?.activeSlotId)
}

function profileSaveKey(profileId = activeProfile?.id, slotId?: CharacterSlotId) {
  if (!profileId) return LEGACY_SAVE_KEY
  return `${PROFILE_SAVE_PREFIX}${profileId}:${slotId ?? activeSlotIdForProfile(profileId)}`
}

function migrateProfileSaveToSlot(profileId: string) {
  const legacy = localStorage.getItem(legacyProfileSaveKey(profileId))
  const firstSlotKey = profileSaveKey(profileId, DEFAULT_PROFILE_SLOT_ID)
  if (legacy && !localStorage.getItem(firstSlotKey)) {
    localStorage.setItem(firstSlotKey, legacy)
  }
}

function normalizeProfileName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 12)
}

function normalizeCharacterName(name: string) {
  return name.trim().replace(/\s+/g, '').slice(0, 10)
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
          activeSlotId: safeSlotId(profile.activeSlotId),
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
  return { id, name, pin: pin.trim(), createdAt: now, lastLoginAt: now, activeSlotId: DEFAULT_PROFILE_SLOT_ID }
}

function profileSummary(profileId: string, slotId = activeSlotIdForProfile(profileId)) {
  migrateProfileSaveToSlot(profileId)
  const raw = localStorage.getItem(profileSaveKey(profileId, slotId))
  if (!raw) return { level: 1, tickets: 0, spiritStones: 0, savedAt: 0, activeCharacter: 'sword' as CharacterId, characterName: '', empty: true }
  try {
    const save = JSON.parse(raw) as Partial<SaveData>
    return {
      level: save.hero?.level ?? save.soulLevel ?? 1,
      tickets: save.tickets ?? 0,
      spiritStones: save.spiritStones ?? 0,
      savedAt: save.savedAt ?? 0,
      activeCharacter: save.activeCharacter ?? 'sword' as CharacterId,
      characterName: normalizeCharacterName(save.characterName ?? ''),
      empty: false,
    }
  } catch {
    return { level: 1, tickets: 0, spiritStones: 0, savedAt: 0, activeCharacter: 'sword' as CharacterId, characterName: '', empty: true }
  }
}

function serverProfileId(user: ServerUser) {
  return `server:${user.id}`
}

function isServerProfile(profileId = activeProfile?.id) {
  return Boolean(profileId?.startsWith('server:'))
}

function upsertServerProfile(user: ServerUser) {
  const index = readProfileIndex()
  const id = serverProfileId(user)
  let profile = index.profiles.find((item) => item.id === id)
  if (!profile) {
    profile = createProfile(user.username, '')
    profile.id = id
    index.profiles.push(profile)
  }
  profile.name = normalizeProfileName(user.username) || '云端玩家'
  profile.pin = ''
  profile.lastLoginAt = Date.now()
  index.activeId = profile.id
  writeProfileIndex(index)
  return profile
}

async function accountRequest<T>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.json !== undefined) headers.set('content-type', 'application/json')
  let response: Response
  try {
    response = await fetch(`${ACCOUNT_API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
      headers,
      body: options.json === undefined ? options.body : JSON.stringify(options.json),
    })
  } catch {
    const error = new Error('服务器暂不可用，已切换本机档案模式。')
    ;(error as Error & { code?: string }).code = 'API_UNAVAILABLE'
    throw error
  }
  const contentType = response.headers.get('content-type') ?? ''
  const jsonResponse = contentType.includes('application/json')
  const body = jsonResponse ? await response.json() : null
  if (!response.ok) {
    if (!jsonResponse) {
      const error = new Error('服务器暂不可用，已切换本机档案模式。')
      ;(error as Error & { code?: string }).code = 'API_UNAVAILABLE'
      throw error
    }
    const message = body?.error?.message ?? '服务器暂不可用，已切换本机档案模式。'
    const error = new Error(message)
    ;(error as Error & { code?: string }).code = body?.error?.code ?? 'API_ERROR'
    throw error
  }
  return body as T
}

function apiUnavailable(error: unknown) {
  return (error as Error & { code?: string })?.code === 'API_UNAVAILABLE'
}

function isCloudSaveEnvelope(save: unknown): save is CloudSaveEnvelope {
  return Boolean(
    save
    && typeof save === 'object'
    && (save as CloudSaveEnvelope).kind === CLOUD_SAVE_KIND
    && Array.isArray((save as CloudSaveEnvelope).slots),
  )
}

function readProfileSlotSave(profileId: string, slotId: CharacterSlotId) {
  const raw = localStorage.getItem(profileSaveKey(profileId, slotId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SaveData
  } catch {
    return null
  }
}

function profileSlotHasSave(profileId: string, slotId: CharacterSlotId) {
  migrateProfileSaveToSlot(profileId)
  return Boolean(localStorage.getItem(profileSaveKey(profileId, slotId)))
}

function readActiveProfileSave() {
  if (!activeProfile) return null
  return readProfileSlotSave(activeProfile.id, safeSlotId(activeProfile.activeSlotId))
}

function clearQueuedCloudSave() {
  if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer)
  cloudSaveTimer = null
  pendingCloudSave = null
}

function cloudSyncTimeText() {
  if (!lastCloudSyncAt) return '尚未同步'
  return new Date(lastCloudSyncAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function cloudSaveUpdatedAt(save: SaveData | CloudSaveEnvelope | null) {
  if (!save) return 0
  if (isCloudSaveEnvelope(save)) {
    return Math.max(0, ...save.slots.map((slot) => Number(slot.updatedAt) || Number(slot.save?.savedAt) || 0))
  }
  return Number(save.savedAt) || 0
}

function updateCloudStatus() {
  const isCloud = cloudAccountActive && isServerProfile()
  if (cloudSyncState === 'syncing') {
    profileCloudStatus.textContent = '正在同步云端'
    profileCloudDetail.textContent = '当前存档正在写入服务器。'
  } else if (cloudSyncState === 'error') {
    profileCloudStatus.textContent = '云端同步失败'
    profileCloudDetail.textContent = cloudSyncMessage || '本机存档仍会保留，稍后可手动同步。'
  } else if (isCloud) {
    profileCloudStatus.textContent = '云端账号已连接'
    profileCloudDetail.textContent = `${activeProfile?.name ?? '玩家'} | 上次同步 ${cloudSyncTimeText()}`
  } else if (activeProfile) {
    profileCloudStatus.textContent = '本机档案'
    profileCloudDetail.textContent = '当前资料保存在本机，登录服务器账号后可云端保存。'
  } else {
    profileCloudStatus.textContent = '未登录'
    profileCloudDetail.textContent = '登录、注册或游客进入后开始保存资料。'
  }
  profileSync.disabled = !isCloud || cloudSyncState === 'syncing'
  profileLogout.disabled = !activeProfile || cloudSyncState === 'syncing'
  profileLogout.textContent = isCloud ? '退出登录' : '退出档案'
  profilePasswordBox.hidden = !isCloud
  profileCurrentPin.disabled = !isCloud || cloudSyncState === 'syncing'
  profileNewPin.disabled = !isCloud || cloudSyncState === 'syncing'
  profileChangePassword.disabled = !isCloud || cloudSyncState === 'syncing'
}

async function syncCloudSaveNow(save = readActiveProfileSave()) {
  if (!cloudAccountActive || !isServerProfile()) throw new Error('当前不是云端账号。')
  if (!save) throw new Error('还没有可同步的存档。')
  cloudSyncState = 'syncing'
  cloudSyncMessage = ''
  updateCloudStatus()
  await accountRequest<{ ok: boolean }>('/save', { method: 'PUT', json: { save: buildCloudSaveEnvelope(save) } })
  lastCloudSyncAt = Date.now()
  cloudSyncState = 'idle'
  cloudSyncMessage = ''
  updateCloudStatus()
}

function applyRemoteCloudSave(profile: PlayerProfile, remoteSave: SaveData | CloudSaveEnvelope | null) {
  if (!remoteSave) {
    migrateProfileSaveToSlot(profile.id)
    return
  }
  const index = readProfileIndex()
  const target = index.profiles.find((item) => item.id === profile.id)
  if (!target) return
  if (isCloudSaveEnvelope(remoteSave)) {
    remoteSave.slots.forEach((slot) => {
      const slotId = safeSlotId(slot.id)
      if (slot.save) localStorage.setItem(profileSaveKey(profile.id, slotId), JSON.stringify(slot.save))
    })
    target.activeSlotId = safeSlotId(remoteSave.activeSlotId)
  } else {
    localStorage.setItem(profileSaveKey(profile.id, DEFAULT_PROFILE_SLOT_ID), JSON.stringify(remoteSave))
    target.activeSlotId = DEFAULT_PROFILE_SLOT_ID
  }
  writeProfileIndex(index)
}

function buildCloudSaveEnvelope(currentSlotSave: SaveData): CloudSaveEnvelope {
  const profileId = activeProfile?.id
  const activeSlotId = safeSlotId(activeProfile?.activeSlotId)
  const slots = PROFILE_SLOT_IDS.map((slotId) => {
    const save = profileId
      ? slotId === activeSlotId
        ? currentSlotSave
        : readProfileSlotSave(profileId, slotId)
      : null
    return {
      id: slotId,
      label: PROFILE_SLOT_LABELS[slotId],
      updatedAt: Number(save?.savedAt) || 0,
      save,
    }
  })
  return { kind: CLOUD_SAVE_KIND, version: 2, activeSlotId, slots }
}

async function changeCloudPassword() {
  if (!(cloudAccountActive && isServerProfile())) {
    setProfileError('本机档案没有服务器密码。')
    return
  }
  const currentPassword = profileCurrentPin.value.trim()
  const newPassword = profileNewPin.value.trim()
  if (currentPassword.length < 4) {
    setProfileError('先输入当前密码。')
    profileCurrentPin.focus()
    return
  }
  if (newPassword.length < 4) {
    setProfileError('新密码至少 4 位。')
    profileNewPin.focus()
    return
  }
  if (currentPassword === newPassword) {
    setProfileError('新密码不能和当前密码一样。')
    profileNewPin.focus()
    return
  }
  setProfileBusy(true)
  setProfileError('')
  try {
    await accountRequest<{ ok: boolean }>('/password', { method: 'PUT', json: { currentPassword, newPassword } })
    profileCurrentPin.value = ''
    profileNewPin.value = ''
    toast('账号密码已更新。')
    setProfileError('密码已修改，下次登录请使用新密码。')
  } catch (error) {
    setProfileError((error as Error).message)
  } finally {
    setProfileBusy(false)
    updateCloudStatus()
  }
}

async function activateServerUser(user: ServerUser) {
  const profile = upsertServerProfile(user)
  const remote = await accountRequest<{ save: SaveData | CloudSaveEnvelope | null }>('/save')
  applyRemoteCloudSave(profile, remote.save)
  activateProfile(profile.id, { cloud: true })
  lastCloudSyncAt = cloudSaveUpdatedAt(remote.save) || Date.now()
  updateCloudStatus()
}

async function restoreServerSession() {
  try {
    const result = await accountRequest<{ user: ServerUser }>('/me')
    await activateServerUser(result.user)
  } catch {
    // 本地开发或未登录时保持本机档案入口。
  }
}

function queueCloudSave(save: SaveData) {
  if (!cloudAccountActive || !isServerProfile()) return
  pendingCloudSave = JSON.parse(JSON.stringify(save)) as SaveData
  if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer)
  cloudSaveTimer = window.setTimeout(pushCloudSave, 900)
}

async function pushCloudSave() {
  if (cloudSaveInFlight || !pendingCloudSave) return
  cloudSaveInFlight = true
  const save = pendingCloudSave
  pendingCloudSave = null
  try {
    await syncCloudSaveNow(save)
  } catch (error) {
    pendingCloudSave = save
    cloudSyncState = 'error'
    cloudSyncMessage = (error as Error).message
    updateCloudStatus()
    console.warn('cloud save failed', error)
  } finally {
    cloudSaveInFlight = false
    updateCloudStatus()
  }
}

function setProfileError(message: string) {
  profileError.hidden = !message
  profileError.textContent = message
}

function setProfileBusy(busy: boolean) {
  profileSubmit.disabled = busy
  profileGuest.disabled = busy
  profileModeLogin.disabled = busy
  profileModeRegister.disabled = busy
  profileSync.disabled = busy || !(cloudAccountActive && isServerProfile())
  profileLogout.disabled = busy || !activeProfile
  profileCurrentPin.disabled = busy || !(cloudAccountActive && isServerProfile())
  profileNewPin.disabled = busy || !(cloudAccountActive && isServerProfile())
  profileChangePassword.disabled = busy || !(cloudAccountActive && isServerProfile())
  profileCharacterName.disabled = busy
  profileCreateConfirm.disabled = busy || !creatingSlotId
  profileCreateCancel.disabled = busy
}

function setProfileAuthMode(mode: ProfileAuthMode) {
  profileAuthMode = mode
  profileForm.dataset.mode = mode
  profileModeLogin.classList.toggle('active', mode === 'login')
  profileModeRegister.classList.toggle('active', mode === 'register')
  profilePinInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password'
  profileAuthTitle.textContent = mode === 'login' ? '登录档案' : '创建档案'
  profileSubmit.textContent = mode === 'login' ? '登录并进入' : '注册并进入'
  profileModeHint.textContent = mode === 'login'
    ? '连接服务器账号，读取云端角色资料；服务器不可用时会退回本机档案。'
    : '创建服务器账号并开启云端存档；离线开发时会创建本机档案。'
  setProfileError('')
}

function updateProfileUi() {
  profileCurrent.textContent = activeProfile ? `${cloudAccountActive ? '云端在线' : '本机在线'}：${activeProfile.name}` : '等待玩家登录'
  profileSwitch.disabled = !activeProfile
  closeProfile.hidden = !activeProfile || profilePanel.classList.contains('blocking')
  profileList.innerHTML = ''
  updateCloudStatus()
  renderProfileSlots()
  const index = readProfileIndex()
  if (!index.profiles.length) {
    const empty = document.createElement('div')
    empty.className = 'profile-empty'
    empty.textContent = '还没有本机账号，切到注册后创建第一份档案。'
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
      detail.textContent = `${PROFILE_SLOT_LABELS[safeSlotId(profile.activeSlotId)]} | ${cultivationRealm(summary.level)} | 券 ${summary.tickets} | 灵石 ${summary.spiritStones}${profile.pin ? ' | 有口令' : ''}`
      row.append(mark, meta, detail)
      row.addEventListener('click', () => {
        setProfileAuthMode('login')
        profileNameInput.value = profile.name
        profilePinInput.value = ''
        if (profile.pin) {
          profilePinInput.focus()
          setProfileError('这个玩家设置了本机口令，输入后进入。')
          return
        }
        activateProfile(profile.id)
      })
      profileList.append(row)
    })
}

function renderProfileSlots() {
  profileSlots.hidden = !activeProfile
  profileSlotList.innerHTML = ''
  if (!activeProfile) return
  migrateProfileSaveToSlot(activeProfile.id)
  PROFILE_SLOT_IDS.forEach((slotId) => {
    const summary = profileSummary(activeProfile!.id, slotId)
    const row = document.createElement('button')
    row.type = 'button'
    row.className = `profile-slot-row ${activeProfile!.activeSlotId === slotId ? 'active' : ''} ${summary.empty ? 'empty' : ''}`
    row.disabled = cloudSyncState === 'syncing'
    const mark = document.createElement('i')
    mark.textContent = slotId.slice(-1)
    const meta = document.createElement('span')
    meta.textContent = summary.empty
      ? `${PROFILE_SLOT_LABELS[slotId]} · 空`
      : `${PROFILE_SLOT_LABELS[slotId]} · ${summary.characterName || characters[summary.activeCharacter]?.name || '青岚剑修'}`
    const detail = document.createElement('small')
    detail.textContent = summary.empty
      ? '点击创建新角色进度'
      : `${characters[summary.activeCharacter]?.name ?? '青岚剑修'} | ${cultivationRealm(summary.level)} | 券 ${summary.tickets}`
    row.append(mark, meta, detail)
    row.addEventListener('click', () => {
      if (summary.empty) openCharacterCreator(slotId)
      else switchProfileSlot(slotId)
    })
    profileSlotList.append(row)
  })
}

function openCharacterCreator(slotId: CharacterSlotId) {
  if (!activeProfile) return
  creatingSlotId = slotId
  creatingCharacterId = 'sword'
  creatingArtifactKey = starterArtifactChoices.sword[0]
  profileCreateSlot.hidden = false
  profileCreateTitle.textContent = `创建${PROFILE_SLOT_LABELS[slotId]}`
  profileCharacterName.value = `${activeProfile.name}${slotId.slice(-1)}`
  renderCharacterCreator()
  profileCharacterName.focus()
}

function closeCharacterCreator() {
  creatingSlotId = null
  profileCreateSlot.hidden = true
  profileCharacterName.value = ''
}

function renderCharacterCreator() {
  profileCharacterOptions.innerHTML = ''
  ;(Object.values(characters) as CharacterDef[]).forEach((character) => {
    const option = document.createElement('button')
    option.type = 'button'
    option.className = `profile-choice ${creatingCharacterId === character.id ? 'active' : ''}`
    option.style.setProperty('--choice-color', character.color)
    option.innerHTML = `
      <img src="${versionedAsset(character.portrait)}" alt="">
      <span>${character.name}</span>
      <small>${character.innateSkill}</small>
    `
    option.addEventListener('click', () => {
      creatingCharacterId = character.id
      creatingArtifactKey = starterArtifactChoices[character.id][0]
      renderCharacterCreator()
    })
    profileCharacterOptions.append(option)
  })

  profileArtifactOptions.innerHTML = ''
  starterArtifactChoices[creatingCharacterId].forEach((key) => {
    const artifact = artifactDefs[key]
    const option = document.createElement('button')
    option.type = 'button'
    option.className = `profile-choice artifact ${creatingArtifactKey === key ? 'active' : ''}`
    option.style.setProperty('--choice-color', artifact.color)
    option.innerHTML = `
      <img src="${versionedAsset(artifact.image)}" alt="">
      <span>${artifact.name}</span>
      <small>${artifact.type}</small>
    `
    option.addEventListener('click', () => {
      creatingArtifactKey = key
      renderCharacterCreator()
    })
    profileArtifactOptions.append(option)
  })
}

function createCharacterSlotSave(characterId: CharacterId, artifactKey: ArtifactKey, characterName: string): SaveData {
  const artifacts = { ...baseArtifacts, [artifactKey]: 1 }
  const skills = { slash: 0, burst: 0, regen: 0, chain: 0, orbit: 0, flame: 0, bell: 0, needle: 0, mirror: 0, fan: 0, banner: 0, seal: 0, points: 0 }
  artifactKeys.forEach((key) => { skills[key] = artifacts[key] })
  return {
    hero: { x: 0, y: 0, hp: baseHeroStats.hp, baseHp: baseHeroStats.hp, level: 1, exp: 0, baseAtk: baseHeroStats.atk, skillPower: baseHeroStats.mana },
    gear: { weapon: null, armor: null, core: null },
    skills,
    artifacts,
    mutations: { ...baseMutations },
    techniques: { ...baseTechniques },
    activeDungeon: 'mossCave',
    kills: 0,
    tickets: 0,
    spiritStones: 0,
    dungeonEntries: 3,
    pity: 0,
    wave: 1,
    worldStage: 1,
    worldStageKills: 0,
    questClaimed: false,
    mainQuestIndex: 0,
    lastDaily: '',
    bag: [],
    guideStep: 0,
    soulLevel: 1,
    soulExp: 0,
    autoHaste: 0,
    autoExplore: true,
    activeCharacter: characterId,
    ownedCharacters: characterId === 'sword' ? ['sword'] : ['sword', characterId],
    characterShards: { ...baseCharacterShards },
    characterName,
    savedAt: Date.now(),
  }
}

function confirmCreateCharacterSlot() {
  if (!activeProfile || !creatingSlotId) return
  const characterName = normalizeCharacterName(profileCharacterName.value)
  if (!characterName) {
    setProfileError('先给角色起个名字。')
    profileCharacterName.focus()
    return
  }
  if (readProfileSlotSave(activeProfile.id, creatingSlotId)) {
    setProfileError('这个槽位已经有角色了。')
    closeCharacterCreator()
    updateProfileUi()
    return
  }
  saveGame()
  localStorage.setItem(profileSaveKey(activeProfile.id, creatingSlotId), JSON.stringify(createCharacterSlotSave(creatingCharacterId, creatingArtifactKey, characterName)))
  const createdSlotId = creatingSlotId
  closeCharacterCreator()
  switchProfileSlot(createdSlotId, true)
  profilePanel.hidden = true
  profilePanel.classList.remove('blocking')
  toast(`角色创建完成：${characterName}。`)
}

function switchProfileSlot(slotId: CharacterSlotId, forceReload = false) {
  if (!activeProfile) return
  const nextSlotId = safeSlotId(slotId)
  if (activeProfile.activeSlotId === nextSlotId && !forceReload) return
  if (!profileSlotHasSave(activeProfile.id, nextSlotId)) {
    openCharacterCreator(nextSlotId)
    return
  }
  if (!(forceReload && activeProfile.activeSlotId === nextSlotId) && profileSlotHasSave(activeProfile.id, safeSlotId(activeProfile.activeSlotId))) saveGame()
  const index = readProfileIndex()
  const profile = index.profiles.find((item) => item.id === activeProfile?.id)
  if (!profile) return
  profile.activeSlotId = nextSlotId
  profile.lastLoginAt = Date.now()
  index.activeId = profile.id
  writeProfileIndex(index)
  activeProfile = profile
  resetRuntimeState()
  loadGame()
  ensureEnemies()
  saveGame()
  toast(`已切换到${PROFILE_SLOT_LABELS[nextSlotId]}。`)
  updateProfileUi()
  updateHud()
  updateGuide()
}

function showProfilePanel(blocking = false, mode?: ProfileAuthMode) {
  const index = readProfileIndex()
  setProfileAuthMode(mode ?? (index.profiles.length ? 'login' : 'register'))
  profilePanel.hidden = false
  profilePanel.classList.toggle('blocking', blocking || !activeProfile)
  profilePanel.classList.toggle('signed-in', Boolean(activeProfile))
  setProfileError('')
  updateProfileUi()
  const remembered = index.profiles.find((profile) => profile.id === index.activeId) ?? index.profiles[0]
  if (!activeProfile && remembered && !profileNameInput.value) profileNameInput.value = remembered.name
  setTimeout(() => profileNameInput.focus(), 0)
}

async function logoutProfile() {
  if (!activeProfile) return
  setProfileBusy(true)
  setProfileError('')
  const wasCloud = cloudAccountActive && isServerProfile()
  try {
    saveGame()
    if (wasCloud) {
      const save = readActiveProfileSave()
      clearQueuedCloudSave()
      await syncCloudSaveNow(save)
      await accountRequest<{ ok: boolean }>('/logout', { method: 'POST' })
    }
  } catch (error) {
    cloudSyncState = wasCloud ? 'error' : cloudSyncState
    cloudSyncMessage = (error as Error).message
    setProfileError(wasCloud ? `退出前同步失败：${cloudSyncMessage}` : cloudSyncMessage)
    setProfileBusy(false)
    updateCloudStatus()
    return
  }
  clearQueuedCloudSave()
  cloudAccountActive = false
  cloudSaveInFlight = false
  cloudSyncState = 'idle'
  cloudSyncMessage = ''
  lastCloudSyncAt = 0
  activeProfile = null
  sessionStorage.removeItem(PROFILE_SESSION_KEY)
  setProfileBusy(false)
  showProfilePanel(true, 'login')
  toast(wasCloud ? '已退出云端账号。' : '已退出本机档案。')
  updateHud()
}

function resetRuntimeState() {
  state.mode = 'wild'
  Object.assign(state.hero, { x: 0, y: 0, hp: baseHeroStats.hp, baseHp: baseHeroStats.hp, level: 1, exp: 0, baseAtk: baseHeroStats.atk, skillPower: baseHeroStats.mana })
  state.gear = { weapon: null, armor: null, core: null }
  state.skills = { slash: 0, burst: 0, regen: 0, chain: 0, orbit: 0, flame: 0, bell: 0, needle: 0, mirror: 0, fan: 0, banner: 0, seal: 0, points: 0 }
  state.artifacts = { ...baseArtifacts }
  state.mutations = { ...baseMutations }
  state.techniques = { ...baseTechniques }
  state.activeDungeon = 'mossCave'
  state.characterName = ''
  state.activeCharacter = 'sword'
  state.ownedCharacters = ['sword']
  state.characterShards = { ...baseCharacterShards }
  state.enemies = []
  state.enemySkills = []
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
  state.spiritStones = 0
  state.dungeonEntries = 3
  state.pity = 0
  state.wave = 1
  state.worldStage = 1
  state.worldStageKills = 0
  state.skillCd = 0
  state.chainCd = 0
  state.orbitCd = 0
  state.flameCd = 0
  state.characterSkillCd = 0
  state.attackCd = 0
  state.dungeonTime = 0
  state.dungeonGoal = 12
  state.dungeonStartKills = 0
  state.dungeonFloorStartKills = 0
  state.dungeonExtractX = 0
  state.dungeonExtractY = 0
  state.dungeonLootTickets = 0
  state.dungeonLootExp = 0
  state.dungeonLootSkill = 0
  state.dungeonLootStones = 0
  state.dungeonHerbs = 0
  state.dungeonOres = 0
  state.dungeonChests = 0
  state.dungeonMaterials = 0
  state.dungeonMaterialGoal = 3
  state.dungeonFloor = 1
  state.dungeonMaxFloors = 3
  state.dungeonGateFound = false
  state.bossSpawned = false
  state.lastSettlement = ''
  state.questTarget = 15
  state.questClaimed = false
  state.mainQuestIndex = 0
  state.lastDaily = ''
  state.guideStep = 0
  state.soulExp = 0
  state.autoHaste = 0
  state.autoExplore = true
  state.message = '意识已接入《虚境试炼》，灵契行者将自动沿世界线推进。'
  input = { x: 0, y: 0 }
  moveTarget = null
  moveTargetPulse = 0
  dragMovePointer = null
  selectedArtifactKey = 'slash'
  autoWorldWalk = 0
  worldStageTransition = null
  last = performance.now()
  showPage('battle')
}

function activateProfile(profileId: string, options: { cloud?: boolean } = {}) {
  const index = readProfileIndex()
  const profile = index.profiles.find((item) => item.id === profileId)
  if (!profile) {
    showProfilePanel(true)
    setProfileError('没有找到这个玩家档案。')
    return
  }
  cloudAccountActive = Boolean(options.cloud && isServerProfile(profile.id))
  cloudSyncState = 'idle'
  cloudSyncMessage = ''
  if (!cloudAccountActive) lastCloudSyncAt = 0
  profile.lastLoginAt = Date.now()
  index.activeId = profile.id
  writeProfileIndex(index)
  activeProfile = profile
  sessionStorage.setItem(PROFILE_SESSION_KEY, profile.id)
  resetRuntimeState()
  const activeSlotId = safeSlotId(profile.activeSlotId)
  if (!profileSlotHasSave(profile.id, activeSlotId)) {
    profilePanel.hidden = false
    profilePanel.classList.add('blocking', 'signed-in')
    toast(`先创建${PROFILE_SLOT_LABELS[activeSlotId]}。`)
    updateProfileUi()
    openCharacterCreator(activeSlotId)
    updateHud()
    updateGuide()
    return
  }
  profilePanel.hidden = true
  loadGame()
  ensureEnemies()
  toast(`已进入 ${profile.name} 的${cloudAccountActive ? '云端账号' : '本地档案'}。`)
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
  const sessionId = sessionStorage.getItem(PROFILE_SESSION_KEY)
  if (active && sessionId === active.id) {
    activeProfile = active
    active.lastLoginAt = Date.now()
    nextIndex.activeId = active.id
    writeProfileIndex(nextIndex)
  } else {
    activeProfile = null
    showProfilePanel(true, active ? 'login' : 'register')
    if (active) profileNameInput.value = active.name
  }
  updateProfileUi()
}

const guideTexts = [
  '野外会自动沿世界地图前进，点击战斗画面可临时接管移动。',
  '靠近敌人后角色会自动释放本命术；获得法宝后会自动释放对应仙术。',
  '吸收魂质球升级会自动提升攻击、生命和法力；进化卡只改变法宝与战斗机制。',
  '抽卡券只从副本带出，星门补给主要召回角色碎片和装备。',
  '点击法宝，消耗法宝精华和灵石淬炼，达到节点后触发技能质变。',
  '灵石还可以强化装备；角色碎片满了以后在背包合成新角色。',
  '每日基础 3 张副本卷，世界地图 Boss 也可能掉落；进副本后收集门钥碎片并撤离。',
]

const mainQuests: MainQuest[] = [
  {
    title: '青岚初醒',
    desc: '在野外击杀 15 只虚境生物。',
    goal: 15,
    reward: '经验 60 / 灵石 80',
    progress: () => state.kills,
    apply: () => {
      grantExp(60)
      state.spiritStones += 80
    },
  },
  {
    title: '魂质淬体',
    desc: `提升到 ${cultivationRealm(5)}，完成第一次基础成长。`,
    goal: 5,
    reward: '法宝精华 3 / 凝露灵草 2',
    progress: () => state.hero.level,
    apply: () => {
      state.skills.points += 3
      addMaterialToBag('herb', 2)
    },
  },
  {
    title: '法宝显形',
    desc: '从副本带回 1 件法宝。',
    goal: 1,
    reward: '灵石 120 / 法宝精华 2',
    progress: () => artifactKeys.filter((key) => hasArtifact(key)).length,
    apply: () => {
      state.spiritStones += 120
      state.skills.points += 2
    },
  },
  {
    title: '秘境采集',
    desc: '带回 3 份炼材。',
    goal: 3,
    reward: '灵石 160 / 法宝精华 2',
    progress: () => materialCount('herb') + materialCount('ore') + materialCount('relic'),
    apply: () => {
      state.spiritStones += 160
      state.skills.points += 2
    },
  },
  {
    title: '本命淬炼',
    desc: '任意法宝淬炼到 Lv.3。',
    goal: 3,
    reward: '玄铁灵矿 2 / 秘境残符 1',
    progress: () => Math.max(0, ...artifactKeys.map((key) => artifactLevel(key))),
    apply: () => {
      addMaterialToBag('ore', 2)
      addMaterialToBag('relic', 1)
    },
  },
  {
    title: '星门同伴',
    desc: '合成第 2 名角色。',
    goal: 2,
    reward: '灵石 300 / 秘境残符 2',
    progress: () => state.ownedCharacters.length,
    apply: () => {
      state.spiritStones += 300
      addMaterialToBag('relic', 2)
    },
  },
  {
    title: '筑基试炼',
    desc: `提升到 ${cultivationRealm(20)}，准备挑战高阶秘境。`,
    goal: 20,
    reward: '灵石 500 / 法宝精华 6',
    progress: () => state.hero.level,
    apply: () => {
      state.spiritStones += 500
      state.skills.points += 6
    },
  },
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

function currentMainQuest() {
  return mainQuests[state.mainQuestIndex] ?? null
}

function mainQuestProgress(quest = currentMainQuest()) {
  if (!quest) return { current: 0, goal: 0, ready: false }
  const current = Math.min(quest.goal, Math.max(0, Math.floor(quest.progress())))
  return { current, goal: quest.goal, ready: current >= quest.goal }
}

function claimMainQuestIfReady() {
  const quest = currentMainQuest()
  if (!quest) return
  const progress = mainQuestProgress(quest)
  if (!progress.ready) return
  quest.apply()
  state.mainQuestIndex += 1
  sfx.level()
  flashScreen('rgba(250,204,21,.18)', 0.14, 0.18)
  toast(`主线完成：${quest.title}，获得 ${quest.reward}。`)
  saveGame()
}

function updateMainQuestLabel() {
  const quest = currentMainQuest()
  if (!quest) {
    mainQuestLabel.classList.remove('ready')
    mainQuestLabel.textContent = '主线已完成：继续刷副本、淬炼法宝，等待下一章开放。'
    return
  }
  const progress = mainQuestProgress(quest)
  mainQuestLabel.classList.toggle('ready', progress.ready)
  mainQuestLabel.textContent = `主线 ${state.mainQuestIndex + 1}/${mainQuests.length}：${quest.title} ${progress.current}/${progress.goal} · ${quest.desc} · 奖励 ${quest.reward}`
}

function normalizeBaseHeroStats() {
  state.hero.baseAtk = baseHeroStats.atk
  state.hero.baseHp = baseHeroStats.hp
  state.hero.skillPower = baseHeroStats.mana
  state.hero.hp = Math.min(maxHp(), Math.max(1, state.hero.hp || maxHp()))
}

function normalizeArtifactLevels() {
  artifactKeys.forEach((key) => {
    const max = artifactDefs[key].max
    const normalized = Math.max(0, Math.min(max, Math.floor(state.artifacts[key] ?? 0)))
    state.artifacts[key] = normalized
    state.skills[key] = normalized
  })
}

function loadGame() {
  if (!activeProfile) return
  migrateProfileSaveToSlot(activeProfile.id)
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
    normalizeArtifactLevels()
    state.mutations = { ...baseMutations, ...(save.mutations ?? {}) }
    state.techniques = { ...baseTechniques, ...(save.techniques ?? {}) }
    artifactKeys.forEach((key) => syncArtifactMutation(key, true))
    state.activeDungeon = dungeonDefs.some((dungeon) => dungeon.id === save.activeDungeon) ? save.activeDungeon! : 'mossCave'
    state.characterName = normalizeCharacterName(save.characterName ?? '')
    state.activeCharacter = save.activeCharacter ?? 'sword'
    state.ownedCharacters = save.ownedCharacters?.length ? save.ownedCharacters : ['sword']
    state.characterShards = { ...baseCharacterShards, ...(save.characterShards ?? {}) }
    if (!state.ownedCharacters.includes('sword')) state.ownedCharacters.push('sword')
    if (!state.ownedCharacters.includes(state.activeCharacter)) state.activeCharacter = 'sword'
    state.kills = save.kills ?? 0
    state.tickets = save.tickets ?? 0
    state.spiritStones = save.spiritStones ?? 0
    state.dungeonEntries = save.dungeonEntries ?? 3
    state.pity = save.pity ?? 0
    state.wave = save.wave ?? 1
    state.worldStage = save.worldStage ?? stageNoFromWorldX(save.hero?.x ?? state.hero.x)
    state.worldStageKills = save.worldStageKills ?? 0
    state.questClaimed = save.questClaimed ?? false
    state.mainQuestIndex = save.mainQuestIndex ?? 0
    state.lastDaily = save.lastDaily ?? ''
    state.bag = Array.isArray(save.bag) ? save.bag : []
    state.guideStep = save.guideStep ?? 0
    state.hero.level = Math.max(state.hero.level, save.soulLevel ?? state.hero.level)
    state.soulExp = save.soulExp ?? save.soulProgress ?? 0
    state.autoHaste = save.autoHaste ?? 0
    state.autoExplore = true
    normalizeBaseHeroStats()
    const offlineMinutes = Math.min(480, Math.floor((Date.now() - (save.savedAt ?? Date.now())) / 60000))
    if (offlineMinutes >= 5) {
      const expGain = Math.floor(offlineMinutes / 3)
      const stoneGain = Math.floor(offlineMinutes / 2)
      grantExp(expGain)
      state.spiritStones += stoneGain
      toast(`离线 ${offlineMinutes} 分钟，获得 ${stoneGain} 灵石。抽卡券仍需进副本带出。`)
    }
    claimDailyReward()
  } catch {
    localStorage.removeItem(key)
    claimDailyReward()
  }
}

function saveGame() {
  if (!activeProfile) return
  normalizeArtifactLevels()
  const save: SaveData = {
    hero: state.hero,
    gear: state.gear,
    skills: state.skills,
    artifacts: state.artifacts,
    mutations: state.mutations,
    techniques: state.techniques,
    activeDungeon: state.activeDungeon,
    kills: state.kills,
    tickets: state.tickets,
    spiritStones: state.spiritStones,
    dungeonEntries: state.dungeonEntries,
    pity: state.pity,
    wave: state.wave,
    worldStage: state.worldStage,
    worldStageKills: state.worldStageKills,
    questClaimed: state.questClaimed,
    mainQuestIndex: state.mainQuestIndex,
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
    characterName: state.characterName,
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
  queueCloudSave(save)
}

function claimDailyReward() {
  const today = new Date().toISOString().slice(0, 10)
  if (state.lastDaily === today) return
  state.lastDaily = today
  state.dungeonEntries = Math.max(3, state.dungeonEntries)
  toast('每日基础副本入场卷已补足到 3 张。')
  saveGame()
}

function totalAtk() {
  return state.hero.baseAtk + state.hero.level * levelStatGrowth.atk + effectiveSkill('slash') * 4 + effectiveSkill('needle') * 2 + effectiveSkill('seal') * 3 + state.mutations.swordRide * 3 + equipmentStat(state.gear.weapon, 'atk')
}

function cultivationRealm(level = state.hero.level) {
  const normalized = Math.max(1, Math.floor(level || 1))
  const realmIndex = Math.min(cultivationRealms.length - 1, Math.floor((normalized - 1) / cultivationStages.length))
  const stageIndex = (normalized - 1) % cultivationStages.length
  return `${cultivationRealms[realmIndex]}${cultivationStages[stageIndex]}`
}

function cultivationRequirement(level: number) {
  return `${cultivationRealm(level)}解锁`
}

function maxHp() {
  return state.hero.baseHp + state.hero.level * levelStatGrowth.hp + effectiveSkill('regen') * 5 + effectiveSkill('bell') * 10 + effectiveSkill('seal') * 8 + equipmentStat(state.gear.armor, 'hp')
}

function skillPower() {
  return state.hero.skillPower + state.hero.level * levelStatGrowth.mana + effectiveSkill('burst') * 6 + effectiveSkill('mirror') * 4 + effectiveSkill('banner') * 3 + state.mutations.flameLotus * 4 + equipmentStat(state.gear.core, 'skill')
}

function grantExp(amount: number) {
  // 战斗经验仅作为累计统计，不直接升级——境界晋阶由魂质修炼（魂质球）唯一驱动
  state.hero.exp += amount
}

function skillEngageRange() {
  return 132 + effectiveSkill('slash') * 8 + state.mutations.swordRide * 14
}

function dungeonTier(dungeon = activeDungeonDef()) {
  return Math.max(1, Math.ceil(dungeon.unlockLevel / 8))
}

function dungeonCombatScale() {
  if (state.mode !== 'dungeon') return state.wave
  return dungeonTier() * 4 + state.dungeonFloor * 3 + Math.min(12, Math.floor(state.hero.level / 8))
}

function stageNoFromWorldX(x: number) {
  return Math.max(1, Math.floor(Math.max(0, x + stageSpan * 0.34) / stageSpan) + 1)
}

function worldStageGoal(no = worldStageNo()) {
  return Math.min(26, 8 + Math.floor(no * 1.35))
}

function beginWorldStageTransition(from: number, to: number) {
  worldStageTransition = { from, to, life: 1.8, maxLife: 1.8 }
}

function manualMoving() {
  return Math.hypot(input.x, input.y) > 0.12
}

function updateClickMovement(dt: number) {
  const blend = 1 - Math.exp(-dt * 10)
  if (!moveTarget) {
    input.x += (0 - input.x) * blend
    input.y += (0 - input.y) * blend
    return
  }
  const dx = moveTarget.x - state.hero.x
  const dy = moveTarget.y - state.hero.y
  const distance = Math.hypot(dx, dy)
  if (distance < 10) {
    moveTarget = null
    input.x += (0 - input.x) * blend
    input.y += (0 - input.y) * blend
    return
  }
  const slow = Math.min(1, distance / 92)
  const desiredX = Math.max(-1, Math.min(1, dx / 150)) * slow
  const desiredY = Math.max(-1, Math.min(1, dy / 70)) * slow
  input.x += (desiredX - input.x) * blend
  input.y += (desiredY - input.y) * blend
}

function autoWorldSpeed() {
  if (state.mode !== 'wild' || manualMoving() || !state.autoExplore) return 0
  const target = nearestEnemy()
  const cruise = 92 + state.mutations.swordRide * 10 + effectiveSkill('fan') * 6
  if (state.bossSpawned) {
    if (!target) return 0
    const distance = Math.hypot(target.x - state.hero.x, target.y - state.hero.y)
    if (distance > skillEngageRange() * 0.72) return Math.max(86, cruise)
    return 38
  }
  if (state.worldStageKills >= worldStageGoal()) return 0
  const orb = nearestSoulOrb()
  if (orb && orb.x > state.hero.x + 68 && Math.hypot(orb.x - state.hero.x, orb.y - state.hero.y) < soulMagnetRange() * 0.92) {
    return Math.max(cruise, 128 + effectiveSkill('fan') * 4)
  }
  if (!target) return cruise
  const ahead = target.x >= state.hero.x - 40
  const distance = Math.hypot(target.x - state.hero.x, target.y - state.hero.y)
  if (!ahead) return cruise - 10
  if (distance < skillEngageRange() * 0.88) return 64
  if (distance < skillEngageRange() + 76) return 82
  return cruise
}

function nearestSoulOrb() {
  let best: SoulOrb | null = null
  let bestDistance = Infinity
  for (const orb of state.soulOrbs) {
    const distance = Math.hypot(orb.x - state.hero.x, orb.y - state.hero.y)
    if (distance < bestDistance) {
      best = orb
      bestDistance = distance
    }
  }
  return best
}

function soulMagnetRange() {
  const base = state.mode === 'wild' ? 760 : 620
  return base + Math.min(180, state.hero.level * 2 + effectiveSkill('banner') * 14)
}

function autoPickupMovement(baseX: number) {
  if (manualMoving()) return { x: input.x * (state.mode === 'dungeon' ? 190 : 170), y: input.y * 46 }
  if (state.mode === 'dungeon' && state.dungeonGateFound) {
    const gateDx = state.dungeonExtractX - state.hero.x
    const gateDy = state.dungeonExtractY - state.hero.y
    const gateDistance = Math.hypot(gateDx, gateDy)
    if (gateDistance > 54) {
      return {
        x: Math.max(-1, Math.min(1, gateDx / 180)) * 168,
        y: Math.max(-1, Math.min(1, gateDy / 72)) * 54,
      }
    }
    return { x: 0, y: 0 }
  }
  const orb = nearestSoulOrb()
  if (!orb) {
    if (state.mode === 'dungeon') {
      const target = nearestEnemy()
      if (target) {
        const dx = target.x - state.hero.x
        const dy = target.y - state.hero.y
        const distance = Math.hypot(dx, dy)
        const engage = skillEngageRange() * 0.76
        if (distance > engage) {
          return {
            x: Math.max(-1, Math.min(1, dx / 180)) * 154,
            y: Math.max(-1, Math.min(1, dy / 72)) * 46,
          }
        }
        if (Math.abs(dy) > 12) return { x: 0, y: Math.max(-1, Math.min(1, dy / 72)) * 34 }
      }
    }
    return { x: baseX, y: 0 }
  }
  const dx = orb.x - state.hero.x
  const dy = orb.y - state.hero.y
  const distance = Math.hypot(dx, dy)
  if (distance < 46 || distance > soulMagnetRange() * 0.82) return { x: baseX, y: 0 }

  const chaseX = Math.max(-1, Math.min(1, dx / 180)) * (state.mode === 'dungeon' ? 164 : 150)
  const chaseY = Math.max(-1, Math.min(1, dy / 72)) * 52
  if (state.mode === 'wild') return { x: Math.max(baseX, chaseX), y: chaseY }
  return { x: chaseX, y: chaseY }
}

function mutationSummary() {
  const names: string[] = []
  if (state.mutations.swordRide > 0) names.push(`化虹·${mutationStageName(state.mutations.swordRide)}`)
  if (state.mutations.thunderFork > 0) names.push(`雷印·${mutationStageName(state.mutations.thunderFork)}`)
  if (state.mutations.swordDomain > 0) names.push(`剑域·${mutationStageName(state.mutations.swordDomain)}`)
  if (state.mutations.flameLotus > 0) names.push(`莲火·${mutationStageName(state.mutations.flameLotus)}`)
  return names.length > 0 ? names.join(' / ') : '未觉醒'
}

function mutationStageName(level: number) {
  if (level >= mutationMaxLevel) return '终式'
  if (level >= 2) return '二式'
  if (level >= 1) return '一式'
  return '未解锁'
}

function mutationNextTitle(base: string, current: number) {
  return `${base}·${mutationStageName(Math.min(mutationMaxLevel, current + 1))}`
}

function mutationNextDesc(current: number, awaken: string, advance: string, complete: string) {
  const next = Math.min(mutationMaxLevel, current + 1)
  if (next >= mutationMaxLevel) return `终式：${complete}`
  if (next >= 2) return `扩展：${advance}`
  return `解锁：${awaken}`
}

function activeCharacter() {
  return characters[state.activeCharacter]
}

function artifactLevel(key: ArtifactKey) {
  return Math.min(state.artifacts[key] ?? 0, artifactDefs[key].max)
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

function artifactUpgradeCost(key: ArtifactKey) {
  const nextLevel = Math.min(artifactDefs[key].max, artifactLevel(key) + 1)
  const rank = rarityRank[artifactDefs[key].rarity]
  return {
    essence: nextLevel,
    stones: nextLevel * rank * 30,
    material: materialKindForArtifact(key),
    materialCount: Math.max(1, Math.ceil(nextLevel / 3)),
  }
}

function materialKindForArtifact(key: ArtifactKey): MaterialKind {
  if (key === 'regen' || key === 'bell' || key === 'mirror') return 'herb'
  if (key === 'slash' || key === 'orbit' || key === 'needle') return 'ore'
  return 'relic'
}

function materialCount(kind: MaterialKind) {
  return state.bag
    .filter((item) => item.material === kind)
    .reduce((sum, item) => sum + item.count, 0)
}

function materialCostText(kind: MaterialKind, count: number) {
  return `${count}${materialDefs[kind].name}`
}

function consumeMaterial(kind: MaterialKind, count: number) {
  let remaining = count
  for (const item of state.bag) {
    if (item.material !== kind || remaining <= 0) continue
    const used = Math.min(item.count, remaining)
    item.count -= used
    remaining -= used
  }
  state.bag = state.bag.filter((item) => !item.material || item.count > 0)
  return remaining === 0
}

function mutationKeyForArtifact(key: ArtifactKey): keyof MutationTree | null {
  if (key === 'slash') return 'swordRide'
  if (key === 'chain') return 'thunderFork'
  if (key === 'orbit') return 'swordDomain'
  if (key === 'flame') return 'flameLotus'
  return null
}

function mutationStageForArtifactLevel(level: number) {
  if (level >= 10) return 3
  if (level >= 6) return 2
  if (level >= 3) return 1
  return 0
}

function syncArtifactMutation(key: ArtifactKey, silent = false) {
  const mutationKey = mutationKeyForArtifact(key)
  if (!mutationKey) return
  const next = mutationStageForArtifactLevel(artifactLevel(key))
  if (next <= state.mutations[mutationKey]) return
  state.mutations[mutationKey] = next
  if (!silent) {
    const label = `${artifactDefs[key].name}质变：${mutationStageName(next)}`
    toast(label)
    flashScreen('rgba(250,204,21,.2)', 0.18, 0.22)
    addParticleBurst(state.hero.x, state.hero.y - 92, artifactDefs[key].color, 36, 1.15, 'rune')
    state.texts.push({ x: state.hero.x, y: state.hero.y - 118, text: label, color: artifactDefs[key].color, life: 1.25 })
  }
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

function equipmentForgeLevel(item?: Reward | null) {
  return item?.forge ?? 0
}

function equipmentForgeMax(item?: Reward | null) {
  if (!item) return 0
  return 4 + rarityRank[item.rarity] * 2
}

function equipmentForgeCost(item: Reward) {
  return (equipmentForgeLevel(item) + 1) * rarityRank[item.rarity] * 45
}

function equipmentStat(item: Reward | null | undefined, stat: 'atk' | 'hp' | 'skill') {
  if (!item) return 0
  const base = item[stat] ?? 0
  const forge = equipmentForgeLevel(item)
  if (stat === 'atk') return base + forge * (2 + rarityRank[item.rarity])
  if (stat === 'hp') return base + forge * (8 + rarityRank[item.rarity] * 4)
  return base + forge * (2 + rarityRank[item.rarity])
}

function upgradeEquipped(slot: Slot) {
  const item = state.gear[slot]
  if (!item) return
  const max = equipmentForgeMax(item)
  if (equipmentForgeLevel(item) >= max) {
    toast(`${item.name} 已强化到当前上限。`)
    return
  }
  const cost = equipmentForgeCost(item)
  if (state.spiritStones < cost) {
    toast(`灵石不足：强化 ${item.name} 需要 ${cost} 灵石。`)
    return
  }
  state.spiritStones -= cost
  item.forge = equipmentForgeLevel(item) + 1
  state.hero.hp = Math.min(maxHp(), state.hero.hp + 20)
  toast(`装备强化：${item.name} +${item.forge}`)
  saveGame()
  renderEquipPanel()
  updateHud()
}

function equipmentScore(item: Reward) {
  return rarityRank[item.rarity] * 100 + equipmentStat(item, 'atk') + equipmentStat(item, 'hp') + equipmentStat(item, 'skill')
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
  if (!state.ownedCharacters.includes(item.characterId) && before < def.need && after >= def.need) {
    toast(`${def.name} 碎片已满，可在背包消耗灵石合成。`)
  }
}

function characterSynthesisCost(def: CharacterDef) {
  return def.need * 12
}

function synthesizeCharacter(id: CharacterId) {
  const def = characters[id]
  if (state.ownedCharacters.includes(id)) {
    switchCharacter(id)
    return
  }
  const have = state.characterShards[id] ?? 0
  if (have < def.need) {
    toast(`${def.name} 碎片 ${have}/${def.need}`)
    return
  }
  const cost = characterSynthesisCost(def)
  if (state.spiritStones < cost) {
    toast(`合成 ${def.name} 需要 ${cost} 灵石。`)
    return
  }
  state.spiritStones -= cost
  state.ownedCharacters.push(id)
  state.activeCharacter = id
  state.hero.hp = Math.min(maxHp(), state.hero.hp + 30)
  toast(`角色合成并出战：${def.name}`)
  state.texts.push({ x: state.hero.x, y: state.hero.y - 92, text: `合成角色：${def.name}`, color: def.color, life: 1.2 })
  saveGame()
  if (!equipPanel.hidden) renderEquipPanel()
  if (!bagPanel.hidden) renderBagPanel()
  updateHud()
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
  if (item.material) return `${materialDefs[item.material].desc} 数量 x${item.count}`
  if (item.atk) parts.push(`攻击 +${equipmentStat(item, 'atk')}`)
  if (item.hp) parts.push(`生命 +${equipmentStat(item, 'hp')}`)
  if (item.skill) parts.push(`法力 +${equipmentStat(item, 'skill')}`)
  if (item.slot && equipmentForgeLevel(item) > 0) parts.push(`强化 +${equipmentForgeLevel(item)}`)
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
  return `<img src="${versionedAsset(src)}" alt="">`
}

function materialIconSrc(item: Reward) {
  if (item.material === 'herb') return '/assets/item-icons/alchemy-herbs/PNG/without_shadow/14.png'
  if (item.material === 'ore') return '/assets/item-icons/rpg_inventory/RPG Inventory/Crafting/Ore_03.png'
  if (item.material === 'relic') return '/assets/item-icons/xianxia-jade-slip.png'
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
  return `<span class="character-shard-art" style="--role-color:${def.color}"><img src="${versionedAsset(def.portrait)}" alt=""><u>${characterSigil(def)}</u></span>`
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
  return `<img class="artifact-art" src="${versionedAsset(def.image)}" alt="">`
}

function unknownArtifactIcon(rarity: Rarity) {
  return `<span class="artifact-unknown" style="--rarity-color:${rarityColor[rarity]}">?</span>`
}

function artifactDropSource(key: ArtifactKey) {
  const focusedDungeons = dungeonDefs.filter((dungeon) => dungeon.artifactFocus.includes(key)).map((dungeon) => dungeon.name)
  const basePool = ['bell', 'needle', 'regen', 'slash'].includes(key) ? '任意副本基础法宝池' : ''
  return [basePool, focusedDungeons.length ? `${focusedDungeons.join('、')}重点掉落` : ''].filter(Boolean).join('；')
}

function dungeonRewardPreview(dungeon: DungeonDef) {
  const minStones = dungeon.skillBonus * 18 + dungeon.killGoal * 7
  return [
    `券 ${dungeon.ticketBonus}+`,
    `灵石 ${minStones}+`,
    `精华 ${dungeon.skillBonus}+`,
  ].join(' / ')
}

function artifactPoolForDungeon(dungeon: DungeonDef, stage: number) {
  const pool: ArtifactKey[] = ['bell', 'needle', 'regen', 'slash']
  pool.push(...dungeon.artifactFocus, ...dungeon.artifactFocus, ...dungeon.artifactFocus)
  if (dungeon.unlockLevel >= 20) pool.push(...dungeon.artifactFocus)
  if (stage >= 2) pool.push('mirror', 'fan', 'chain', 'burst')
  if (stage >= 3) pool.push('banner', 'orbit')
  if (stage >= 4) pool.push('flame', 'seal')
  return pool
}

function renderDungeonPanel() {
  dungeonEntrySummary.textContent = `入场卷 ${state.dungeonEntries}张 | 当前 ${cultivationRealm()}`
  dungeonBriefCopy.textContent = state.mode === 'dungeon'
    ? `正在挑战 ${activeDungeonDef().name}，回到战斗页可继续探索或靠近撤离门。`
    : '副本会消耗 1 张入场卷；每日补足到 3 张，世界地图 Boss 有机会额外掉落。'
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
        <img src="${versionedAsset(dungeon.image)}" alt="${dungeon.name}场景">
        <em>${locked ? cultivationRealm(dungeon.unlockLevel) : '可进入'}</em>
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
      <div class="dungeon-reward-row"><small>主要收益</small><b>${dungeonRewardPreview(dungeon)}</b></div>
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
        ? cultivationRequirement(dungeon.unlockLevel)
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
      <img src="${versionedAsset(active.portrait)}" alt="">
      <i>${characterSigil(active)}</i>
    </div>
    <div class="gear-card-copy">
      <b>装备方案</b>
      <span>${active.name} · 战力 ${totalAtk()}</span>
      <small>${active.title} | 生命 ${maxHp()} | 法力 ${skillPower()}</small>
    </div>
  `
  equippedList.appendChild(summary)
  ;(['weapon', 'armor', 'core'] as Slot[]).forEach((slot) => {
    const item = state.gear[slot]
    const div = document.createElement('div')
    div.className = `gear-card equip-slot ${item ? 'equipped' : 'empty'}`
    const forgeCost = item ? equipmentForgeCost(item) : 0
    const forgeMax = item ? equipmentForgeMax(item) : 0
    const forgeLevel = equipmentForgeLevel(item)
    div.innerHTML = `
      <i class="equip-icon">${equipIcon(slot)}</i>
      <div class="gear-card-copy">
        <b>${slotName(slot)}</b>
        <span>${item ? `${item.name}${forgeLevel > 0 ? ` +${forgeLevel}` : ''}` : '未装备'}</span>
        <small>${item ? `${itemStats(item)} | ${forgeLevel}/${forgeMax}` : '抽卡获得装备后可穿戴'}</small>
      </div>
      ${item ? `<button class="gear-forge" type="button" ${forgeLevel >= forgeMax || state.spiritStones < forgeCost ? 'disabled' : ''}>${forgeLevel >= forgeMax ? '已满' : `${forgeCost}灵石`}</button>` : ''}
    `
    if (item) {
      div.style.borderColor = rarityColor[item.rarity]
      div.style.setProperty('--item-color', rarityColor[item.rarity])
    }
    div.querySelector<HTMLButtonElement>('.gear-forge')?.addEventListener('click', () => upgradeEquipped(slot))
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
        <b>${item.name}${equipmentForgeLevel(item) > 0 ? ` +${equipmentForgeLevel(item)}` : ''}</b>
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
      <div><small>灵石</small><b>${state.spiritStones}</b></div>
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
    const ready = !owned && shards >= def.need
    const synthCost = characterSynthesisCost(def)
    const cell = document.createElement('button')
    cell.type = 'button'
    cell.className = `inventory-cell shard-cell ${owned ? 'owned' : ''} ${ready ? 'ready' : ''}`
    cell.style.setProperty('--item-color', def.color)
    const progress = Math.min(100, (shards / def.need) * 100)
    cell.innerHTML = `
      <i>${characterShardIcon(def)}</i>
      <em><u style="width:${owned ? 100 : progress}%"></u></em>
      <span>${owned ? '已合成' : ready ? '可合成' : `${Math.min(shards, def.need)}/${def.need}`}</span>
    `
    cell.addEventListener('click', () => {
      const meta = owned
        ? (state.activeCharacter === def.id ? '出战中' : '已合成角色')
        : ready
          ? `可合成 · 消耗 ${synthCost} 灵石`
          : `角色碎片 ${Math.min(shards, def.need)}/${def.need}`
      const desc = ready ? `${def.desc} 点击消耗灵石合成并出战。` : def.desc
      showDetail(def.name, meta, desc, def.color)
      if (owned) switchCharacter(def.id)
      else if (ready) synthesizeCharacter(def.id)
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
  artifactPageTitle.textContent = ownedCount > 0 ? `法宝匣 ${ownedCount}/${artifactKeys.length}` : '未开封法宝匣'
  artifactPageSubtitle.textContent = ownedCount > 0
    ? `已显形 ${ownedCount} 件，未获得的仍是未鉴定槽位。`
    : '进入副本撤离后，法宝才会显形并解锁详情。'
  skillPointsLabel.innerHTML = `
    <span>精华 <b>${state.skills.points}</b></span>
    <span>灵石 <b>${state.spiritStones}</b></span>
    <span>炼材 <b>${materialCount('herb') + materialCount('ore') + materialCount('relic')}</b></span>
    <span>已获 <b>${ownedCount}/${artifactKeys.length}</b></span>
    <span>满阶 <b>${maxedCount}</b></span>
  `
  skillList.innerHTML = ''

  artifactRarityOrder.forEach((rarity) => {
    const groupKeys = artifactKeys.filter((key) => artifactDefs[key].rarity === rarity)
    if (!groupKeys.length) return
    const group = document.createElement('section')
    group.className = 'artifact-rarity-group'
    group.style.setProperty('--rarity-color', rarityColor[rarity])
    const groupOwned = groupKeys.filter((key) => hasArtifact(key)).length
    group.innerHTML = `<div class="artifact-rarity-head"><b>${rarity}</b><span>${groupOwned}/${groupKeys.length}</span></div>`
    const switcher = document.createElement('div')
    switcher.className = 'artifact-switch'
    groupKeys.forEach((key) => {
      const def = artifactDefs[key]
      const owned = hasArtifact(key)
      const level = artifactLevel(key)
      const bonus = owned ? (activeCharacter().starter[key] ?? 0) : 0
      const tab = document.createElement('button')
      tab.type = 'button'
      tab.dataset.artifact = key
      tab.className = `artifact-tab ${selectedArtifactKey === key ? 'active' : ''} ${owned ? 'owned' : 'locked'}`
      tab.style.setProperty('--item-color', rarityColor[def.rarity])
      tab.style.setProperty('--rarity-color', rarityColor[def.rarity])
      tab.innerHTML = owned
        ? `
          <em>${def.rarity}</em>
          <i>${artifactIcon(key)}</i>
          <span>${def.name}</span>
          <small>${`Lv.${Math.min(level, def.max)}${bonus > 0 ? ` · 天赋+${bonus}阶` : ''}`}</small>
        `
        : `
          <em>${def.rarity}</em>
          <i>${unknownArtifactIcon(def.rarity)}</i>
          <span>未鉴定法宝</span>
          <small>副本掉落</small>
        `
      tab.addEventListener('click', () => {
        openArtifactDetail(key)
      })
      switcher.appendChild(tab)
    })
    group.appendChild(switcher)
    skillList.appendChild(group)
  })
}

function closeArtifactDetail() {
  artifactDetailPanel.hidden = true
  artifactDetailPanel.innerHTML = ''
}

function openArtifactDetail(key: ArtifactKey) {
  selectedArtifactKey = key
  const def = artifactDefs[key]
  const owned = hasArtifact(key)
  const level = artifactLevel(key)
  const shownLevel = Math.min(level, def.max)
  const bonus = owned ? (activeCharacter().starter[key] ?? 0) : 0
  const cost = artifactUpgradeCost(key)
  const progress = owned ? Math.min(100, (shownLevel / def.max) * 100) : 0
  const displayName = owned ? def.name : `未鉴定${def.rarity}法宝`
  const displayType = owned ? def.type : '副本封存'
  const displayLevel = owned
    ? `Lv.${shownLevel}/${def.max}${bonus > 0 ? ` · 角色天赋：效果 +${bonus}阶` : ''}${shownLevel >= def.max ? ' · 满级后重复掉落转化为精华' : ''}`
    : '尚未获得，名称与效果待鉴定'
  const displayDesc = owned ? def.desc : '这个槽位只代表可能出现的法宝品质。进入副本并成功撤离后，才会揭示真实名称、图片和法宝效果。'
  const displaySource = owned
    ? `<b>获取出处：</b><span>${artifactDropSource(key)}</span><b>设定来源：</b><span>${def.source}</span>`
    : '<b>获取出处：</b><span>副本封存槽位，获得后显示具体掉落副本。</span><b>设定来源：</b><span>未鉴定前不显示真实法宝来源。</span>'
  const displayIcon = owned ? artifactIcon(key) : unknownArtifactIcon(def.rarity)
  artifactDetailPanel.hidden = false
  artifactDetailPanel.style.setProperty('--item-color', rarityColor[def.rarity])
  artifactDetailPanel.style.setProperty('--rarity-color', rarityColor[def.rarity])
  artifactDetailPanel.innerHTML = `
    <div class="artifact-focus-card artifact-modal-card ${owned ? 'owned' : 'locked'}" role="dialog" aria-modal="true" aria-label="${displayName}详情">
      <button class="artifact-modal-close" type="button" aria-label="关闭法宝详情">x</button>
      <div class="artifact-hero-art">${displayIcon}</div>
      <div class="artifact-copy">
        <small><em>${def.rarity}</em> ${displayType}</small>
        <b>${displayName}</b>
        <span>${displayLevel}</span>
        <p>${displayDesc}</p>
      </div>
      <div class="artifact-meter"><i style="width:${progress}%"></i></div>
      <div class="artifact-source">${displaySource}</div>
      <button class="artifact-upgrade" type="button"></button>
    </div>
  `
  const action = artifactDetailPanel.querySelector<HTMLButtonElement>('.artifact-upgrade')!
  if (!owned) {
    action.textContent = '去副本寻找'
    action.disabled = true
  } else if (level >= def.max) {
    action.textContent = '已满阶'
    action.disabled = true
  } else {
    action.textContent = `淬炼 · ${cost.essence}精华 / ${cost.stones}灵石 / ${materialCostText(cost.material, cost.materialCount)}`
    action.disabled = state.skills.points < cost.essence || state.spiritStones < cost.stones || materialCount(cost.material) < cost.materialCount
  }
  action.addEventListener('click', () => {
    upgradeSkill(key, def.max)
    openArtifactDetail(key)
  })
  artifactDetailPanel.querySelector<HTMLButtonElement>('.artifact-modal-close')?.addEventListener('click', closeArtifactDetail)
  renderSkillPanel()
}

function upgradeSkill(key: ArtifactKey, max: number) {
  if (!hasArtifact(key)) {
    toast(`先在副本获得法宝：${artifactDefs[key].name}`)
    return
  }
  const cost = artifactUpgradeCost(key)
  if (artifactLevel(key) >= max) return
  if (state.skills.points < cost.essence || state.spiritStones < cost.stones || materialCount(cost.material) < cost.materialCount) {
    toast(`淬炼材料不足：需要 ${cost.essence} 精华 / ${cost.stones} 灵石 / ${materialCostText(cost.material, cost.materialCount)}。`)
    return
  }
  const beforeStage = mutationStageForArtifactLevel(artifactLevel(key))
  state.skills.points -= cost.essence
  state.spiritStones -= cost.stones
  consumeMaterial(cost.material, cost.materialCount)
  state.artifacts[key] += 1
  state.skills[key] = state.artifacts[key]
  syncArtifactMutation(key)
  if (!mutationKeyForArtifact(key) || mutationStageForArtifactLevel(artifactLevel(key)) === beforeStage) {
    toast(`法宝淬炼：${artifactDefs[key].name} +1`)
  }
  saveGame()
  renderSkillPanel()
  updateHud()
}

function cloneReward(item: Reward): Reward {
  return { ...item }
}

function rollArtifactReward(): Reward {
  const stage = state.mode === 'dungeon' ? Math.max(1, Math.ceil(activeDungeonDef().unlockLevel / 8)) : worldStageNo()
  const candidates: ArtifactKey[] = state.mode === 'dungeon'
    ? artifactPoolForDungeon(activeDungeonDef(), stage)
    : ['bell', 'needle', 'regen', 'slash']
  if (stage >= 2 || state.mode === 'dungeon') candidates.push('mirror', 'fan', 'chain', 'burst')
  if (stage >= 3 || Math.random() < 0.45) candidates.push('banner', 'orbit')
  if (stage >= 4 || Math.random() < 0.38) candidates.push('flame', 'seal')
  const key = candidates[Math.floor(Math.random() * candidates.length)]
  const def = artifactDefs[key]
  return { name: def.name, rarity: def.rarity, count: 1, artifact: key, skill: rarityRank[def.rarity] }
}

function rollDungeonDrop(): Reward {
  const stage = Math.max(1, Math.ceil(activeDungeonDef().unlockLevel / 8))
  const artifactChance = Math.min(0.82, 0.6 + stage * 0.04)
  return Math.random() < artifactChance ? rollArtifactReward() : rollReward()
}

function chooseEnemyKind(elite: boolean): EnemyKind {
  if (state.mode === 'wild') {
    const pools: EnemyKind[][] = [
      ['wolf', 'slime'],
      ['crystal', 'wolf'],
      ['bat'],
      ['crystal'],
      ['wolf'],
      ['crystal', 'wolf'],
      ['bat', 'crystal'],
    ]
    const pool = pools[(worldStageNo() - 1) % pools.length] ?? ['slime']
    if (elite && pool.includes('crystal') && Math.random() < 0.48) return 'crystal'
    return pool[Math.floor(Math.random() * pool.length)]
  }
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
  const visibleRight = canvas.width - heroScreenX(canvas.width)
  const distance = state.mode === 'wild'
    ? Math.max(260, visibleRight * 0.72) + Math.random() * 150
    : 230 + Math.random() * 220
  const stageBonus = state.mode === 'wild' ? worldStageNo() * 5 : 0
  const scale = state.mode === 'dungeon' ? dungeonCombatScale() : state.wave
  const kind = chooseEnemyKind(elite)
  const profile = enemyStatProfile(kind)
  const baseHp = state.mode === 'dungeon'
    ? dungeonTier() <= 1
      ? elite
        ? 30 + state.dungeonFloor * 14
        : 16 + state.dungeonFloor * 7
      : elite
        ? 42 + scale * 8
        : 18 + scale * 3.6
    : elite
      ? 88 + scale * 13 + stageBonus * 2
      : 38 + scale * 6 + stageBonus
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
    castCd: nextEnemyCastCooldown({ elite, boss: false }),
    casting: 0,
  })
}

function ensureEnemies() {
  if (state.mode === 'dungeon' && state.bossSpawned) return
  if (state.mode === 'wild' && state.bossSpawned) return
  if (state.mode === 'wild' && state.worldStageKills >= worldStageGoal()) {
    spawnBoss()
    return
  }
  if (state.mode === 'wild') {
    state.enemies = state.enemies.filter((enemy) => enemy.x > state.hero.x - 260)
  }
  const target = state.mode === 'dungeon' ? Math.min(7, 4 + dungeonTier() + state.dungeonFloor) : 6
  while (state.enemies.length < target) spawnEnemy(state.mode === 'dungeon' && Math.random() < 0.25)
}

function spawnBoss() {
  if (state.bossSpawned) return
  state.bossSpawned = true
  const stage = worldStageNo()
  const hp = state.mode === 'dungeon'
    ? dungeonTier() <= 1
      ? 180 + dungeonCombatScale() * 6 + state.hero.level * 5 + state.dungeonFloor * 42
      : 180 + dungeonCombatScale() * 16 + state.hero.level * 6 + state.dungeonFloor * 36
    : 460 + stage * 74 + state.hero.level * 28
  state.enemies = state.mode === 'wild' ? [] : state.enemies.filter((enemy) => !enemy.boss)
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
    castCd: 1.1,
    casting: 0,
  })
  if (state.mode === 'wild') {
    toast(`第${stage}关 Boss 已出现：击败后才能进入下一关。`)
    state.texts.push({ x: state.hero.x, y: state.hero.y - 126, text: `第${stage}关 Boss`, color: '#facc15', life: 1.2 })
    flashScreen('rgba(250,204,21,.18)', 0.16, 0.18)
  } else {
    toast('副本 Boss 已出现，击败它完成结算。')
  }
}

function nextEnemyCastCooldown(enemy: { elite?: boolean; boss?: boolean }) {
  if (enemy.boss) return 3.1 + Math.random() * 1.8
  if (enemy.elite) return 4.8 + Math.random() * 2.6
  return 7.4 + Math.random() * 4.2
}

function enemySkillName(enemy: Enemy) {
  if (enemy.boss) {
    const names = ['青藤缠阵', '星陨镇压', '雾灯蚀魂', '紫晶地刺', '血裂魔爪', '王庭法诏', '星海潮汐']
    return names[worldMonsterIndex()] ?? 'Boss 秘术'
  }
  if (enemy.kind === 'bat') return '妖风刃'
  if (enemy.kind === 'crystal' || enemy.kind === 'warden') return '地脉刺'
  if (enemy.kind === 'wolf') return '兽魂扑击'
  return '灵团'
}

function enemySkillKind(enemy: Enemy): EnemySkillKind {
  if (enemy.boss) return 'bossDomain'
  if (enemy.kind === 'bat') return 'wingBlade'
  if (enemy.kind === 'crystal' || enemy.kind === 'warden') return 'earthSpike'
  return 'spiritOrb'
}

function enemySkillDamage(enemy: Enemy) {
  const stage = state.mode === 'dungeon' ? dungeonTier() + state.dungeonFloor - 1 : worldStageNo()
  const difficulty = Math.min(36, stage)
  if (state.mode === 'dungeon') {
    if (enemy.boss) return Math.round(maxHp() * 0.075 + difficulty * 1.05)
    if (enemy.elite) return Math.round(7 + difficulty * 0.55)
    return Math.round(3 + difficulty * 0.25)
  }
  if (enemy.boss) return Math.round(maxHp() * 0.15 + difficulty * 2.4)
  if (enemy.elite) return Math.round(14 + difficulty * 1.25)
  return Math.round(7 + difficulty * 0.72)
}

function tryStartEnemySkill(enemy: Enemy, distance: number, dt: number) {
  if (enemy.hp <= 0) return
  enemy.castCd = Math.max(0, (enemy.castCd ?? nextEnemyCastCooldown(enemy)) - dt)
  enemy.casting = Math.max(0, (enemy.casting ?? 0) - dt)
  if (enemy.castCd > 0) return
  if (state.mode === 'dungeon' && !enemy.boss && !enemyVisibleForCombat(enemy, 120)) return
  const maxDistance = enemy.boss ? 820 : enemy.elite ? 600 : 480
  if (distance > maxDistance) return
  if (state.mode === 'dungeon' && !enemy.boss && !enemy.elite && Math.random() < 0.78) {
    enemy.castCd = nextEnemyCastCooldown(enemy)
    return
  }
  if (!enemy.boss && !enemy.elite && Math.random() < 0.42) {
    enemy.castCd = nextEnemyCastCooldown(enemy)
    return
  }

  const theme = activeStageTheme()
  const kind = enemySkillKind(enemy)
  const windup = enemy.boss ? 1.18 : enemy.elite ? 0.86 : 0.74
  const radius = kind === 'wingBlade'
    ? (enemy.boss ? 92 : enemy.elite ? 58 : 44)
    : enemy.boss ? 122 : enemy.elite ? 72 : 52
  const lead = Math.max(-70, Math.min(70, (state.hero.x - enemy.x) * 0.14))
  const targetX = state.hero.x + (enemy.boss ? lead * 0.55 : lead)
  const targetY = Math.max(-50, Math.min(50, state.hero.y + (Math.random() - 0.5) * (enemy.boss ? 20 : 12)))
  const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x)
  const label = enemySkillName(enemy)
  enemy.casting = windup * 0.9
  enemy.castCd = nextEnemyCastCooldown(enemy)
  state.enemySkills.push({
    id: enemySkillId++,
    enemyId: enemy.id,
    kind,
    x: enemy.x,
    y: enemy.y,
    targetX,
    targetY,
    radius,
    damage: enemySkillDamage(enemy),
    color: enemy.boss ? '#facc15' : enemy.elite ? '#fb923c' : theme.accent,
    life: windup + (enemy.boss ? 0.86 : 0.56),
    maxLife: windup + (enemy.boss ? 0.86 : 0.56),
    windup,
    hit: false,
    angle,
    boss: enemy.boss,
    label,
  })
  if (enemy.boss || enemy.elite) {
    state.texts.push({ x: enemy.x, y: enemy.y - (enemy.boss ? 118 : 72), text: `${enemy.boss ? 'Boss·' : ''}${label}`, color: enemy.boss ? '#fef08a' : theme.accent, life: enemy.boss ? 1.1 : 0.82 })
  }
}

function enemySkillHitsHero(skill: EnemySkill) {
  const heroPoint = { x: state.hero.x, y: state.hero.y }
  if (skill.kind === 'wingBlade') {
    return distanceToSegment(heroPoint, { x: skill.x, y: skill.y }, { x: skill.targetX, y: skill.targetY }) <= skill.radius
  }
  const dx = heroPoint.x - skill.targetX
  const dy = (heroPoint.y - skill.targetY) * 1.65
  return Math.hypot(dx, dy) <= skill.radius
}

function applyEnemySkillHit(skill: EnemySkill) {
  const hit = enemySkillHitsHero(skill)
  const impactX = skill.kind === 'wingBlade' ? state.hero.x : skill.targetX
  const impactY = skill.kind === 'wingBlade' ? state.hero.y - 34 : skill.targetY - 22
  if (hit) {
    state.hero.hp = Math.max(0, state.hero.hp - skill.damage)
    state.texts.push({ x: state.hero.x, y: state.hero.y - 86, text: `-${skill.damage}`, color: skill.boss ? '#fef08a' : '#fecaca', life: 0.78 })
    sfx.hit(skill.boss ? 1.8 : 1.15, false)
    flashScreen(skill.boss ? 'rgba(250,204,21,.22)' : 'rgba(248,113,113,.14)', skill.boss ? 0.2 : 0.12, 0.14)
    addParticleBurst(state.hero.x, state.hero.y - 42, skill.color, skill.boss ? 30 : 14, skill.boss ? 1.15 : 0.78, skill.kind === 'earthSpike' ? 'shard' : 'spark')
  } else if (skill.boss) {
    state.texts.push({ x: state.hero.x, y: state.hero.y - 76, text: '闪避', color: '#bae6fd', life: 0.55 })
  }
  state.effects.push({
    x: impactX,
    y: impactY,
    radius: skill.radius + (skill.boss ? 70 : 24),
    color: skill.color,
    life: skill.boss ? 0.6 : 0.42,
    maxLife: skill.boss ? 0.6 : 0.42,
    kind: skill.kind === 'earthSpike' ? 'impact' : skill.kind === 'bossDomain' ? 'ring' : 'flare',
    angle: skill.angle,
  })
}

function updateEnemySkills(dt: number) {
  for (const skill of state.enemySkills) {
    const elapsed = skill.maxLife - skill.life
    if (!skill.hit && elapsed >= skill.windup) {
      skill.hit = true
      const caster = state.enemies.find((enemy) => enemy.id === skill.enemyId)
      if (caster) caster.attack = skill.boss ? 0.46 : caster.elite ? 0.34 : 0.28
      applyEnemySkillHit(skill)
    }
    skill.life -= dt
  }
  state.enemySkills = state.enemySkills.filter((skill) => skill.life > 0)
}

function rollWorldBossDungeonPassDrop(stage: number) {
  if (stage % 5 === 0) return 1
  const chance = Math.min(0.68, 0.28 + stage * 0.01)
  return Math.random() < chance ? 1 : 0
}

function worldBossMaterialKind(stage: number): MaterialKind {
  const stageIndex = (stage - 1) % stageThemes.length
  if ([0, 2].includes(stageIndex)) return 'herb'
  if ([3, 5].includes(stageIndex)) return 'ore'
  return 'relic'
}

function worldBossMaterialDrop(stage: number) {
  const kind = worldBossMaterialKind(stage)
  const count = 1 + Math.floor(stage / 8) + (stage % 5 === 0 ? 1 : 0)
  return addMaterialToBag(kind, count)
}

function worldBossSettlementRank(stage: number, passDrop: number) {
  if (stage % 10 === 0 && passDrop > 0) return 'SS'
  if (passDrop > 0 || stage % 5 === 0) return 'S'
  return 'A'
}

function damageEnemy(enemy: Enemy, amount: number) {
  enemy.hp -= amount
  enemy.hit = 0.18
  const power = Math.min(2.2, 0.72 + amount / 120 + (enemy.elite ? 0.22 : 0) + (enemy.boss ? 0.38 : 0))
  const killed = enemy.hp <= 0
  const knockDir = enemy.x >= state.hero.x ? 1 : -1
  enemy.x += knockDir * (enemy.boss ? 2 : 5) * Math.min(1.35, power)
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
    if (state.mode === 'dungeon') completeDungeon()
    else completeWorldStage()
    saveGame()
    return
  }
  state.kills += 1
  if (state.mode === 'dungeon') {
    const dungeonKillNo = state.kills - state.dungeonStartKills
    const expGain = enemy.elite ? 22 : 10
    const ticketGain = enemy.elite || dungeonKillNo % 2 === 0 || Math.random() < 0.28 ? 1 : 0
    const skillGain = enemy.elite && Math.random() < 0.55 ? 1 : 0
    const stoneGain = enemy.elite ? 18 + Math.floor(dungeonKillNo / 2) : 7 + Math.floor(Math.random() * 6)
    state.dungeonLootExp += expGain
    state.dungeonLootTickets += ticketGain
    state.dungeonLootSkill += skillGain
    state.dungeonLootStones += stoneGain
    state.texts.push({ x: enemy.x, y: enemy.y - 44, text: `携带 经验+${expGain}`, color: '#93c5fd', life: 0.85 })
    if (ticketGain > 0) state.texts.push({ x: enemy.x + 18, y: enemy.y - 66, text: '抽卡券+1', color: '#facc15', life: 0.9 })
    if (skillGain > 0) state.texts.push({ x: enemy.x - 18, y: enemy.y - 86, text: '法宝精华+1', color: '#c084fc', life: 0.9 })
    state.texts.push({ x: enemy.x + 6, y: enemy.y - 104, text: `灵石+${stoneGain}`, color: '#fef08a', life: 0.85 })
    if (!state.dungeonGateFound && (enemy.elite || dungeonKillNo % 3 === 0 || Math.random() < 0.35)) {
      gainDungeonMaterial(enemy.x, enemy.y, enemy.elite ? '完整门钥' : '门钥碎片')
    }
    if (!state.dungeonGateFound && dungeonFloorKills() >= dungeonFloorKillGoal()) {
      state.dungeonMaterials = Math.max(state.dungeonMaterials, state.dungeonMaterialGoal - 1)
      gainDungeonMaterial(enemy.x, enemy.y, '层门钥核')
    }
  } else {
    state.worldStageKills += 1
    const expGain = enemy.elite ? 18 : 8
    grantExp(expGain)
  }

  if (!state.questClaimed && state.kills >= state.questTarget) {
    state.questClaimed = true
    if (state.mode === 'dungeon') state.dungeonLootTickets += 5
    else grantExp(60)
    toast(state.mode === 'dungeon' ? '世界线任务完成：携带 5 张抽卡券。' : '世界线任务完成：获得 60 经验。抽卡券和法宝请进副本带出。')
  }

  if (state.mode === 'wild' && state.worldStageKills >= worldStageGoal() && !state.bossSpawned) {
    spawnBoss()
  }

  if (state.mode === 'dungeon' && dungeonIsFinalFloor() && state.kills >= state.dungeonGoal && !state.bossSpawned) {
    spawnBoss()
  }
  saveGame()
}

function completeWorldStage() {
  const clearedStage = worldStageNo()
  const clearedTheme = stageTheme(clearedStage)
  const nextStage = clearedStage + 1
  const stoneReward = 28 + clearedStage * 6
  const expReward = 36 + clearedStage * 7
  const skillReward = 1 + Math.floor(clearedStage / 5)
  const dungeonPassDrop = rollWorldBossDungeonPassDrop(clearedStage)
  const materialDrop = worldBossMaterialDrop(clearedStage)
  state.spiritStones += stoneReward
  state.skills.points += skillReward
  state.dungeonEntries += dungeonPassDrop
  grantExp(expReward)
  state.hero.hp = Math.min(maxHp(), state.hero.hp + Math.round(maxHp() * 0.18))
  state.worldStage = nextStage
  state.worldStageKills = 0
  state.wave = Math.max(state.wave + 1, nextStage)
  state.bossSpawned = false
  state.enemies = []
  state.enemySkills = []
  state.soulOrbs = []
  moveTarget = null
  input = { x: 0, y: 0 }
  autoWorldWalk = 0
  beginWorldStageTransition(clearedStage, nextStage)
  sfx.level()
  flashScreen('rgba(250,204,21,.24)', 0.22, 0.26)
  addParticleBurst(state.hero.x, state.hero.y - 72, clearedTheme.accent, 42, 1.24, 'rune')
  state.texts.push({ x: state.hero.x, y: state.hero.y - 134, text: `突破第${clearedStage}关`, color: '#fef08a', life: 1.35 })
  if (dungeonPassDrop > 0) {
    addParticleBurst(state.hero.x, state.hero.y - 104, '#38bdf8', 26, 0.95, 'rune')
    state.texts.push({ x: state.hero.x + 20, y: state.hero.y - 158, text: `副本卷+${dungeonPassDrop}`, color: '#bae6fd', life: 1.15 })
  }
  if (materialDrop) {
    addParticleBurst(state.hero.x - 18, state.hero.y - 92, rarityColor[materialDrop.rarity], 18, 0.9, 'shard')
    state.texts.push({ x: state.hero.x - 12, y: state.hero.y - 154, text: `${materialDrop.name}+${materialDrop.count}`, color: rarityColor[materialDrop.rarity], life: 1.1 })
  }
  state.lastSettlement = `世界 Boss 第${clearedStage}关 | 副本卷 +${dungeonPassDrop} | 灵石 +${stoneReward} | 经验 +${expReward} | 法宝精华 +${skillReward} | 材料：${materialDrop ? `${materialDrop.name} x${materialDrop.count}` : '无'}`
  renderSettlement({
    title: '世界 Boss 战报',
    result: `第${clearedStage}关突破`,
    subtitle: `已击败 ${clearedTheme.name} 的守门 Boss，世界线推进到第${nextStage}关`,
    rank: worldBossSettlementRank(clearedStage, dungeonPassDrop),
    tone: 'world',
    kills: worldStageGoal(clearedStage) + 1,
    rewards: { passes: dungeonPassDrop, stones: stoneReward, exp: expReward, skill: skillReward, materials: materialDrop?.count ?? 0 },
    rewardTiles: [
      { label: '副本卷', value: dungeonPassDrop > 0 ? `+${dungeonPassDrop}` : '未掉', iconHtml: '<span>卷</span>', accent: '#38bdf8' },
      { label: '灵石', value: `+${stoneReward}`, iconHtml: '<span>石</span>', accent: '#facc15' },
      { label: '经验', value: `+${expReward}`, iconHtml: '<span>修</span>', accent: '#5eead4' },
      { label: '法宝精华', value: `+${skillReward}`, iconHtml: '<span>精</span>', accent: '#c084fc' },
      materialDrop
        ? { label: materialDrop.name, value: `x${materialDrop.count}`, iconHtml: materialIcon(materialDrop), accent: rarityColor[materialDrop.rarity] }
        : { label: '材料', value: '+0', iconHtml: '<span>材</span>', accent: '#94a3b8' },
    ],
    lines: [
      `关卡推进：第${clearedStage}关 -> 第${nextStage}关 ${worldStageTitle(nextStage)}`,
      dungeonPassDrop > 0 ? `Boss 掉落：副本卷 +${dungeonPassDrop}` : 'Boss 掉落：本次没有副本卷',
      materialDrop ? `炼材入库：${materialDrop.name} x${materialDrop.count}` : '炼材入库：无',
      `法宝精华 +${skillReward}，可在法宝页升级已获得法宝`,
      `世界主题：${clearedTheme.name} / ${clearedTheme.subtitle}`,
    ],
    drop: materialDrop,
  })
  settlementPanel.hidden = false
  toast(`第${clearedStage}关 Boss 已击败：副本卷 +${dungeonPassDrop}，灵石 +${stoneReward}，精华 +${skillReward}${materialDrop ? `，${materialDrop.name} +${materialDrop.count}` : ''}。`)
}

function completeDungeon() {
  const dungeon = activeDungeonDef()
  const kills = Math.max(0, state.kills - state.dungeonStartKills)
  const floorBonus = state.dungeonMaxFloors
  const ticketReward = state.dungeonLootTickets + dungeon.ticketBonus + floorBonus + Math.floor(kills / 4) + Math.floor(effectiveSkill('banner') / 2)
  const expReward = state.dungeonLootExp + dungeon.expBonus + floorBonus * 12 + kills * 3 + effectiveSkill('seal') * 4
  const skillReward = state.dungeonLootSkill + dungeon.skillBonus + floorBonus + Math.floor(kills / 6) + Math.floor(effectiveSkill('mirror') / 3)
  const stoneReward = state.dungeonLootStones + dungeon.skillBonus * 18 + floorBonus * 26 + kills * 5 + effectiveSkill('mirror') * 2
  const bossDrop = rollDungeonDrop()
  sfx.level()
  flashScreen('rgba(250,204,21,.26)', 0.22, 0.28)

  state.tickets += ticketReward
  state.spiritStones += stoneReward
  grantExp(expReward)
  state.skills.points += skillReward
  const materialDrops = settleDungeonMaterials()
  if (bossDrop) {
    acceptReward(bossDrop)
  }

  state.lastSettlement = `击杀 ${kills} | 抽卡券 +${ticketReward} | 灵石 +${stoneReward} | 经验 +${expReward} | 法宝精华 +${skillReward} | Boss 掉落：${bossDrop.name}`
  renderSettlement({
    result: `${dungeon.name}通关`,
    subtitle: `${dungeon.subtitle}已稳定，战利品已同步回主世界线`,
    rank: dungeonRank(kills, true, true),
    tone: 'clear',
    kills,
    rewards: { tickets: ticketReward, stones: stoneReward, exp: expReward, skill: skillReward },
    lines: [
      `深入层数：${state.dungeonMaxFloors}/${state.dungeonMaxFloors}，最终层 ${dungeonFloorName()}`,
      `门钥碎片：${state.dungeonMaterials}/${state.dungeonMaterialGoal}`,
      dungeonExplorationSummary(),
      materialSettlementText(materialDrops),
      `秘境特性：${dungeon.trait}`,
      `Boss 掉落：${bossDrop.rarity} ${bossDrop.name}`,
      `结算方式：击败守门人后自动带回全部收益`,
    ],
    drop: bossDrop,
  })
  showSettlementPanel(true)
  leaveDungeon('副本通关，结算奖励已发放。')
}

function extractDungeon() {
  const dungeon = activeDungeonDef()
  if (!state.dungeonGateFound) {
    toast(`${dungeonGateLabel()}门未定位，先收集${dungeonFloorName()}门钥 ${state.dungeonMaterials}/${state.dungeonMaterialGoal}。`)
    return
  }
  const distance = Math.hypot(state.hero.x - state.dungeonExtractX, state.hero.y - state.dungeonExtractY)
  if (distance > 78) {
    moveTarget = { x: state.dungeonExtractX, y: state.dungeonExtractY }
    moveTargetPulse = 0.45
    toast(`${dungeonGateLabel()}门太远，已标记蓝色入口。靠近后才能${dungeonIsFinalFloor() ? '撤离' : '进入下一层'}。`)
    return
  }
  if (!dungeonIsFinalFloor()) {
    advanceDungeonFloor()
    return
  }
  const kills = Math.max(0, state.kills - state.dungeonStartKills)
  const depthBonus = state.dungeonFloor
  const ticketReward = state.dungeonLootTickets + Math.floor(depthBonus / 2) + Math.floor(effectiveSkill('banner') / 3)
  const expReward = state.dungeonLootExp + depthBonus * 8 + effectiveSkill('seal') * 2
  const skillReward = state.dungeonLootSkill + Math.max(0, depthBonus - 1) + Math.floor(effectiveSkill('mirror') / 4)
  const stoneReward = state.dungeonLootStones + depthBonus * 18 + kills * 2
  const extractDrop = kills >= 4 && Math.random() < 0.42 ? rollArtifactReward() : null
  sfx.soul(4)
  flashScreen('rgba(94,234,212,.2)', 0.16, 0.22)

  state.tickets += ticketReward
  state.spiritStones += stoneReward
  grantExp(expReward)
  state.skills.points += skillReward
  const materialDrops = settleDungeonMaterials()
  if (extractDrop) acceptReward(extractDrop)

  renderSettlement({
    result: `${dungeon.name}撤离`,
    subtitle: '你在秘境坍塌前带走了携带战利品',
    rank: dungeonRank(kills, true, false),
    tone: 'extract',
    kills,
    rewards: { tickets: ticketReward, stones: stoneReward, exp: expReward, skill: skillReward },
    lines: [
      `撤离层数：第${state.dungeonFloor}/${state.dungeonMaxFloors}层 ${dungeonFloorName()}`,
      `门钥碎片：${state.dungeonMaterials}/${state.dungeonMaterialGoal}`,
      dungeonExplorationSummary(),
      materialSettlementText(materialDrops),
      `当前秘境：${dungeon.subtitle}`,
      `撤离距离：已抵达撤离门`,
      extractDrop ? `撤离搜获：${extractDrop.rarity} ${extractDrop.name}` : '撤离搜获：未发现完整法宝',
      ticketReward + expReward + skillReward + stoneReward > 0 ? '携带收益已全部入账' : '本次携带收益较少，建议多刷几波再撤离',
    ],
    drop: extractDrop,
  })
  showSettlementPanel(true)
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
    rewards: { tickets: 0, stones: 0, exp: 0, skill: 0 },
    lines: [
      reason,
      `失败位置：第${state.dungeonFloor}/${state.dungeonMaxFloors}层 ${dungeonFloorName()}`,
      `遗失携带：抽卡券 ${state.dungeonLootTickets} / 灵石 ${state.dungeonLootStones} / 经验 ${state.dungeonLootExp} / 法宝精华 ${state.dungeonLootSkill}`,
      dungeonExplorationSummary(),
      `门钥碎片：${state.dungeonMaterials}/${state.dungeonMaterialGoal}`,
    ],
  })
  showSettlementPanel(true)
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

function dungeonFloorName(floor = state.dungeonFloor) {
  const names = ['外层', '中层', '深层', '核心层']
  return names[Math.min(names.length - 1, Math.max(0, floor - 1))]
}

function dungeonIsFinalFloor() {
  return state.dungeonFloor >= state.dungeonMaxFloors
}

function dungeonFloorKillGoal(dungeon = activeDungeonDef(), floor = state.dungeonFloor) {
  if (dungeonTier(dungeon) <= 1) return Math.max(3, 2 + floor)
  return Math.max(4, Math.ceil(dungeon.killGoal / state.dungeonMaxFloors) + floor)
}

function dungeonFloorKills() {
  return Math.max(0, state.kills - state.dungeonFloorStartKills)
}

function dungeonGateLabel() {
  return dungeonIsFinalFloor() ? '撤离' : '下层'
}

function placeDungeonGate() {
  const extractAngle = Math.random() * Math.PI * 2
  const extractDistance = 260 + Math.random() * 180 + Math.max(0, state.dungeonMaterialGoal - 3) * 20
  state.dungeonExtractX = state.hero.x + (Math.cos(extractAngle) < 0 ? -1 : 1) * extractDistance
  state.dungeonExtractY = state.hero.y
}

function prepareDungeonFloor(floor: number) {
  const dungeon = activeDungeonDef()
  state.dungeonFloor = Math.max(1, Math.min(state.dungeonMaxFloors, floor))
  state.dungeonFloorStartKills = state.kills
  state.dungeonMaterialGoal = Math.max(2, dungeon.materialGoal + state.dungeonFloor - 2)
  state.dungeonMaterials = 0
  state.dungeonGateFound = false
  state.bossSpawned = false
  state.dungeonGoal = state.kills + dungeonFloorKillGoal(dungeon)
  state.enemies = []
  state.enemySkills = []
  state.soulOrbs = []
  placeDungeonGate()
}

function advanceDungeonFloor() {
  if (dungeonIsFinalFloor()) return false
  const from = state.dungeonFloor
  prepareDungeonFloor(from + 1)
  state.dungeonTime += 24
  moveTarget = null
  input = { x: 0, y: 0 }
  sfx.gacha(2)
  flashScreen('rgba(56,189,248,.2)', 0.16, 0.22)
  addParticleBurst(state.hero.x, state.hero.y - 62, activeStageTheme().accent, 34, 1.05, 'rune')
  toast(`进入${activeDungeonDef().name}第${state.dungeonFloor}/${state.dungeonMaxFloors}层：${dungeonFloorName()}。携带收益继续累计。`)
  saveGame()
  return true
}

function dungeonExplorationSummary() {
  return `${dungeonFloorName()}门钥：${state.dungeonMaterials}/${state.dungeonMaterialGoal}，层数 ${state.dungeonFloor}/${state.dungeonMaxFloors}`
}

function materialReward(kind: MaterialKind, count: number): Reward {
  const def = materialDefs[kind]
  return { name: def.name, rarity: def.rarity, count, material: kind }
}

function addMaterialToBag(kind: MaterialKind, count: number) {
  if (count <= 0) return null
  const existing = state.bag.find((item) => item.material === kind)
  if (existing) existing.count += count
  else state.bag.unshift(materialReward(kind, count))
  return materialReward(kind, count)
}

function settleDungeonMaterials() {
  return [
    addMaterialToBag('herb', state.dungeonHerbs),
    addMaterialToBag('ore', state.dungeonOres),
    addMaterialToBag('relic', state.dungeonChests),
  ].filter((item): item is Reward => !!item)
}

function materialSettlementText(materials: Reward[]) {
  return materials.length
    ? `带回炼材：${materials.map((item) => `${item.name} x${item.count}`).join(' / ')}`
    : '带回炼材：无'
}

function renderSettlement(options: {
  title?: string
  result: string
  subtitle: string
  rank: string
  tone: SettlementTone
  kills: number
  rewards: SettlementRewards
  rewardTiles?: SettlementRewardTile[]
  lines: string[]
  drop?: Reward | null
}) {
  settlementTitle.textContent = options.title ?? '副本结算'
  const rewardTotal = Object.values(options.rewards).reduce((total, value) => total + (Number(value) || 0), 0)
  const rewardTiles = options.rewardTiles ?? [
    { label: '抽卡券', value: `+${options.rewards.tickets ?? 0}`, iconHtml: '<span>券</span>', accent: '#38bdf8' },
    { label: '灵石', value: `+${options.rewards.stones ?? 0}`, iconHtml: '<span>石</span>', accent: '#facc15' },
    { label: '经验', value: `+${options.rewards.exp ?? 0}`, iconHtml: '<span>修</span>', accent: '#5eead4' },
    { label: '法宝精华', value: `+${options.rewards.skill ?? 0}`, iconHtml: '<span>精</span>', accent: '#c084fc' },
  ]
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
        ${rewardTiles.map((tile) => `<div class="settlement-reward-tile" style="--reward-accent:${tile.accent ?? '#38bdf8'}"><i class="settlement-reward-icon">${tile.iconHtml ?? `<span>${tile.label.slice(0, 1)}</span>`}</i><small>${tile.label}</small><b>${tile.value}</b></div>`).join('')}
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

function clearSettlementAutoClose() {
  if (settlementAutoCloseTimer === null) return
  window.clearTimeout(settlementAutoCloseTimer)
  settlementAutoCloseTimer = null
}

function showSettlementPanel(autoClose = false) {
  clearSettlementAutoClose()
  settlementPanel.hidden = false
  if (!autoClose) return
  settlementAutoCloseTimer = window.setTimeout(() => {
    settlementPanel.hidden = true
    settlementAutoCloseTimer = null
  }, 3000)
}

function leaveDungeon(message: string) {
  state.mode = 'wild'
  state.dungeonTime = 0
  state.hero.hp = Math.max(state.hero.hp, Math.round(maxHp() * 0.65))
  state.bossSpawned = false
  state.enemies = []
  state.enemySkills = []
  state.soulOrbs = []
  state.dungeonLootTickets = 0
  state.dungeonLootExp = 0
  state.dungeonLootSkill = 0
  state.dungeonLootStones = 0
  state.dungeonHerbs = 0
  state.dungeonOres = 0
  state.dungeonChests = 0
  state.dungeonMaterials = 0
  state.dungeonFloor = 1
  state.dungeonMaxFloors = 3
  state.dungeonFloorStartKills = state.kills
  state.dungeonGateFound = false
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
    placeDungeonGate()
    flashScreen('rgba(56,189,248,.18)', 0.15, 0.18)
    toast(dungeonIsFinalFloor() ? '门钥完整，撤离门已显现。' : `门钥完整，通往第${state.dungeonFloor + 1}层的入口已显现。`)
  } else {
    toast(`获得${label}：${dungeonFloorName()} ${state.dungeonMaterials}/${state.dungeonMaterialGoal}`)
  }
}

function attack(radius: number, multiplier: number, source: AttackSource = multiplier > 1 ? 'skill' : 'manual') {
  if (multiplier <= 1) return false
  if (state.skillCd > 0) return false
  const inRange = state.enemies
    .filter((enemy) => enemyVisibleForCombat(enemy) && Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) < radius)
    .sort((a, b) => Math.hypot(a.x - state.hero.x, a.y - state.hero.y) - Math.hypot(b.x - state.hero.x, b.y - state.hero.y))
  if (inRange.length === 0) {
    if (source !== 'skill') toast('目标太远。')
    return false
  }
  const hits = inRange.slice(0, 5 + state.mutations.swordDomain)
  const attackFacing = Math.atan2(hits[0].y - state.hero.y, hits[0].x - state.hero.x)
  if (!heroIsMoving()) heroFacing = attackFacing
  const direction = Math.cos(attackFacing) < 0 ? -1 : 1
  lastAttackFlash = performance.now()
  sfx.slash(true)
  addSlashParticles(state.hero.x + direction * 86, state.hero.y, attackFacing, '#67e8f9', true)
  flashScreen('rgba(103,232,249,.16)', 0.13, 0.14)
  hits.forEach((enemy) => damageEnemy(enemy, Math.round((totalAtk() + skillPower()) * multiplier)))
  state.effects.push({
    x: state.hero.x + direction * 96,
    y: state.hero.y,
    radius: Math.max(radius, 220 + state.mutations.swordDomain * 30),
    color: '#67e8f9',
    life: 0.46 + state.mutations.swordDomain * 0.05,
    maxLife: 0.46 + state.mutations.swordDomain * 0.05,
    kind: 'shockwave',
    angle: attackFacing,
  })
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
  state.skillCd = 4.5
  advanceGuide(1)
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
  const def = artifactDefs[key]
  const before = artifactLevel(key)
  const gain = Math.max(1, reward.count)
  const next = Math.min(def.max, before + gain)
  const applied = Math.max(0, next - before)
  const overflow = gain - applied
  state.artifacts[key] = next
  state.skills[key] = state.artifacts[key]
  const essence = Math.max(1, rarityRank[reward.rarity] - 1)
  const refundEssence = before > 0 ? Math.max(1, overflow) * essence : overflow * essence
  const refundStones = refundEssence * 18
  if (before > 0) {
    state.skills.points += refundEssence
    state.spiritStones += refundStones
  }
  const label = before <= 0
    ? `获得法宝：${def.name}`
    : applied > 0
      ? `${def.name} 淬炼 +${applied}${overflow > 0 ? `，满级返还精华+${overflow * essence}` : ''}`
      : `${def.name} 已满级，返还精华+${refundEssence}`
  toast(label)
  sfx.gacha(rarityRank[reward.rarity])
  flashScreen('rgba(250,204,21,.2)', 0.18, 0.22)
  addParticleBurst(state.hero.x, state.hero.y - 90, def.color, 34, 1.18, 'rune')
  state.texts.push({ x: state.hero.x, y: state.hero.y - 108, text: label, color: def.color, life: 1.3 })
  syncArtifactMutation(key)
  if (!skillPanel.hidden) renderSkillPanel()
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
      life: 34,
      phase: Math.random() * Math.PI * 2,
    })
  }
}

function collectSoulOrbs(dt: number) {
  const magnetRange = soulMagnetRange()
  for (const orb of state.soulOrbs) {
    const dx = state.hero.x - orb.x
    const dy = state.hero.y - orb.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    if (distance < magnetRange) {
      const ratio = 1 - distance / magnetRange
      const pull = 360 + ratio * 920 + state.hero.level * 2.2
      orb.x += (dx / distance) * pull * dt
      orb.y += (dy / distance) * pull * dt
    }
    orb.life -= distance < magnetRange ? dt * 0.34 : dt
  }

  const remaining: SoulOrb[] = []
  let gained = 0
  for (const orb of state.soulOrbs) {
    const distance = Math.hypot(orb.x - state.hero.x, orb.y - state.hero.y)
    if (distance < 44) {
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
  // 不在此处存档；由游戏循环每 30 秒自动存档，避免高频 localStorage 写入
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
    toast(`需要达到 ${cultivationRealm(dungeon.unlockLevel)} 才能进入 ${dungeon.name}。`)
    updateHud()
    return
  }
  if (state.dungeonEntries <= 0) {
    toast('副本入场卷不足：明天补足到 3 张，也可以击败世界地图 Boss 掉落。')
    updateHud()
    return
  }
  state.activeDungeon = dungeon.id
  state.dungeonEntries -= 1
  state.mode = 'dungeon'
  state.enemies = []
  state.enemySkills = []
  state.soulOrbs = []
  state.dungeonTime = dungeon.timeLimit + 54
  state.dungeonStartKills = state.kills
  state.dungeonMaxFloors = 3
  state.dungeonLootTickets = 0
  state.dungeonLootExp = 0
  state.dungeonLootSkill = 0
  state.dungeonLootStones = 0
  state.dungeonHerbs = 0
  state.dungeonOres = 0
  state.dungeonChests = 0
  state.hero.hp = maxHp()
  prepareDungeonFloor(1)
  sfx.gacha(3)
  flashScreen('rgba(56,189,248,.18)', 0.16, 0.2)
  toast(`${dungeon.name}开启：第1/${state.dungeonMaxFloors}层。收集门钥逐层深入，最终层击败 Boss 后带走法宝。`)
  advanceGuide(4)
  showPage('battle')
  saveGame()
}

function update(dt: number) {
  if (!evolutionPanel.hidden) {
    updateHud()
    return
  }
  state.screenShake = 0
  state.hitStop = 0
  state.skillCd = Math.max(0, state.skillCd - dt)
  state.chainCd = Math.max(0, state.chainCd - dt)
  state.orbitCd = Math.max(0, state.orbitCd - dt)
  state.flameCd = Math.max(0, state.flameCd - dt)
  state.characterSkillCd = Math.max(0, state.characterSkillCd - dt)
  autoSkillCastGap = Math.max(0, autoSkillCastGap - dt)
  if (worldStageTransition) {
    worldStageTransition.life -= dt
    if (worldStageTransition.life <= 0) worldStageTransition = null
  }
  moveTargetPulse = Math.max(0, moveTargetPulse - dt)
  updateClickMovement(dt)
  const autoSpeed = autoWorldSpeed()
  autoWorldWalk = autoSpeed
  const autoMove = autoPickupMovement(autoSpeed)
  state.hero.x += autoMove.x * dt
  state.hero.y += autoMove.y * dt
  state.hero.y = Math.max(-44, Math.min(44, state.hero.y))
  if (state.mode === 'dungeon' && state.dungeonGateFound && !dungeonIsFinalFloor()) {
    const gateDistance = Math.hypot(state.hero.x - state.dungeonExtractX, state.hero.y - state.dungeonExtractY)
    if (gateDistance < 58) {
      advanceDungeonFloor()
      updateHud()
      return
    }
  }
  if (manualMoving()) heroFacing = input.x < -0.08 ? Math.PI : 0
  else if (autoMove.x > 0) heroFacing = 0
  else if (autoMove.x < -0.08) heroFacing = Math.PI

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
    tryStartEnemySkill(enemy, d, dt)
    const castSlow = (enemy.casting ?? 0) > 0 ? (enemy.boss ? 0.42 : 0.28) : 1
    enemy.x += (dx / d) * enemy.speed * castSlow * dt
    enemy.y += (dy / d) * enemy.speed * 0.35 * castSlow * dt
    enemy.y = Math.max(-52, Math.min(52, enemy.y))
    enemy.hit = Math.max(0, enemy.hit - dt)
    enemy.attack = Math.max(0, (enemy.attack ?? 0) - dt)
    enemy.attackCd = Math.max(0, (enemy.attackCd ?? 0) - dt)
    if (d < (enemy.boss ? 92 : enemy.elite ? 72 : 58) && (enemy.casting ?? 0) <= 0 && (enemy.attackCd ?? 0) <= 0) {
      enemy.attack = enemy.boss ? 0.5 : enemy.elite ? 0.36 : 0.3
      enemy.attackCd = enemy.boss ? 1.08 : enemy.elite ? 0.92 : 0.78
    }
    if (d < 34) {
      const contactDamage = state.mode === 'dungeon' ? (enemy.elite ? 4.5 : 1.8) : (enemy.elite ? 10 : 5)
      state.hero.hp = Math.max(0, state.hero.hp - contactDamage * dt)
    }
  }
  updateEnemySkills(dt)
  collectSoulOrbs(dt)
  if (autoSkillCastGap <= 0) {
    const casted = autoCharacterSkill()
      || autoChainLightning()
      || autoOrbitBlade()
      || autoFlameBurst()
      || autoSkill()
    if (casted) autoSkillCastGap = 0.18
  }

  if (state.hero.hp <= 0) {
    state.hero.hp = maxHp()
    state.hero.x = 0
    state.hero.y = 0
    if (state.mode === 'dungeon') failDungeon('生命耗尽，副本收益遗失。')
    else {
      state.enemies = []
      state.enemySkills = []
      toast('生命耗尽，已在安全点复活。')
    }
  }

  state.texts.forEach((text) => {
    text.y -= 30 * dt
    text.life -= dt
  })
  state.texts = state.texts.filter((text) => text.life > 0)
  state.effects.forEach((effect) => { effect.life -= dt })
  state.effects = state.effects.filter((effect) => effect.life > 0).slice(-58)
  state.particles.forEach((particle) => {
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vx *= 0.985
    particle.vy += (particle.kind === 'ember' ? -8 : particle.kind === 'soul' ? -24 : 62) * dt
    particle.life -= dt
  })
  state.particles = state.particles.filter((particle) => particle.life > 0).slice(-140)
  if (state.screenFlash) {
    state.screenFlash.life -= dt
    if (state.screenFlash.life <= 0) state.screenFlash = null
  }
  claimMainQuestIfReady()
  updateHud()
}

function autoCharacterSkill() {
  if (state.characterSkillCd > 0 || state.enemies.length === 0) return false
  if (state.activeCharacter !== 'sword') return false
  const target = nearestEnemy()
  if (!target) return false
  const pierceRank = state.techniques.swordPierce
  const returnRank = state.techniques.swordReturn
  const shadowRank = state.techniques.swordShadow
  const range = 320 + state.hero.level * 2 + effectiveSkill('slash') * 8 + pierceRank * 22
  const distance = Math.hypot(target.x - state.hero.x, target.y - state.hero.y)
  if (distance > range) return false

  const start = { x: state.hero.x, y: state.hero.y - 60 }
  const targetLift = target.boss ? 74 : target.elite ? 48 : 42
  const firstHit = { x: target.x, y: target.y - targetLift }
  const angle = Math.atan2(firstHit.y - start.y, firstHit.x - start.x)
  const dirX = Math.cos(angle)
  const dirY = Math.min(0.18, Math.sin(angle))
  const minFlightY = Math.min(start.y, firstHit.y) - 34
  const maxFlightY = Math.max(start.y, firstHit.y) + 18
  const flightEnd = {
    x: firstHit.x + dirX * (170 + pierceRank * 34 + Math.min(100, effectiveSkill('slash') * 10)),
    y: Math.max(minFlightY, Math.min(maxFlightY, firstHit.y + dirY * (92 + pierceRank * 14))),
  }
  const flightDistance = Math.hypot(flightEnd.x - start.x, flightEnd.y - start.y)
  const arcSign = Math.sin(performance.now() * 0.0017 + enemyId) >= 0 ? 1 : -1
  heroFacing = Math.cos(angle) < 0 ? Math.PI : 0
  lastAttackFlash = performance.now()
  state.characterSkillCd = Math.max(0.72, 1.9 - returnRank * 0.12 - state.autoHaste * 0.045 - effectiveSkill('fan') * 0.04 - effectiveSkill('slash') * 0.018)
  sfx.slash(true)
  addParticleBurst(start.x, start.y, '#a5f3fc', 10, 0.78, 'shard')
  state.effects.push({
    x: start.x,
    y: start.y,
    tx: flightEnd.x,
    ty: flightEnd.y,
    radius: flightDistance,
    color: '#a5f3fc',
    life: 0.82,
    maxLife: 0.82,
    kind: 'swordflight',
    angle,
    arc: arcSign,
  })

  const slashLevel = effectiveSkill('slash')
  const damage = Math.round(totalAtk() * (1.05 + slashLevel * 0.045 + pierceRank * 0.06) + skillPower() * 0.16 + state.hero.level * 2.4)
  const pierceWidth = 50 + slashLevel * 2.2 + pierceRank * 4
  const maxPierce = 2 + pierceRank + Math.min(5, Math.floor(slashLevel / 2))
  const pierced = state.enemies
    .filter((enemy) => enemyVisibleForCombat(enemy) && distanceToSegment({ x: enemy.x, y: enemy.y - (enemy.boss ? 58 : 30) }, start, flightEnd) <= pierceWidth)
    .sort((a, b) => ((a.x - start.x) * dirX + (a.y - start.y) * dirY) - ((b.x - start.x) * dirX + (b.y - start.y) * dirY))
    .slice(0, maxPierce)

  if (!pierced.some((enemy) => enemy.id === target.id)) pierced.unshift(target)
  pierced.forEach((enemy, index) => {
    damageEnemy(enemy, Math.round(damage * Math.max(0.38, 1 - index * 0.13)))
    if (index > 0) addParticleBurst(enemy.x, enemy.y - 42, '#a5f3fc', 8, 0.62, 'shard')
  })
  if (returnRank > 0) {
    state.enemies
      .filter((enemy) => enemyVisibleForCombat(enemy) && distanceToSegment({ x: enemy.x, y: enemy.y - 28 }, flightEnd, { x: state.hero.x, y: state.hero.y - 52 }) <= 38 + returnRank * 5)
      .slice(0, 1 + returnRank)
      .forEach((enemy) => damageEnemy(enemy, Math.round(damage * (0.2 + returnRank * 0.04))))
  }
  const shadowCount = Math.min(3, shadowRank)
  for (let i = 0; i < shadowCount; i += 1) {
    const offset = (i - (shadowCount - 1) / 2) * 24
    state.effects.push({
      x: start.x,
      y: start.y + offset,
      tx: flightEnd.x,
      ty: flightEnd.y + offset * 0.45,
      radius: flightDistance,
      color: i % 2 === 0 ? '#fef08a' : '#bae6fd',
      life: 0.62,
      maxLife: 0.62,
      kind: 'swordflight',
      angle,
      arc: -arcSign + i * 0.35,
    })
  }
  if (shadowRank > 0) {
    state.enemies
      .filter((enemy) => enemyVisibleForCombat(enemy) && enemy.id !== target.id && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 105 + shadowRank * 18)
      .slice(0, shadowRank)
      .forEach((enemy) => damageEnemy(enemy, Math.round(damage * 0.34)))
  }
  announceSkill(shadowRank > 0 ? '御剑术·分光' : '御剑术', '本命术发动', '#a5f3fc')
  return true
}

function autoSkill() {
  const burstLevel = effectiveSkill('burst')
  if (burstLevel <= 0 || state.skillCd > 0 || state.enemies.length < 2) return false
  const target = nearestEnemy()
  if (!target) return false
  const distance = Math.hypot(target.x - state.hero.x, target.y - state.hero.y)
  const domainLevel = state.mutations.swordDomain
  const range = 190 + burstLevel * 10 + domainLevel * 34
  if (distance <= range && attack(range, 1.8 + burstLevel * 0.16 + domainLevel * 0.18, 'skill')) {
    announceSkill(domainLevel >= 3 ? '破虚剑罡·满屏' : domainLevel > 0 ? '破虚剑罡·剑域' : '破虚剑罡', artifactDefs.slash.name, artifactDefs.slash.color)
    return true
  }
  return false
}

function autoChainLightning() {
  const chainSkill = effectiveSkill('chain')
  if (chainSkill <= 0 || state.chainCd > 0 || state.enemies.length === 0) return false
  const forkLevel = state.mutations.thunderFork
  const targets = state.enemies
    .filter((enemy) => enemyVisibleForCombat(enemy) && Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) <= 330 + forkLevel * 42)
    .sort((a, b) => Math.hypot(a.x - state.hero.x, a.y - state.hero.y) - Math.hypot(b.x - state.hero.x, b.y - state.hero.y))
    .slice(0, 2 + Math.floor(chainSkill / 3) + forkLevel)
  if (targets.length === 0) return false
  sfx.thunder()
  flashScreen('rgba(186,230,253,.18)', forkLevel >= 2 ? 0.18 : 0.11, 0.14)
  addParticleBurst(state.hero.x, state.hero.y - 90, '#bae6fd', 12 + forkLevel * 6, 0.9 + forkLevel * 0.18, 'rune')
  announceSkill(forkLevel >= 3 ? '九霄雷云·满屏' : forkLevel > 0 ? '九霄雷引·分裂' : '九霄雷引', artifactDefs.chain.name, '#bae6fd')
  state.effects.push({
    x: state.hero.x,
    y: state.hero.y - 72,
    radius: 118 + chainSkill * 8 + forkLevel * 22,
    color: '#bae6fd',
    life: 0.52,
    maxLife: 0.52,
    kind: 'thunderseal',
    arc: 1 + forkLevel,
  })
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
      arc: 2 + forkLevel,
    })
    state.enemies
      .filter((enemy) => enemyVisibleForCombat(enemy) && Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) <= stormRadius)
      .slice(0, 12 + forkLevel * 8)
      .forEach((enemy) => damageEnemy(enemy, Math.round(totalAtk() * 0.22 + skillPower() * 0.46)))
  }
  let from: Vec = state.hero
  const visualTargetLimit = 4 + forkLevel
  targets.forEach((enemy, index) => {
    damageEnemy(enemy, Math.round((totalAtk() * 0.52 + skillPower() * 0.62) * (1 + chainSkill * 0.08)))
    if (index < visualTargetLimit) {
      addParticleBurst(enemy.x, enemy.y - 54, '#bae6fd', 6, 0.72, 'spark')
      state.effects.push({
        x: enemy.x,
        y: enemy.y - 58,
        radius: 66 + chainSkill * 2 + forkLevel * 8,
        color: index === 0 ? '#38bdf8' : '#a5f3fc',
        life: 0.32,
        maxLife: 0.32,
        kind: 'thunderseal',
        arc: 1 + forkLevel,
      })
      state.effects.push({
        x: (from.x + enemy.x) / 2,
        y: (from.y + enemy.y) / 2 - 36,
        radius: Math.hypot(enemy.x - from.x, enemy.y - from.y),
        color: index === 0 ? '#38bdf8' : '#a5f3fc',
        life: 0.18,
        maxLife: 0.18,
        kind: 'bolt',
        angle: Math.atan2(enemy.y - from.y, enemy.x - from.x),
        arc: 1 + forkLevel,
      })
    }
    if (forkLevel > 0 && index > 0 && index <= 3) {
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
        .filter((other) => enemyVisibleForCombat(other) && other.id !== enemy.id && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 140 + forkLevel * 30)
        .slice(0, Math.min(2, forkLevel + 1))
      nearby.forEach((other, forkIndex) => {
        damageEnemy(other, Math.round((totalAtk() * 0.28 + skillPower() * 0.34) * (1 + forkLevel * 0.08)))
        state.effects.push({
          x: other.x,
          y: other.y - 54,
          radius: 52 + forkLevel * 8,
          color: '#e0f2fe',
          life: 0.28,
          maxLife: 0.28,
          kind: 'thunderseal',
          arc: 1 + Math.max(1, forkLevel - 1),
        })
        state.effects.push({
          x: (enemy.x + other.x) / 2,
          y: (enemy.y + other.y) / 2 - 58 - forkIndex * 8,
          radius: Math.hypot(other.x - enemy.x, other.y - enemy.y),
          color: '#e0f2fe',
          life: 0.18,
          maxLife: 0.18,
          kind: 'bolt',
          angle: Math.atan2(other.y - enemy.y, other.x - enemy.x),
          arc: Math.max(1, forkLevel),
        })
      })
    }
    from = enemy
  })
  state.chainCd = Math.max(1.8, 5.8 - chainSkill * 0.28 - forkLevel * 0.22)
  return true
}

function autoOrbitBlade() {
  const orbitSkill = effectiveSkill('orbit')
  if (orbitSkill <= 0 || state.orbitCd > 0) return false
  const domainLevel = state.mutations.swordDomain
  const radius = 92 + orbitSkill * 12 + domainLevel * 24
  const targets = state.enemies
    .filter((enemy) => enemyVisibleForCombat(enemy) && Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y) <= radius)
    .slice(0, 3 + Math.floor(orbitSkill / 2) + domainLevel)
  if (targets.length === 0 && domainLevel <= 0) return false
  sfx.orbit()
  addParticleBurst(state.hero.x, state.hero.y - 34, '#e0f2fe', 16 + domainLevel * 8, 0.9 + domainLevel * 0.16, 'shard')
  if (domainLevel >= 2) flashScreen('rgba(224,242,254,.14)', 0.12, 0.13)
  announceSkill(domainLevel >= 3 ? '万剑剑域·满屏' : domainLevel > 0 ? '护体剑阵·剑域' : '护体剑阵', artifactDefs.orbit.name, '#e0f2fe')
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
  return true
}

function autoFlameBurst() {
  const flameSkill = effectiveSkill('flame')
  if (flameSkill <= 0 || state.flameCd > 0 || state.enemies.length < 2) return false
  const lotusLevel = state.mutations.flameLotus
  const target = state.enemies
    .filter((enemy) => enemyVisibleForCombat(enemy))
    .map((enemy) => ({
      enemy,
      score: state.enemies.filter((other) => enemyVisibleForCombat(other) && Math.hypot(other.x - enemy.x, other.y - enemy.y) < 120).length,
    }))
    .sort((a, b) => b.score - a.score)[0]
  if (!target || target.score < 2 || Math.hypot(target.enemy.x - state.hero.x, target.enemy.y - state.hero.y) > 380) return false
  const radius = 96 + flameSkill * 8 + lotusLevel * 14
  sfx.flame()
  flashScreen('rgba(251,146,60,.18)', lotusLevel >= 2 ? 0.2 : 0.12, 0.16)
  addParticleBurst(target.enemy.x, target.enemy.y - 42, '#fb923c', 22 + lotusLevel * 8, 1 + lotusLevel * 0.18, 'ember')
  announceSkill(lotusLevel >= 3 ? '莲火符海·满屏' : lotusLevel > 0 ? '莲火符阵·连爆' : '莲火符阵', artifactDefs.flame.name, '#fed7aa')
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
    .filter((enemy) => enemyVisibleForCombat(enemy) && Math.hypot(enemy.x - target.enemy.x, enemy.y - target.enemy.y) <= radius)
    .forEach((enemy) => damageEnemy(enemy, Math.round(skillPower() * (0.8 + lotusLevel * 0.1) + totalAtk() * (0.5 + flameSkill * 0.08))))
  if (lotusLevel > 0) {
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
        .filter((enemy) => enemyVisibleForCombat(enemy) && Math.hypot(enemy.x - target.enemy.x, enemy.y - target.enemy.y) <= seaRadius)
        .slice(0, 14 + lotusLevel * 8)
        .forEach((enemy) => damageEnemy(enemy, Math.round(skillPower() * 0.45 + totalAtk() * 0.22)))
    }
    const sideTargets = state.enemies
      .filter((enemy) => enemyVisibleForCombat(enemy) && Math.hypot(enemy.x - target.enemy.x, enemy.y - target.enemy.y) <= radius + 70)
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
  return true
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function tierRank(tier: EvolutionTier) {
  return tier === '高阶' ? 3 : tier === '进阶' ? 2 : 1
}

function evolutionRequiredArtifact(id: string): ArtifactKey | null {
  if (id.startsWith('artifact-')) return id.replace('artifact-', '') as ArtifactKey
  if (id === 'blade' || id === 'mutate-ride') return 'slash'
  if (id === 'nova') return 'burst'
  if (id === 'chain' || id === 'mutate-thunder') return 'chain'
  if (id === 'orbit' || id === 'mutate-domain' || id === 'sweep') return 'orbit'
  if (id === 'flame' || id === 'mutate-flame') return 'flame'
  return null
}

function mutationLevelForOption(id: string) {
  if (id === 'mutate-ride') return state.mutations.swordRide
  if (id === 'mutate-thunder') return state.mutations.thunderFork
  if (id === 'mutate-domain') return state.mutations.swordDomain
  if (id === 'mutate-flame') return state.mutations.flameLotus
  return 0
}

function characterTechniqueTemplates(): EvolutionTemplate[] {
  if (state.activeCharacter !== 'sword') return []
  return [
    {
      id: 'tech-sword-pierce',
      title: '御剑·穿云',
      color: '#67e8f9',
      build: (power: number, cardTier: EvolutionTier) => ({
        id: 'tech-sword-pierce',
        iconId: power >= 3 ? 'blade-3' : power >= 2 ? 'blade-2' : 'blade-1',
        title: '御剑·穿云',
        tier: cardTier,
        color: '#67e8f9',
        desc: `御剑术穿刺目标 +1，出剑距离和主剑伤害提升。`,
        apply: () => {
          state.techniques.swordPierce = Math.min(techniqueMaxLevel, state.techniques.swordPierce + 1)
          state.characterSkillCd = 0
        },
      }),
    },
    {
      id: 'tech-sword-return',
      title: '御剑·回锋',
      color: '#fef08a',
      build: (power: number, cardTier: EvolutionTier) => ({
        id: 'tech-sword-return',
        iconId: power >= 3 ? 'sweep-3' : power >= 2 ? 'sweep-2' : 'sweep-1',
        title: '御剑·回锋',
        tier: cardTier,
        color: '#fef08a',
        desc: `飞剑回身会二次刮过敌人，御剑术冷却缩短。`,
        apply: () => {
          state.techniques.swordReturn = Math.min(techniqueMaxLevel, state.techniques.swordReturn + 1)
          state.characterSkillCd = 0
        },
      }),
    },
    {
      id: 'tech-sword-shadow',
      title: '御剑·分光',
      color: '#bae6fd',
      build: (power: number, cardTier: EvolutionTier) => ({
        id: 'tech-sword-shadow',
        iconId: power >= 3 ? 'orbit-3' : power >= 2 ? 'orbit-2' : 'orbit-1',
        title: '御剑·分光',
        tier: cardTier,
        color: '#bae6fd',
        desc: `御剑术附带剑影，最多同时飞出 ${Math.min(3, state.techniques.swordShadow + 1)} 道分光。`,
        apply: () => {
          state.techniques.swordShadow = Math.min(techniqueMaxLevel, state.techniques.swordShadow + 1)
          state.characterSkillCd = 0
        },
      }),
    },
  ].filter((option) => {
    if (option.id === 'tech-sword-pierce') return state.techniques.swordPierce < techniqueMaxLevel
    if (option.id === 'tech-sword-return') return state.techniques.swordReturn < techniqueMaxLevel
    if (option.id === 'tech-sword-shadow') return state.techniques.swordShadow < techniqueMaxLevel
    return true
  })
}

function evolutionOptions(): EvolutionOption[] {
  const tier: EvolutionTier = '初阶'
  const rank = 1
  const pool: EvolutionTemplate[] = [
    {
      id: 'blade',
      title: '本命飞剑',
      color: '#f97316',
      build: (_power, cardTier) => ({
        id: 'blade',
        iconId: 'blade-1',
        title: '本命飞剑',
        tier: cardTier,
        color: '#f97316',
        desc: `御剑术立即出手，飞剑轨迹更宽，不提升法宝等级。`,
        apply: () => {
          state.characterSkillCd = 0
        },
      }),
    },
    {
      id: 'quick',
      title: '踏风御剑',
      color: '#38bdf8',
      build: (_power, cardTier) => ({
        id: 'quick',
        iconId: 'quick-1',
        title: '踏风御剑',
        tier: cardTier,
        color: '#38bdf8',
        desc: `调整御剑节奏，本命术出手更快，不提升法宝等级。`,
        apply: () => {
          state.autoHaste += 1
          state.characterSkillCd = 0
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
        title: mutationNextTitle('飞剑化虹', state.mutations.swordRide),
        tier: cardTier,
        color: '#67e8f9',
        mutation: true,
        desc: mutationNextDesc(
          state.mutations.swordRide,
          '脚下本命飞剑显形，野外推进更快，本命术开始追击更多目标。',
          '御剑速度继续提升，本命术额外锁定目标。',
          '化虹形态稳定，野外推进和本命术追击达到当前上限。',
        ),
        apply: () => {
          state.mutations.swordRide = Math.min(mutationMaxLevel, state.mutations.swordRide + 1)
          state.autoHaste += 1
          state.characterSkillCd = 0
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
        title: mutationNextTitle('雷印分裂', state.mutations.thunderFork),
        tier: cardTier,
        color: '#38bdf8',
        mutation: true,
        desc: mutationNextDesc(
          state.mutations.thunderFork,
          '九霄雷诀留下雷印，后续可分裂出更多雷链。',
          '雷印弹射目标增加，并开始铺开连锁雷云。',
          '雷印大成，雷云形态达到当前满屏上限。',
        ),
        apply: () => {
          state.mutations.thunderFork = Math.min(mutationMaxLevel, state.mutations.thunderFork + 1)
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
        title: mutationNextTitle('万剑剑域', state.mutations.swordDomain),
        tier: cardTier,
        color: '#a5f3fc',
        mutation: true,
        desc: mutationNextDesc(
          state.mutations.swordDomain,
          '护体剑阵变成剑域，开始向外扩张。',
          '剑域继续扩大，万剑数量明显增加。',
          '剑域大成，万剑落屏达到当前表现上限。',
        ),
        apply: () => {
          state.mutations.swordDomain = Math.min(mutationMaxLevel, state.mutations.swordDomain + 1)
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
        title: mutationNextTitle('莲火符海', state.mutations.flameLotus),
        tier: cardTier,
        color: '#fb923c',
        mutation: true,
        desc: mutationNextDesc(
          state.mutations.flameLotus,
          '离火符阵分裂成莲火符海，开始持续铺场。',
          '符火数量增加，莲火覆盖范围扩大。',
          '莲火大成，符海铺满战场达到当前上限。',
        ),
        apply: () => {
          state.mutations.flameLotus = Math.min(mutationMaxLevel, state.mutations.flameLotus + 1)
          state.flameCd = 0
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
        desc: `唤出剑阵扫荡周围敌人，不改变角色基础数值。`,
        apply: () => {
          const radius = 170 + power * 35
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
  const characterGrowthPool = characterTechniqueTemplates()
  const fallbackGrowthPool = pool.filter((option) => ['blade', 'quick', 'sweep'].includes(option.id))
  const mutationPool = pool.filter((option) => {
    if (!option.id.startsWith('mutate-')) return false
    if (mutationLevelForOption(option.id) >= mutationMaxLevel) return false
    const required = evolutionRequiredArtifact(option.id)
    return required ? hasArtifact(required) : false
  })
  const directGrowthPool = characterGrowthPool
  const growthPool = directGrowthPool.length >= 3 ? directGrowthPool : [...directGrowthPool, ...fallbackGrowthPool]
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

function evolutionArt(optionId: string, iconId: string) {
  const artByOption: Record<string, string> = {
    'tech-sword-pierce': '/assets/generated/evolution-tech-sword-pierce.png',
    'tech-sword-return': '/assets/generated/evolution-tech-sword-return.png',
    'tech-sword-shadow': '/assets/generated/evolution-tech-sword-shadow.png',
    blade: '/assets/generated/evolution-blade.png',
    nova: '/assets/generated/evolution-nova.png',
    quick: '/assets/generated/evolution-quick.png',
    chain: '/assets/generated/evolution-chain.png',
    orbit: '/assets/generated/evolution-orbit.png',
    flame: '/assets/generated/evolution-flame.png',
    sweep: '/assets/generated/evolution-sweep.png',
    'mutate-ride': '/assets/generated/evolution-mutate-ride.png',
    'mutate-thunder': '/assets/generated/evolution-mutate-thunder.png',
    'mutate-domain': '/assets/generated/evolution-mutate-domain.png',
    'mutate-flame': '/assets/generated/evolution-mutate-flame.png',
  }
  const artByIcon: Record<string, string> = {
    blade: '/assets/generated/evolution-blade.png',
    nova: '/assets/generated/evolution-nova.png',
    quick: '/assets/generated/evolution-quick.png',
    chain: '/assets/generated/evolution-chain.png',
    orbit: '/assets/generated/evolution-orbit.png',
    flame: '/assets/generated/evolution-flame.png',
    sweep: '/assets/generated/evolution-sweep.png',
    guard: '/assets/generated/evolution-regen.png',
    shield: '/assets/generated/evolution-regen.png',
    gate: '/assets/generated/evolution-seal.png',
  }
  const iconGroup = iconId.replace(/-\d$/, '')
  const src = artByOption[optionId] ?? artByIcon[iconGroup]
  return src ? `<img class="evolution-art" src="${versionedAsset(src)}" alt="">` : evolutionIcon(iconId)
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
    button.style.setProperty('--card-accent', option.color)
    button.style.setProperty('--card-glow', `color-mix(in srgb, ${option.color}, transparent 72%)`)
    button.innerHTML = `<i>${option.iconHtml ?? evolutionArt(option.id, option.iconId)}</i><b>${option.title}</b><span>${option.desc}</span>${option.mutation ? '<em>质变</em>' : ''}`
    button.addEventListener('click', () => chooseEvolution(option))
    evolutionList.appendChild(button)
  }
  evolutionPanel.hidden = false
  toast(`魂质进化 ${cultivationRealm()}：选择本命术形态或战斗机制。`)
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

function heroScreenX(width: number) {
  const desired = width * 0.38
  return Math.max(118, Math.min(desired, width * 0.46))
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

  const groundY = h * 0.72
  const heroX = heroScreenX(w)
  const ox = heroX - state.hero.x
  const oy = groundY - state.hero.y
  drawSideTerrain(w, h, ox, groundY)
  drawStageRoute(w, ox, groundY)
  if (state.mode === 'dungeon') drawDungeonFloorAtmosphere(w, groundY)

  drawWorldDetails(ox, oy)
  const perfMode = vfxPerformanceMode()
  const effectsToDraw = perfMode ? state.effects.slice(-32) : state.effects
  const particlesToDraw = perfMode ? state.particles.slice(-92) : state.particles
  for (const skill of state.enemySkills) drawEnemySkill(skill, ox, oy)
  for (const orb of state.soulOrbs) drawSoulOrb(orb, ox, oy)
  for (const effect of effectsToDraw) drawEffect(effect, ox, oy)
  for (const particle of particlesToDraw) drawParticle(particle, ox, oy)
  drawMoveTarget(ox, oy)

  const target = nearestEnemy()
  if (target) drawTargetReticle(target.x + ox, target.y + oy, target.boss ? 74 : target.elite ? 50 : 40)

  for (const enemy of state.enemies) {
    const x = enemy.x + ox
    drawEnemySide(enemy, x, groundY)
  }

  drawHeroSide(heroX, groundY)

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

function vfxPerformanceMode() {
  return lastFrameWorkMs > 17 || state.effects.length > 28 || state.particles.length > 94 || state.enemySkills.length > 4
}

function drawSideTerrain(w: number, h: number, ox: number, groundY: number) {
  if (state.mode === 'wild' && worldStageTransition) {
    const blend = 1 - Math.max(0, worldStageTransition.life / worldStageTransition.maxLife)
    drawSideTerrainLayer(w, h, ox, groundY, stageTheme(worldStageTransition.from), 1 - blend)
    drawSideTerrainLayer(w, h, ox, groundY, stageTheme(worldStageTransition.to), blend)
    return
  }
  drawSideTerrainLayer(w, h, ox, groundY, activeStageTheme(), 1)
}

function drawSideTerrainLayer(w: number, h: number, ox: number, groundY: number, theme: StageTheme, alpha: number) {
  ctx.save()
  ctx.globalAlpha *= alpha
  const layerAlpha = ctx.globalAlpha
  const themeIndex = Math.max(0, stageThemes.indexOf(theme))
  const bg = state.mode === 'dungeon' ? (dungeonSprites[state.activeDungeon] ?? sprites.dungeonBg) : (worldSprites[themeIndex] ?? sprites.worldBg)
  if (bg && bg.complete && bg.naturalWidth > 0) {
    drawGeneratedMapBackground(bg, w, h, ox, groundY, theme)
    if (state.mode === 'dungeon') drawThemeLandmarks(w, groundY, ox, theme)
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
  if (state.mode === 'dungeon') drawThemeSkyDetails(w, h, ox, groundY, theme)

  ctx.globalAlpha = layerAlpha * (state.mode === 'dungeon' ? 0.55 : 0.42)
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
    ctx.globalAlpha = layerAlpha * 0.52
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

  ctx.globalAlpha = layerAlpha
  ctx.fillStyle = state.mode === 'dungeon' ? darkenHex(theme.ground, 0.72) : theme.ground
  ctx.fillRect(0, groundY - 16, w, h - groundY + 16)
  ctx.strokeStyle = theme.groundLine
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, groundY - 14)
  ctx.quadraticCurveTo(w * 0.24, groundY - 32, w * 0.5, groundY - 14)
  ctx.quadraticCurveTo(w * 0.74, groundY + 4, w, groundY - 18)
  ctx.stroke()

  ctx.globalAlpha = layerAlpha * 0.22
  ctx.strokeStyle = theme.detail
  for (let i = -4; i < 10; i += 1) {
    const x = ((i * 96 + ox * 0.7) % (w + 120)) - 60
    ctx.beginPath()
    ctx.moveTo(x, groundY + 20)
    ctx.lineTo(x + 70, groundY + 4)
    ctx.stroke()
  }
  if (state.mode === 'dungeon') drawThemeLandmarks(w, groundY, ox, theme)
  ctx.restore()
}

function drawGeneratedMapBackground(bg: HTMLImageElement, w: number, h: number, ox: number, groundY: number, theme: StageTheme) {
  const layerAlpha = ctx.globalAlpha
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

  ctx.globalAlpha = layerAlpha * 0.9
  const ground = ctx.createLinearGradient(0, groundY - 26, 0, h)
  ground.addColorStop(0, state.mode === 'dungeon' ? 'rgba(10,18,34,.18)' : 'rgba(24,56,43,.12)')
  ground.addColorStop(0.25, state.mode === 'dungeon' ? 'rgba(12,18,34,.72)' : 'rgba(24,56,43,.68)')
  ground.addColorStop(1, state.mode === 'dungeon' ? 'rgba(2,6,23,.92)' : 'rgba(6,22,18,.88)')
  ctx.fillStyle = ground
  ctx.fillRect(0, groundY - 22, w, h - groundY + 22)
  ctx.globalAlpha = layerAlpha
  ctx.strokeStyle = theme.groundLine
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, groundY - 14)
  ctx.quadraticCurveTo(w * 0.24, groundY - 30, w * 0.5, groundY - 15)
  ctx.quadraticCurveTo(w * 0.74, groundY + 2, w, groundY - 18)
  ctx.stroke()

  if (state.mode === 'dungeon') {
    ctx.globalAlpha = layerAlpha * 0.18
    ctx.strokeStyle = theme.detail
    for (let i = -4; i < 10; i += 1) {
      const x = ((i * 96 + ox * 0.7) % (w + 120)) - 60
      ctx.beginPath()
      ctx.moveTo(x, groundY + 20)
      ctx.lineTo(x + 70, groundY + 4)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = layerAlpha
}

function drawThemeSkyDetails(w: number, _h: number, ox: number, groundY: number, theme: StageTheme) {
  const themeIndex = stageThemes.indexOf(theme)
  const drift = performance.now() * 0.00008
  ctx.save()
  ctx.globalAlpha *= state.mode === 'dungeon' ? 0.22 : 0.34
  ctx.strokeStyle = theme.accent
  ctx.fillStyle = theme.detail
  ctx.lineWidth = 2.5
  const anchor = ((ox * 0.035 + drift * 1000) % (w + 360) + w + 360) % (w + 360) - 180

  if (themeIndex === 0) {
    for (let i = 0; i < 5; i += 1) {
      const x = (anchor + i * 166) % (w + 180) - 40
      const y = groundY - 240 - (i % 2) * 32
      ctx.beginPath()
      ctx.ellipse(x, y, 42, 11, 0.08, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x + 38, y + 2, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (themeIndex === 1) {
    for (let i = 0; i < 4; i += 1) {
      const x = (anchor + i * 210) % (w + 220) - 60
      const y = groundY - 280 + Math.sin(i * 1.7) * 16
      ctx.beginPath()
      ctx.arc(x, y, 46, -0.8, Math.PI * 1.36)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - 58, y + 12)
      ctx.lineTo(x + 58, y - 18)
      ctx.stroke()
    }
  } else if (themeIndex === 2) {
    for (let i = 0; i < 7; i += 1) {
      const x = (anchor + i * 128) % (w + 160) - 40
      const y = groundY - 196 - (i % 3) * 28
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 38)
      glow.addColorStop(0, colorWithAlpha(theme.accent, 0.72))
      glow.addColorStop(1, colorWithAlpha(theme.accent, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, 38, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = theme.detail
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (themeIndex === 3) {
    for (let i = 0; i < 5; i += 1) {
      const x = (anchor + i * 174) % (w + 180) - 50
      const y = groundY - 226 - (i % 2) * 24
      ctx.beginPath()
      ctx.moveTo(x, y - 64)
      ctx.lineTo(x + 24, y + 12)
      ctx.lineTo(x - 32, y + 32)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  } else if (themeIndex === 4) {
    for (let i = 0; i < 4; i += 1) {
      const x = (anchor + i * 230) % (w + 250) - 80
      const y = groundY - 250 + (i % 2) * 28
      ctx.beginPath()
      ctx.moveTo(x - 48, y + 42)
      ctx.bezierCurveTo(x - 8, y - 44, x + 16, y + 28, x + 56, y - 48)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(x + 4, y - 2, 16, 54, 0.55, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (themeIndex === 5) {
    for (let i = 0; i < 3; i += 1) {
      const x = (anchor + i * 250) % (w + 260) - 60
      const y = groundY - 228 - (i % 2) * 18
      ctx.beginPath()
      ctx.roundRect(x - 42, y - 58, 84, 102, 12)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - 52, y - 44)
      ctx.lineTo(x + 52, y - 18)
      ctx.stroke()
    }
  } else {
    for (let i = 0; i < 26; i += 1) {
      const x = (anchor + i * 47) % (w + 80) - 30
      const y = 48 + ((i * 37 + ox * 0.015) % Math.max(120, groundY - 120))
      ctx.globalAlpha *= 0.96
      ctx.beginPath()
      ctx.arc(x, y, i % 5 === 0 ? 2.4 : 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawThemeLandmarks(w: number, groundY: number, ox: number, theme: StageTheme) {
  const themeIndex = stageThemes.indexOf(theme)
  ctx.save()
  ctx.globalAlpha *= state.mode === 'dungeon' ? 0.22 : 0.18
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

function worldStageNo() {
  return Math.max(1, state.worldStage)
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
  return `${dungeon.name}·第${state.dungeonFloor}/${state.dungeonMaxFloors}层`
}

function darkenHex(hex: string, amount: number) {
  const value = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(value.slice(0, 2), 16) * amount))
  const g = Math.max(0, Math.round(parseInt(value.slice(2, 4), 16) * amount))
  const b = Math.max(0, Math.round(parseInt(value.slice(4, 6), 16) * amount))
  return `rgb(${r},${g},${b})`
}

function colorWithAlpha(color: string, alpha: number) {
  if (color.startsWith('#')) {
    const value = color.replace('#', '')
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  return color
}

function enemyDisplayName(enemy: Enemy) {
  const base = activeStageTheme().enemyNames[enemy.kind]
  if (enemy.boss) return `Boss ${base}`
  if (enemy.elite) return `精英 ${base}`
  return base
}

function drawStageRoute(_w: number, _ox: number, _groundY: number) {
  // Stage progress is shown in the HUD; the battle scene stays immersive.
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
    if (!enemyVisibleForCombat(enemy)) continue
    const distance = Math.hypot(enemy.x - state.hero.x, enemy.y - state.hero.y)
    if (distance < best) {
      best = distance
      target = enemy
    }
  }
  return target
}

function enemyVisibleForCombat(enemy: Enemy, margin = 58) {
  if (state.mode !== 'wild') return true
  const screenX = enemy.x + heroScreenX(canvas.width) - state.hero.x
  return screenX >= -margin && screenX <= canvas.width + margin
}

function distanceToSegment(point: Vec, start: Vec, end: Vec) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq))
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
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
  const size = particle.size * (0.6 + t * 0.7)
  ctx.save()
  ctx.globalCompositeOperation = particle.kind === 'ember' || particle.kind === 'spark' ? 'lighter' : 'source-over'
  ctx.globalAlpha = Math.min(1, t * 1.2)
  if (particle.size > 6) {
    ctx.shadowColor = particle.color
    ctx.shadowBlur = 4 + particle.size
  }
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
    ctx.fillStyle = particle.color
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha *= 0.58
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(-size * 0.18, -size * 0.18, Math.max(1.2, size * 0.34), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawWorldDetails(ox: number, oy: number) {
  if (state.mode === 'wild') return
  if (state.mode === 'dungeon' && vfxPerformanceMode()) {
    if (state.dungeonGateFound) drawExtractionGate(ox, oy)
    return
  }
  ctx.save()
  const cx = state.hero.x
  const spacing = state.mode === 'dungeon' ? 154 : 168
  const detailRange = state.mode === 'dungeon'
    ? (state.effects.length > 60 || state.particles.length > 120 ? 420 : 620)
    : 920
  const startX = Math.floor((cx - detailRange) / spacing) - 1
  const endX = Math.floor((cx + detailRange) / spacing) + 1

  for (let gx = startX; gx <= endX; gx += 1) {
    drawMapCell(gx, ox, oy)
  }

  ctx.restore()
  if (state.mode === 'dungeon' && state.dungeonGateFound) drawExtractionGate(ox, oy)
}

function drawDungeonFloorAtmosphere(w: number, groundY: number) {
  const floorRatio = Math.max(0, Math.min(1, (state.dungeonFloor - 1) / Math.max(1, state.dungeonMaxFloors - 1)))
  const theme = activeStageTheme()
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.08 + floorRatio * 0.12
  ctx.fillStyle = colorWithAlpha(theme.accent, 0.12 + floorRatio * 0.12)
  ctx.fillRect(0, groundY - 4, w, 34 + floorRatio * 18)
  ctx.globalAlpha = 0.13 + floorRatio * 0.16
  ctx.strokeStyle = floorRatio > 0.75 ? '#facc15' : theme.accent
  ctx.lineWidth = 1.2 + floorRatio * 0.8
  for (let i = 0; i < 2 + state.dungeonFloor; i += 1) {
    const y = groundY + 12 + i * 24
    ctx.beginPath()
    ctx.moveTo(-24, y)
    ctx.bezierCurveTo(w * 0.28, y - 22 - floorRatio * 8, w * 0.68, y + 18, w + 24, y - 8)
    ctx.stroke()
  }
  ctx.restore()
}

function cellRandom(x: number, y: number, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function drawMapCell(gx: number, ox: number, oy: number) {
  const sceneSeed = state.mode === 'dungeon' ? activeDungeonDef().themeIndex + 21 + state.dungeonFloor * 17 : worldStageNo()
  const spacing = state.mode === 'dungeon' ? 154 : 168
  const groundY = state.hero.y + oy
  const x = gx * spacing + cellRandom(gx, sceneSeed, 1) * spacing + ox
  const groundOffset = (cellRandom(gx, sceneSeed, 2) - 0.5) * 18
  const y = groundY - 38 - cellRandom(gx, sceneSeed, 3) * 58
  const type = cellRandom(gx, sceneSeed, 4)

  drawGroundPatch(x, groundY + 8 + groundOffset, cellRandom(gx, sceneSeed, 27))

  drawBrokenTile(x + cellRandom(gx, sceneSeed, 21) * 38 - 19, groundY + 10 + groundOffset, cellRandom(gx, sceneSeed, 26))
  if (type < 0.34) {
    drawDungeonPillar(x, groundY - 62 - cellRandom(gx, sceneSeed, 5) * 28, cellRandom(gx, sceneSeed, 6))
  } else if (type < 0.68) {
    drawRift(x, y, cellRandom(gx, sceneSeed, 7))
  } else {
    drawAncientTablet(x, groundY - 42, cellRandom(gx, sceneSeed, 8))
  }
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
  const finalFloor = dungeonIsFinalFloor()
  const label = dungeonGateLabel()
  ctx.save()
  ctx.translate(x, y)
  ctx.shadowColor = theme.accent
  ctx.shadowBlur = 26
  ctx.strokeStyle = finalFloor ? theme.accent : '#38bdf8'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(0, 0, 48 + pulse * 8, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = finalFloor ? theme.detail : '#bae6fd'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(0, 0, 30, -Math.PI * 0.2, Math.PI * 1.25)
  ctx.stroke()
  if (!finalFloor) {
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.moveTo(-20, -8)
    ctx.lineTo(0, 14)
    ctx.lineTo(20, -8)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = 'rgba(8,47,73,.72)'
  ctx.beginPath()
  ctx.arc(0, 0, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e0f2fe'
  ctx.font = 'bold 16px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, 0, 6)
  ctx.restore()
}

function drawEnemySkill(skill: EnemySkill, ox: number, oy: number) {
  const elapsed = skill.maxLife - skill.life
  const armed = elapsed >= skill.windup
  const warn = Math.max(0, Math.min(1, elapsed / skill.windup))
  const after = armed ? Math.max(0, Math.min(1, (elapsed - skill.windup) / Math.max(0.001, skill.maxLife - skill.windup))) : 0
  const fade = armed ? Math.max(0, skill.life / Math.max(0.001, skill.maxLife - skill.windup)) : 1
  const sx = skill.x + ox
  const sy = skill.y + oy
  const tx = skill.targetX + ox
  const ty = skill.targetY + oy
  const radius = skill.radius
  const color = skill.color
  const pulse = Math.sin(performance.now() * 0.012 + skill.id) * 0.5 + 0.5

  const drawWarningEllipse = (scale = 1) => {
    ctx.globalAlpha = (0.28 + warn * 0.32 + pulse * 0.12) * fade
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(tx, ty + 2, radius * scale, radius * 0.32 * scale, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = (0.72 + pulse * 0.2) * fade
    ctx.strokeStyle = color
    ctx.lineWidth = skill.boss ? 4 : 2.5
    ctx.shadowColor = color
    ctx.shadowBlur = skill.boss ? 24 : 14
    ctx.setLineDash(armed ? [] : [10, 8])
    ctx.beginPath()
    ctx.ellipse(tx, ty + 2, radius * (0.72 + warn * 0.28) * scale, radius * (0.22 + warn * 0.1) * scale, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (skill.kind === 'wingBlade') {
    const dx = tx - sx
    const dy = ty - sy
    const angle = Math.atan2(dy, dx)
    const length = Math.max(80, Math.hypot(dx, dy))
    ctx.globalAlpha = (armed ? 0.28 : 0.62) * fade
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 18
    ctx.lineWidth = skill.boss ? 8 : 5
    ctx.setLineDash(armed ? [] : [14, 9])
    ctx.beginPath()
    ctx.moveTo(sx, sy - 42)
    ctx.lineTo(tx, ty - 28)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.save()
    ctx.translate(sx + dx * (armed ? after : warn), sy - 42 + (dy + 14) * (armed ? after : warn))
    ctx.rotate(angle)
    ctx.globalAlpha = (armed ? 0.92 : 0.45) * fade
    ctx.fillStyle = 'rgba(248,250,252,.9)'
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(42, 0)
    ctx.quadraticCurveTo(6, -18 - warn * 14, -length * 0.12, -4)
    ctx.quadraticCurveTo(8, 10 + warn * 10, 42, 0)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    drawWarningEllipse(0.72)
  } else if (skill.kind === 'earthSpike') {
    drawWarningEllipse()
    ctx.globalAlpha = 0.58 * fade
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.shadowColor = color
    ctx.shadowBlur = 16
    for (let i = 0; i < 7; i += 1) {
      const order = i - 3
      const crackX = tx + order * radius * 0.22
      ctx.beginPath()
      ctx.moveTo(crackX, ty + 6)
      ctx.lineTo(crackX + Math.sin(i * 1.8) * 18, ty + 18 + warn * 16)
      ctx.lineTo(crackX + Math.cos(i * 2.1) * 30, ty + 26 + warn * 22)
      ctx.stroke()
      if (armed) {
        const h = (38 + (i % 3) * 16) * Math.sin(after * Math.PI)
        ctx.fillStyle = 'rgba(248,250,252,.72)'
        ctx.strokeStyle = color
        ctx.beginPath()
        ctx.moveTo(crackX - 12, ty + 20)
        ctx.lineTo(crackX, ty + 20 - h)
        ctx.lineTo(crackX + 12, ty + 20)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
    }
  } else if (skill.kind === 'bossDomain') {
    drawWarningEllipse(1.18)
    const beamHeight = 120 + radius * 0.9
    ctx.globalAlpha = (armed ? 0.38 + after * 0.34 : 0.16 + warn * 0.16) * fade
    const pillar = ctx.createLinearGradient(tx, ty - beamHeight, tx, ty + 28)
    pillar.addColorStop(0, 'rgba(255,255,255,0)')
    pillar.addColorStop(0.45, color)
    pillar.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = pillar
    ctx.beginPath()
    ctx.ellipse(tx, ty - beamHeight * 0.32, radius * (0.18 + warn * 0.18), beamHeight * 0.58, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.shadowColor = color
    ctx.shadowBlur = 26
    for (let i = 0; i < 3; i += 1) {
      const r = radius * (0.42 + i * 0.18 + (armed ? after * 0.22 : warn * 0.08))
      ctx.globalAlpha = (0.34 - i * 0.07 + warn * 0.12) * fade
      ctx.beginPath()
      ctx.ellipse(tx, ty + 2, r, r * 0.28, i * 0.07, 0, Math.PI * 2)
      ctx.stroke()
    }
    const runeCount = 10
    ctx.globalAlpha = 0.76 * fade
    ctx.fillStyle = '#f8fafc'
    ctx.strokeStyle = color
    for (let i = 0; i < runeCount; i += 1) {
      const a = i * Math.PI * 2 / runeCount + performance.now() * 0.0012
      const px = tx + Math.cos(a) * radius * 0.78
      const py = ty + Math.sin(a) * radius * 0.24
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(a)
      ctx.beginPath()
      ctx.roundRect(-5, -12, 10, 24, 3)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  } else {
    drawWarningEllipse()
    ctx.globalAlpha = (armed ? 0.88 : 0.42 + warn * 0.24) * fade
    ctx.shadowColor = color
    ctx.shadowBlur = 18
    const orbR = 12 + radius * 0.18 + (armed ? Math.sin(after * Math.PI) * radius * 0.22 : warn * 8)
    const orb = ctx.createRadialGradient(tx - orbR * 0.25, ty - 52 - orbR * 0.2, 4, tx, ty - 52, orbR)
    orb.addColorStop(0, 'rgba(255,255,255,.95)')
    orb.addColorStop(0.45, color)
    orb.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = orb
    ctx.beginPath()
    ctx.arc(tx, ty - 52, orbR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(tx, ty - 52, orbR * 0.72, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

function drawEffect(effect: Effect, ox: number, oy: number) {
  const t = effect.life / effect.maxLife
  const progress = 1 - t
  const x = effect.x + ox
  const y = effect.y + oy
  const dir = Math.cos(effect.angle ?? 0) < 0 ? -1 : 1
  const visualLoad = state.effects.length + state.particles.length / 18 + state.enemySkills.length * 2
  const denseVfx = vfxPerformanceMode() || visualLoad > 24

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

  const drawThunderSealGraphic = (dx: number, dy: number, size: number, alpha: number, rotation = 0, rank = 1) => {
    const runeCount = denseVfx ? Math.min(5, 3 + rank) : Math.min(9, 5 + rank * 2)
    const ringPasses = denseVfx ? 1 : 2
    ctx.save()
    ctx.globalAlpha *= alpha
    ctx.globalCompositeOperation = 'lighter'
    ctx.translate(dx, dy)
    ctx.rotate(rotation)
    ctx.shadowColor = '#7dd3fc'
    ctx.shadowBlur = 18 + rank * 3
    ctx.strokeStyle = 'rgba(186,230,253,.94)'
    ctx.lineWidth = Math.max(1.5, size * 0.022)
    for (let i = 0; i < ringPasses; i += 1) {
      ctx.globalAlpha = alpha * (0.72 - i * 0.14)
      ctx.beginPath()
      ctx.ellipse(0, 0, size * (0.42 + i * 0.1), size * (0.18 + i * 0.035), i * 0.13, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = alpha * 0.85
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = Math.max(2, size * 0.026)
    ctx.beginPath()
    ctx.moveTo(-size * 0.18, -size * 0.24)
    ctx.lineTo(size * 0.08, -size * 0.04)
    ctx.lineTo(-size * 0.04, size * 0.03)
    ctx.lineTo(size * 0.2, size * 0.24)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(224,242,254,.86)'
    ctx.lineWidth = Math.max(1.4, size * 0.014)
    for (let i = 0; i < runeCount; i += 1) {
      const a = i * Math.PI * 2 / runeCount
      const px = Math.cos(a) * size * 0.5
      const py = Math.sin(a) * size * 0.22
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(a + Math.PI / 2)
      ctx.beginPath()
      ctx.moveTo(-size * 0.025, -size * 0.052)
      ctx.lineTo(size * 0.025, -size * 0.052)
      ctx.moveTo(0, -size * 0.052)
      ctx.lineTo(0, size * 0.055)
      ctx.moveTo(-size * 0.03, size * 0.055)
      ctx.lineTo(size * 0.03, size * 0.055)
      ctx.stroke()
      ctx.restore()
    }
    ctx.globalAlpha = alpha * 0.36
    ctx.strokeStyle = '#e0f2fe'
    ctx.lineWidth = Math.max(1, size * 0.01)
    const rayCount = denseVfx ? Math.min(4, 2 + rank) : 5 + rank
    for (let i = 0; i < rayCount; i += 1) {
      const a = i * Math.PI * 2 / rayCount
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * size * 0.18, Math.sin(a) * size * 0.08)
      ctx.lineTo(Math.cos(a) * size * 0.56, Math.sin(a) * size * 0.25)
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.save()
  if (effect.kind === 'thunderseal') {
    const rank = Math.max(1, effect.arc ?? 1)
    const sealSize = effect.radius * (0.82 + progress * 0.26)
    drawVfxImage(vfxSprites.thunder, x, y, Math.min(270, effect.radius * 1.45), 0.28 + t * 0.28, progress * 0.18)
    drawThunderSealGraphic(x, y, sealSize, Math.min(1, 0.32 + t * 0.78), progress * Math.PI * (0.32 + rank * 0.04), rank)
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = t * 0.72
    ctx.strokeStyle = '#bae6fd'
    ctx.shadowColor = '#38bdf8'
    ctx.shadowBlur = 22
    ctx.lineWidth = 2
    const sealRayCount = denseVfx ? Math.min(4, 2 + rank) : 5 + rank
    for (let i = 0; i < sealRayCount; i += 1) {
      const a = i * Math.PI * 2 / sealRayCount + progress * 2.2
      const outerPulse = Math.sin(i * 1.7 + progress * 8) * 0.5 + 0.5
      const yPulse = Math.sin(i * 1.3 + progress * 7 + 1.1) * 0.5 + 0.5
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(a) * sealSize * 0.18, y + Math.sin(a) * sealSize * 0.08)
      ctx.lineTo(x + Math.cos(a) * sealSize * (0.45 + outerPulse * 0.1), y + Math.sin(a) * sealSize * (0.2 + yPulse * 0.08))
      ctx.stroke()
    }
  } else if (effect.kind === 'swordflight') {
    const startX = x
    const startY = y
    const targetX = (effect.tx ?? effect.x) + ox
    const targetY = (effect.ty ?? effect.y) + oy
    const returnX = state.hero.x + ox
    const returnY = state.hero.y + oy - 58
    const angleBase = effect.angle ?? Math.atan2(targetY - startY, targetX - startX)
    const arcSign = effect.arc ?? dir
    const perpX = -Math.sin(angleBase)
    const perpY = Math.cos(angleBase)
    const bend = Math.min(150, 78 + effect.radius * 0.18)
    const minSwordY = Math.min(startY, targetY, returnY) - 84
    const maxSwordY = Math.max(startY, targetY, returnY) + 28
    const outboundCtrl = {
      x: (startX + targetX) / 2 + perpX * bend * arcSign,
      y: Math.max(minSwordY, Math.min(maxSwordY, (startY + targetY) / 2 + perpY * bend * arcSign - 26)),
    }
    const returnCtrl = {
      x: (targetX + returnX) / 2 - perpX * bend * 0.62 * arcSign,
      y: Math.max(minSwordY, Math.min(maxSwordY, (targetY + returnY) / 2 - perpY * bend * 0.42 * arcSign - 34)),
    }
    const outbound = progress < 0.56
    const local = outbound ? progress / 0.56 : (progress - 0.56) / 0.44
    const ease = 0.5 - Math.cos(local * Math.PI) * 0.5

    const quadPoint = (fromX: number, fromY: number, ctrlX: number, ctrlY: number, toX: number, toY: number, p: number) => {
      const inv = 1 - p
      return {
        x: inv * inv * fromX + 2 * inv * p * ctrlX + p * p * toX,
        y: inv * inv * fromY + 2 * inv * p * ctrlY + p * p * toY,
      }
    }
    const quadTangent = (fromX: number, fromY: number, ctrlX: number, ctrlY: number, toX: number, toY: number, p: number) => ({
      x: 2 * (1 - p) * (ctrlX - fromX) + 2 * p * (toX - ctrlX),
      y: 2 * (1 - p) * (ctrlY - fromY) + 2 * p * (toY - ctrlY),
    })
    const point = outbound
      ? quadPoint(startX, startY, outboundCtrl.x, outboundCtrl.y, targetX, targetY, ease)
      : quadPoint(targetX, targetY, returnCtrl.x, returnCtrl.y, returnX, returnY, ease)
    const tangent = outbound
      ? quadTangent(startX, startY, outboundCtrl.x, outboundCtrl.y, targetX, targetY, ease)
      : quadTangent(targetX, targetY, returnCtrl.x, returnCtrl.y, returnX, returnY, ease)
    const angle = Math.atan2(tangent.y, tangent.x)

    ctx.globalAlpha = Math.min(1, 0.35 + t * 0.9)
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(165,243,252,${0.42 * t})`
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    ctx.shadowColor = effect.color
    ctx.shadowBlur = 24
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.quadraticCurveTo(outboundCtrl.x, outboundCtrl.y, targetX, targetY)
    ctx.quadraticCurveTo(returnCtrl.x, returnCtrl.y, returnX, returnY)
    ctx.stroke()
    ctx.strokeStyle = `rgba(248,250,252,${0.28 * t})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.quadraticCurveTo(outboundCtrl.x, outboundCtrl.y, targetX, targetY)
    ctx.quadraticCurveTo(returnCtrl.x, returnCtrl.y, returnX, returnY)
    ctx.stroke()
    for (let i = 0; i < 4; i += 1) {
      const ghostT = Math.max(0, local - i * 0.12)
      const ghostEase = 0.5 - Math.cos(Math.min(1, ghostT) * Math.PI) * 0.5
      const ghostPoint = outbound
        ? quadPoint(startX, startY, outboundCtrl.x, outboundCtrl.y, targetX, targetY, ghostEase)
        : quadPoint(targetX, targetY, returnCtrl.x, returnCtrl.y, returnX, returnY, ghostEase)
      const ghostTangent = outbound
        ? quadTangent(startX, startY, outboundCtrl.x, outboundCtrl.y, targetX, targetY, ghostEase)
        : quadTangent(targetX, targetY, returnCtrl.x, returnCtrl.y, returnX, returnY, ghostEase)
      ctx.save()
      ctx.globalAlpha *= (0.18 - i * 0.035) * t
      ctx.translate(ghostPoint.x, ghostPoint.y)
      ctx.rotate(Math.atan2(ghostTangent.y, ghostTangent.x))
      ctx.fillStyle = '#e0f2fe'
      ctx.strokeStyle = '#67e8f9'
      ctx.lineWidth = 1.5
      drawFlyingSword(82 - i * 5, 7)
      ctx.restore()
    }
    ctx.save()
    ctx.translate(point.x, point.y)
    ctx.rotate(angle)
    ctx.fillStyle = '#f8fafc'
    ctx.strokeStyle = '#67e8f9'
    ctx.lineWidth = 2
    drawFlyingSword(96, 8.5)
    ctx.restore()
    if (!outbound) {
      ctx.globalAlpha = 0.42 * t
      ctx.strokeStyle = '#fef08a'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(returnX, returnY, 22 + progress * 14, -Math.PI * 0.1, Math.PI * 1.35)
      ctx.stroke()
    }
  } else if (effect.kind === 'impact') {
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
    const centerY = y - 40
    const count = denseVfx
      ? Math.min(28, 12 + Math.floor(effect.radius / 42))
      : Math.min(42, 16 + Math.floor(effect.radius / 30))
    const sweep = progress * (w * 0.9 + 180)
    ctx.globalAlpha = t
    const wash = ctx.createLinearGradient(0, Math.max(0, centerY - h * 0.34), 0, h)
    wash.addColorStop(0, 'rgba(224,242,254,0)')
    wash.addColorStop(0.38, denseVfx ? 'rgba(34,211,238,.08)' : 'rgba(34,211,238,.12)')
    wash.addColorStop(1, 'rgba(34,211,238,0)')
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, w, h)
    ctx.shadowColor = '#a5f3fc'
    ctx.shadowBlur = denseVfx ? 10 : 20
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
    const count = denseVfx
      ? Math.min(9, 5 + Math.floor(effect.radius / 140))
      : Math.min(14, 7 + Math.floor(effect.radius / 90))
    const stormRank = Math.max(2, effect.arc ?? state.mutations.thunderFork + 1)
    ctx.globalAlpha = t
    drawVfxImage(vfxSprites.thunder, x, y - 66, Math.min(denseVfx ? 390 : 520, 220 + effect.radius * 0.34), 0.3 + t * 0.32, progress * 0.08)
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, 'rgba(8,47,73,.34)')
    sky.addColorStop(0.52, 'rgba(14,165,233,.1)')
    sky.addColorStop(1, 'rgba(8,47,73,0)')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    drawThunderSealGraphic(x, y - 92, Math.min(360, 170 + effect.radius * 0.18), 0.72 * t, -progress * 0.32, stormRank)
    if (!denseVfx) drawThunderSealGraphic(w * 0.5, h * 0.22, Math.min(520, 230 + effect.radius * 0.22), 0.34 * t, progress * 0.18, stormRank + 1)
    ctx.globalAlpha = 0.22 * t
    ctx.strokeStyle = '#bae6fd'
    ctx.lineWidth = 3
    ctx.shadowColor = '#38bdf8'
    ctx.shadowBlur = denseVfx ? 14 : 26
    ctx.beginPath()
    ctx.ellipse(w * 0.5, h * 0.25, w * 0.42, h * 0.11, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowColor = '#bae6fd'
    ctx.shadowBlur = denseVfx ? 12 : 24
    for (let i = 0; i < count; i += 1) {
      const px = ((i * 97 + progress * 260) % (w + 160)) - 80
      const top = 54 + (i % 4) * 24
      const length = 155 + (i % 5) * 28 + effect.radius * 0.05
      ctx.strokeStyle = i % 2 === 0 ? '#e0f2fe' : '#38bdf8'
      ctx.lineWidth = i % 3 === 0 ? 5 : 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(px, top)
      const boltSegments = denseVfx ? 3 : 5
      for (let j = 1; j <= boltSegments; j += 1) {
        ctx.lineTo(px + (j % 2 === 0 ? -18 : 22), top + (length / boltSegments) * j)
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
    const count = denseVfx
      ? Math.min(18, 9 + Math.floor(effect.radius / 76))
      : Math.min(26, 11 + Math.floor(effect.radius / 54))
    ctx.globalAlpha = t
    drawVfxImage(vfxSprites.lotus, x, y - 34, Math.min(denseVfx ? 430 : 580, 220 + effect.radius * 0.42), 0.42 + t * 0.38, -progress * 0.06)
    const heat = ctx.createLinearGradient(0, 0, 0, h)
    heat.addColorStop(0, 'rgba(127,29,29,0)')
    heat.addColorStop(0.45, denseVfx ? 'rgba(249,115,22,.12)' : 'rgba(249,115,22,.18)')
    heat.addColorStop(1, 'rgba(127,29,29,0)')
    ctx.fillStyle = heat
    ctx.fillRect(0, 0, w, h)
    ctx.shadowColor = '#fb923c'
    ctx.shadowBlur = denseVfx ? 12 : 24
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
    const half = effect.radius / 2
    const boltRank = Math.max(1, effect.arc ?? state.mutations.thunderFork + 1)
    drawVfxImage(vfxSprites.thunder, 0, 0, Math.min(denseVfx ? 180 : 250, 104 + effect.radius * 0.25), 0.26 + t * 0.28, progress * 0.16)
    ctx.rotate(effect.angle ?? 0)
    ctx.globalAlpha = t
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowColor = effect.color
    ctx.shadowBlur = denseVfx ? 12 : 30

    const points: Array<{ x: number; y: number }> = []
    const segments = denseVfx ? 6 + Math.min(2, boltRank) : 8 + Math.min(4, boltRank)
    for (let i = 0; i <= segments; i += 1) {
      const p = i / segments
      const wobble = Math.sin(i * 2.07 + progress * 11) * (10 + boltRank * 3)
      const fine = Math.sin(i * 4.21 + progress * 17) * 4
      points.push({ x: -half + effect.radius * p, y: i === 0 || i === segments ? 0 : wobble + fine })
    }

    const passCount = denseVfx ? 2 : 3
    for (let pass = 0; pass < passCount; pass += 1) {
      ctx.globalAlpha = t * (pass === 0 ? 0.28 : pass === 1 ? 0.62 : 0.95)
      ctx.strokeStyle = pass === 2 ? 'rgba(255,255,255,.95)' : pass === 1 ? '#bae6fd' : effect.color
      ctx.lineWidth = pass === 0 ? Math.min(18, 8 + boltRank * 2.5) : pass === 1 ? Math.min(10, 4 + boltRank) : 2.2
      ctx.beginPath()
      points.forEach((point, index) => {
        const yOffset = pass === 0 ? 0 : Math.sin(index + pass + progress * 9) * (pass === 1 ? 2.5 : 1)
        if (index === 0) ctx.moveTo(point.x, point.y + yOffset)
        else ctx.lineTo(point.x, point.y + yOffset)
      })
      ctx.stroke()
    }

    ctx.strokeStyle = `rgba(224,242,254,${0.72 * t})`
    ctx.lineWidth = 2
    for (let i = 2; i < points.length - 2; i += 3) {
      const point = points[i]
      const forkDir = i % 2 === 0 ? -1 : 1
      const branchLength = 34 + boltRank * 8 + (i % 3) * 9
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
      ctx.lineTo(point.x + 16, point.y + forkDir * branchLength * 0.48)
      ctx.lineTo(point.x + 36, point.y + forkDir * branchLength)
      ctx.stroke()
    }

    if (denseVfx) {
      ctx.strokeStyle = `rgba(224,242,254,${0.58 * t})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(-half, 0, 22 + boltRank * 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(half, 0, 24 + boltRank * 3, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      drawThunderSealGraphic(-half, 0, 52 + boltRank * 7, 0.54 * t, -progress * 0.8, boltRank)
      drawThunderSealGraphic(half, 0, 58 + boltRank * 8, 0.7 * t, progress * 0.92, boltRank + 1)
      const sealCount = Math.min(5, Math.max(3, Math.round(effect.radius / 150) + boltRank))
      for (let i = 1; i < sealCount - 1; i += 1) {
        const p = i / Math.max(1, sealCount - 1)
        const sealX = -half + effect.radius * p
        const sealY = Math.sin(i * 1.8 + progress * 8) * (10 + boltRank * 2)
        drawThunderSealGraphic(sealX, sealY, 32 + boltRank * 3, 0.32 * t, progress * (i % 2 === 0 ? 0.8 : -0.8), Math.max(1, boltRank - 1))
      }
    }
  } else if (effect.kind === 'orbit') {
    ctx.translate(x, y - 28)
    ctx.globalAlpha = t
    ctx.shadowColor = effect.color
    ctx.shadowBlur = denseVfx ? 12 : 26
    ctx.strokeStyle = `rgba(186,230,253,${0.5 * t})`
    ctx.lineWidth = 2
    const ringCount = denseVfx ? Math.min(2, 1 + Math.floor(effect.radius / 180)) : Math.min(4, 2 + Math.floor(effect.radius / 135))
    for (let i = 0; i < ringCount; i += 1) {
      ctx.beginPath()
      ctx.ellipse(0, 0, effect.radius * (0.52 + progress * 0.08 + i * 0.05), 25 + i * 10, i * 0.18, 0, Math.PI * 2)
      ctx.stroke()
    }
    const swordCount = denseVfx ? Math.min(6, 3 + Math.floor(effect.radius / 72)) : Math.min(12, 6 + Math.floor(effect.radius / 44))
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

function worldMonsterIndex() {
  return (worldStageNo() - 1) % worldMonsterSprites.length
}

function worldEnemyVisual(enemy: Enemy): Required<EnemySpriteLayout> | null {
  if (state.mode !== 'wild') return null
  const base = worldMonsterVisuals[worldMonsterIndex()] ?? worldMonsterVisuals[0]
  const scale = enemy.boss ? 1.45 : enemy.elite ? 1.12 : 1
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
    lift: Math.round(base.lift * scale),
    barWidth: Math.round(base.barWidth * (enemy.boss ? 1.34 : enemy.elite ? 1.12 : 1)),
    barY: Math.round(base.barY * scale),
    motion: base.motion,
  }
}

function enemySceneSprite(enemy: Enemy) {
  if (state.mode === 'wild') return worldMonsterSprites[worldMonsterIndex()] ?? monsterSprites[enemy.kind]
  return monsterSprites[enemy.kind]
}

function enemySpriteLayout(enemy: Enemy, worldVisual = worldEnemyVisual(enemy)): EnemySpriteLayout {
  if (worldVisual) return worldVisual
  if (enemy.kind === 'warden' || enemy.boss) return { width: 218, height: 218, lift: 8, barWidth: 132, barY: 190 }
  if (enemy.kind === 'bat') return { width: enemy.elite ? 152 : 130, height: enemy.elite ? 152 : 130, lift: 58, barWidth: enemy.elite ? 92 : 76, barY: 128 }
  if (enemy.kind === 'crystal') return { width: enemy.elite ? 164 : 142, height: enemy.elite ? 164 : 142, lift: 4, barWidth: enemy.elite ? 96 : 82, barY: 140 }
  if (enemy.kind === 'wolf') return { width: enemy.elite ? 154 : 136, height: enemy.elite ? 154 : 136, lift: 2, barWidth: enemy.elite ? 94 : 80, barY: 130 }
  return { width: enemy.elite ? 132 : 110, height: enemy.elite ? 132 : 110, lift: 2, barWidth: enemy.elite ? 86 : 72, barY: 108 }
}

function drawEnemyAttackMotion(enemy: Enemy, x: number, baseY: number, layout: EnemySpriteLayout, motion: EnemySpriteMotion, faceRight: boolean, power: number, color: string) {
  if (power <= 0.03) return
  const dir = faceRight ? 1 : -1
  const frontX = x + dir * layout.width * (enemy.boss ? 0.28 : 0.34)
  const coreY = baseY - layout.height * (motion === 'flying' ? 0.48 : 0.36)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = Math.min(0.95, power * (enemy.boss ? 1.05 : 0.86))
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = enemy.boss ? 28 : 18
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (motion === 'flying') {
    ctx.lineWidth = enemy.boss ? 5 : 3
    for (let i = 0; i < 3; i += 1) {
      const y = coreY - 20 + i * 18
      ctx.beginPath()
      ctx.moveTo(frontX - dir * 16, y)
      ctx.bezierCurveTo(frontX + dir * (26 + power * 22), y - 18, frontX + dir * (72 + i * 10), y - 8, frontX + dir * (104 + power * 20), y + 6)
      ctx.stroke()
    }
    ctx.globalAlpha *= 0.34
    ctx.beginPath()
    ctx.ellipse(frontX + dir * 54, coreY - 4, layout.width * 0.34, layout.height * 0.16, dir * -0.16, 0, Math.PI * 2)
    ctx.fill()
  } else if (enemy.kind === 'crystal' || enemy.kind === 'warden' || enemy.boss || motion === 'heavy') {
    ctx.lineWidth = enemy.boss ? 4 : 3
    for (let i = 0; i < 5; i += 1) {
      const px = frontX + dir * (10 + i * 13)
      const spike = (34 + i * 8) * power
      ctx.beginPath()
      ctx.moveTo(px - dir * 10, baseY + 10)
      ctx.lineTo(px, baseY - 10 - spike)
      ctx.lineTo(px + dir * 12, baseY + 10)
      ctx.stroke()
    }
    if (enemy.boss) {
      ctx.globalAlpha *= 0.55
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.ellipse(frontX + dir * 34, coreY + 14, layout.width * 0.38, layout.height * 0.18, dir * -0.08, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else {
    ctx.lineWidth = enemy.elite ? 5 : 3.5
    for (let i = 0; i < 3; i += 1) {
      const y = coreY - 18 + i * 16
      ctx.beginPath()
      ctx.moveTo(frontX - dir * 12, y)
      ctx.quadraticCurveTo(frontX + dir * (38 + i * 7), y - 18 - power * 12, frontX + dir * (86 + power * 20), y + 4)
      ctx.stroke()
    }
    ctx.globalAlpha *= 0.24
    ctx.fillStyle = '#fef2f2'
    ctx.beginPath()
    ctx.ellipse(frontX + dir * 42, coreY - 8, layout.width * 0.32, 18 + power * 8, dir * -0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawEnemySpriteFrame(sprite: HTMLImageElement, layout: EnemySpriteLayout, motion: EnemySpriteMotion, gait: number, moving: boolean, attackPower: number, castPose: number) {
  const dx = -layout.width / 2
  const dy = -layout.height + 12
  const dw = layout.width
  const dh = layout.height
  const step = moving ? gait : Math.sin(performance.now() * 0.004) * 0.22
  const heavy = motion === 'heavy'
  const wingBeat = motion === 'flying' ? Math.abs(gait) : 0
  const lean = step * (motion === 'flying' ? 0.035 : heavy ? 0.014 : 0.022) + attackPower * 0.035 - castPose * 0.018
  const lift = motion === 'flying'
    ? -wingBeat * 5 - attackPower * 6
    : -Math.abs(step) * (moving ? (heavy ? 1.4 : 2.4) : 0.6) - attackPower * 2 + castPose * 1.5
  const squashX = 1 + (moving ? Math.abs(step) * (heavy ? 0.012 : 0.018) : 0) + attackPower * 0.035 + castPose * 0.015
  const squashY = 1 - (moving ? Math.abs(step) * (heavy ? 0.007 : 0.012) : 0) - attackPower * 0.018 + castPose * 0.012

  if (moving || motion === 'flying') {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha *= motion === 'flying' ? 0.13 + wingBeat * 0.08 : 0.1 + Math.abs(step) * 0.05
    ctx.strokeStyle = motion === 'flying' ? 'rgba(186,230,253,.72)' : 'rgba(148,163,184,.5)'
    ctx.lineWidth = motion === 'flying' ? 3 : 2
    ctx.lineCap = 'round'
    const trailY = dy + dh * (motion === 'flying' ? 0.48 : 0.82)
    for (let i = 0; i < 3; i += 1) {
      const y = trailY + i * (motion === 'flying' ? 10 : 6)
      ctx.beginPath()
      ctx.moveTo(dx + dw * (0.12 + i * 0.08), y)
      ctx.quadraticCurveTo(dx + dw * 0.38, y - 8 - wingBeat * 8, dx + dw * (0.72 + i * 0.04), y + step * 4)
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.save()
  ctx.translate(0, lift)
  ctx.rotate(lean)
  ctx.scale(squashX, squashY)
  ctx.drawImage(sprite, dx, dy, dw, dh)
  ctx.restore()
}

function drawEnemySprite(enemy: Enemy, x: number, groundY: number) {
  const sprite = enemySceneSprite(enemy)
  if (!sprite?.complete || sprite.naturalWidth <= 0) return false
  const theme = activeStageTheme()
  const worldVisual = worldEnemyVisual(enemy)
  const layout = enemySpriteLayout(enemy, worldVisual)
  const motion = layout.motion ?? (enemy.kind === 'bat' ? 'flying' : enemy.kind === 'crystal' || enemy.kind === 'warden' || enemy.boss ? 'heavy' : 'ground')
  const now = performance.now()
  const phase = now * (motion === 'flying' ? 0.014 : motion === 'ground' ? 0.012 : 0.008) + enemy.id
  const gait = Math.sin(phase)
  const pulse = Math.sin(now * 0.006 + enemy.id) * 0.5 + 0.5
  const distance = Math.hypot(state.hero.x - enemy.x, state.hero.y - enemy.y)
  const moving = distance > 38
  const float = motion === 'flying' ? gait * 9 : Math.sin(now * 0.003 + enemy.id) * (motion === 'heavy' ? 1.2 : 2)
  const walkBob = moving && motion !== 'flying' ? Math.abs(gait) * (motion === 'heavy' ? 1.1 : 2.2) : 0
  const baseY = groundY - layout.lift + float - walkBob
  const faceRight = state.hero.x > enemy.x
  const hitT = Math.min(1, enemy.hit / 0.18)
  const recoilX = hitT * (faceRight ? -1 : 1) * (enemy.boss ? 6 : 12)
  const walkX = 0
  const faceDir = faceRight ? 1 : -1
  const castDuration = enemy.boss ? 1.06 : enemy.elite ? 0.78 : 0.66
  const castRatio = (enemy.casting ?? 0) > 0 ? Math.min(1, (enemy.casting ?? 0) / castDuration) : 0
  const castPose = castRatio > 0 ? 0.44 + (1 - castRatio) * 0.56 : 0
  const attackDuration = enemy.boss ? 0.46 : enemy.elite ? 0.34 : 0.28
  const attackAge = attackDuration - (enemy.attack ?? 0)
  const attackPower = (enemy.attack ?? 0) > 0 ? Math.sin(Math.max(0, Math.min(1, attackAge / attackDuration)) * Math.PI) : 0
  const actionX = faceDir * (attackPower * (enemy.boss ? 10 : enemy.elite ? 8 : 6) - castPose * (enemy.boss ? 6 : 4))
  const actionY = -attackPower * (motion === 'flying' ? 16 : 6) - castPose * (motion === 'flying' ? 4 : 2)
  const spriteX = x + recoilX + walkX + actionX
  const spriteY = baseY - hitT * 3 + actionY
  const lean = moving ? gait * (motion === 'heavy' ? 0.008 : 0.014) : Math.sin(phase * 0.5) * 0.012
  ctx.save()
  ctx.translate(spriteX, spriteY)
  ctx.globalAlpha = hitT > 0 ? 0.82 : 1
  ctx.fillStyle = 'rgba(0,0,0,.34)'
  ctx.beginPath()
  ctx.ellipse(-walkX * 0.5, 8 + walkBob * 0.5, layout.width * (motion === 'flying' ? 0.28 : 0.33), motion === 'flying' ? 6 : 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = enemy.boss ? '#facc15' : enemy.elite ? '#fb923c' : theme.accent
  ctx.shadowBlur = enemy.boss ? 26 : enemy.elite ? 20 : 12
  if (faceRight) ctx.scale(-1, 1)
  ctx.rotate(lean - hitT * 0.08 + (faceRight ? -1 : 1) * (attackPower * 0.08 - castPose * 0.045))
  const hitScale = 1 + hitT * 0.05 + (enemy.elite ? pulse * 0.018 : 0)
  const squashX = hitScale + attackPower * 0.08 + castPose * 0.025 + (moving && motion !== 'flying' ? Math.abs(gait) * 0.015 : 0)
  const squashY = hitScale - attackPower * 0.045 + castPose * 0.035 - (moving && motion !== 'flying' ? Math.abs(gait) * 0.012 : 0)
  ctx.scale(squashX, squashY)
  drawEnemySpriteFrame(sprite, layout, motion, gait, moving, attackPower, castPose)
  ctx.restore()

  drawEnemyAttackMotion(enemy, spriteX, spriteY, layout, motion, faceRight, attackPower, enemy.boss ? '#facc15' : enemy.elite ? '#fb923c' : theme.accent)

  if ((enemy.casting ?? 0) > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.2 + castPose * 0.48
    ctx.strokeStyle = enemy.boss ? '#facc15' : enemy.elite ? '#fb923c' : theme.accent
    ctx.fillStyle = ctx.strokeStyle
    ctx.shadowColor = ctx.strokeStyle
    ctx.shadowBlur = enemy.boss ? 28 : 18
    ctx.lineWidth = enemy.boss ? 4 : 2.5
    ctx.beginPath()
    ctx.ellipse(spriteX, spriteY - layout.height * 0.46, layout.width * (0.38 + castPose * 0.08), layout.height * (0.28 + castPose * 0.06), 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha *= 0.28
    ctx.beginPath()
    ctx.arc(spriteX, spriteY - layout.height * 0.62, layout.width * (0.18 + castPose * 0.08), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  if (enemy.elite || enemy.boss) {
    ctx.save()
    ctx.globalAlpha = enemy.boss ? 0.36 : 0.22
    ctx.strokeStyle = enemy.boss ? '#facc15' : theme.accent
    ctx.lineWidth = enemy.boss ? 3 : 2
    ctx.shadowColor = ctx.strokeStyle
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.ellipse(spriteX, spriteY - layout.height * 0.44, layout.width * 0.44, layout.height * 0.38, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  drawEnemyBar(enemy, spriteX, spriteY - layout.barY, layout.barWidth)
  return true
}

function drawSpiritEnemy(enemy: Enemy, x: number, groundY: number) {
  const theme = activeStageTheme()
  const pulse = Math.sin(performance.now() * 0.006 + enemy.id) * 0.5 + 0.5
  const y = groundY - 36 + Math.sin(performance.now() * 0.004 + enemy.id) * 6
  const size = enemy.boss ? 64 : enemy.elite ? 50 : 40
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
  const y = groundY - (enemy.elite ? 92 : 74) + Math.sin(performance.now() * 0.004 + enemy.id) * 7
  const scale = enemy.elite ? 1.34 : 1.16
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
  const width = enemy.elite ? 108 : 92
  const height = enemy.elite ? 64 : 54
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
  const size = boss ? 90 : enemy.elite ? 66 : 54
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
  const heroSprite = characterSprites[state.activeCharacter] ?? sprites.cultivator ?? sprites.player
  const useCharacterArt = heroSprite !== sprites.player

  ctx.save()
  ctx.translate(x, y)
  if (!useCharacterArt) ctx.rotate(heroFacing + Math.PI / 2)

  ctx.strokeStyle = 'rgba(34,211,238,.22)'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.arc(0, 3, 36, Math.PI * 0.06, Math.PI * 0.94)
  ctx.stroke()

  if (heroSprite.complete && heroSprite.naturalWidth > 0) {
    ctx.fillStyle = 'rgba(0,0,0,.34)'
    ctx.beginPath()
    ctx.ellipse(0, useCharacterArt ? 28 : 22, useCharacterArt ? 34 : 24, useCharacterArt ? 13 : 11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = '#22d3ee'
    ctx.shadowBlur = 20
    const spriteWidth = useCharacterArt ? 116 : 72
    const spriteHeight = useCharacterArt ? 134 : 86
    ctx.drawImage(heroSprite, -spriteWidth / 2, -spriteHeight + 18, spriteWidth, spriteHeight)
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
  const step = Math.sin(t * 0.85)
  ctx.save()
  if (moving) {
    ctx.globalAlpha = 0.28
    ctx.strokeStyle = 'rgba(125,211,252,.7)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 0; i < 6; i += 1) {
      const y = -88 + i * 18 + step * 4
      ctx.beginPath()
      ctx.moveTo(-86 - i * 7, y)
      ctx.bezierCurveTo(-62, y + 10, -44, y - 8, -18, y + 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.2
    ctx.strokeStyle = 'rgba(250,204,21,.7)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 2; i += 1) {
      const y = -54 + i * 22 + Math.cos(t * 0.7 + i) * 5
      ctx.beginPath()
      ctx.moveTo(-58 - i * 12, y)
      ctx.quadraticCurveTo(-28, y + 14, 5, y + 4)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#67e8f9'
    ctx.beginPath()
    ctx.ellipse(-42, 18, 34 + Math.abs(step) * 8, 7, 0, 0, Math.PI * 2)
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

function drawHeroCastingGesture(t: number, attackPulse: number) {
  const pulse = Math.min(1, 0.42 + Math.sin(t * 0.72) * 0.08 + attackPulse * 0.58)
  const sealX = 7 + Math.sin(t * 0.95) * 1.2
  const sealY = -90 + Math.cos(t * 0.82) * 1.4 - attackPulse * 4
  const breath = 0.86 + Math.sin(t * 0.75) * 0.06
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.globalAlpha = 0.18 + attackPulse * 0.18
  ctx.shadowColor = 'rgba(103,232,249,.75)'
  ctx.shadowBlur = 10 + attackPulse * 10
  ctx.strokeStyle = 'rgba(224,242,254,.62)'
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.moveTo(-33, -103)
  ctx.bezierCurveTo(-18, -96, -10, -93, sealX - 8, sealY + 4)
  ctx.moveTo(30, -101)
  ctx.bezierCurveTo(19, -95, 14, -92, sealX + 9, sealY + 4)
  ctx.stroke()

  ctx.shadowColor = '#67e8f9'
  ctx.shadowBlur = 16 + attackPulse * 14
  ctx.globalAlpha = pulse * 0.78
  ctx.strokeStyle = 'rgba(186,230,253,.9)'
  ctx.lineWidth = 2.4
  for (let i = 0; i < 3; i += 1) {
    const rx = 13 + i * 9 + attackPulse * 8
    const ry = (8 + i * 5 + attackPulse * 4) * breath
    ctx.globalAlpha = pulse * (0.62 - i * 0.13)
    ctx.beginPath()
    ctx.ellipse(sealX, sealY, rx, ry, t * 0.08 + i * 0.36, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.globalAlpha = pulse * 0.92
  ctx.strokeStyle = 'rgba(250,204,21,.92)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(sealX, sealY - 17 - attackPulse * 3)
  ctx.lineTo(sealX + 17 + attackPulse * 3, sealY)
  ctx.lineTo(sealX, sealY + 17 + attackPulse * 3)
  ctx.lineTo(sealX - 17 - attackPulse * 3, sealY)
  ctx.closePath()
  ctx.stroke()

  ctx.globalAlpha = pulse * 0.72
  ctx.strokeStyle = 'rgba(224,242,254,.95)'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(sealX - 10, sealY - 2)
  ctx.lineTo(sealX + 10, sealY - 2)
  ctx.moveTo(sealX - 7, sealY + 4)
  ctx.lineTo(sealX + 7, sealY + 4)
  ctx.moveTo(sealX, sealY - 10)
  ctx.lineTo(sealX, sealY + 12)
  ctx.stroke()

  ctx.fillStyle = 'rgba(125,211,252,.95)'
  for (let i = 0; i < 8; i += 1) {
    const a = -t * 0.7 + i * (Math.PI * 2 / 8)
    const rx = sealX + Math.cos(a) * (31 + attackPulse * 12)
    const ry = sealY + Math.sin(a) * (17 + attackPulse * 7)
    ctx.globalAlpha = pulse * (i % 2 === 0 ? 0.62 : 0.36)
    ctx.save()
    ctx.translate(rx, ry)
    ctx.rotate(a + Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(0, -5)
    ctx.lineTo(3, 2)
    ctx.lineTo(0, 5)
    ctx.lineTo(-3, 2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  if (attackPulse > 0) {
    ctx.globalAlpha = attackPulse * 0.48
    ctx.strokeStyle = 'rgba(224,242,254,.9)'
    ctx.lineWidth = 3
    ctx.shadowBlur = 26
    ctx.beginPath()
    ctx.moveTo(sealX + 14, sealY - 1)
    ctx.bezierCurveTo(sealX + 36, sealY - 18, sealX + 68, sealY - 16, sealX + 96, sealY - 32)
    ctx.stroke()
  }
  ctx.restore()
}

function drawHeroImageAnimated(heroSprite: HTMLImageElement, width: number, height: number, moving: boolean, attackPulse: number, t: number) {
  const step = Math.sin(t * 0.86)
  const float = Math.sin(t * 0.42)
  const tilt = moving ? step * 0.008 : float * 0.006
  if (moving) {
    ctx.save()
    ctx.globalAlpha = 0.08
    ctx.translate(-16 - Math.abs(step) * 3, 4 + float * 1.2)
    ctx.rotate(tilt * 0.4)
    ctx.drawImage(heroSprite, -width * 0.54, -height + 12, width, height)
    ctx.restore()
  }
  ctx.save()
  ctx.translate(moving ? Math.sin(t * 0.5) * 1.6 : 0, moving ? float * -1.8 : float * -1.1)
  ctx.rotate(tilt)
  ctx.scale(1 + attackPulse * 0.006, 1)
  ctx.drawImage(heroSprite, -width * 0.54, -height + 12, width, height)
  ctx.restore()
}

function getHeroActionFrame(isMoving: boolean, attackPulse: number) {
  if (state.activeCharacter !== 'sword') return -1
  if (attackPulse > 0.42) return 3
  if (attackPulse > 0.08 || autoSkillCastGap > 0.03) return 2
  if (isMoving || autoWorldWalk > 0 || !!moveTarget) return 1
  return 0
}

function drawHeroSheetFrame(sheet: HTMLImageElement, frame: number, width: number, height: number, moving: boolean, attackPulse: number, t: number) {
  const frameCount = 4
  const sourceW = sheet.naturalWidth / frameCount
  const sourceH = sheet.naturalHeight
  const frameIndex = Math.max(0, Math.min(frameCount - 1, frame))
  const float = Math.sin(t * 0.42)
  const step = Math.sin(t * 0.86)
  const frameOffsets = [
    { x: -6, y: 2, scale: 0.96 },
    { x: 2 + step * 1.6, y: -2, scale: 1 },
    { x: -2, y: -1, scale: 0.98 },
    { x: 18, y: -2, scale: 1.04 },
  ]
  const pose = frameOffsets[frameIndex]
  const drawW = width * pose.scale
  const drawH = height * pose.scale
  const tilt = moving ? step * 0.01 : float * 0.004

  if (moving) {
    ctx.save()
    ctx.globalAlpha = 0.12
    ctx.translate(-24 - Math.abs(step) * 5, 4 + float * 1.2)
    ctx.rotate(tilt * 0.45)
    ctx.drawImage(sheet, frameIndex * sourceW, 0, sourceW, sourceH, -drawW * 0.52 + pose.x, -drawH + 13 + pose.y, drawW, drawH)
    ctx.restore()
  }

  ctx.save()
  ctx.translate(pose.x + (moving ? Math.sin(t * 0.5) * 1.8 : 0), pose.y + (moving ? float * -1.6 : float * -0.9))
  ctx.rotate(tilt + attackPulse * 0.006)
  ctx.scale(1 + attackPulse * 0.012, 1)
  ctx.drawImage(sheet, frameIndex * sourceW, 0, sourceW, sourceH, -drawW * 0.52, -drawH + 13, drawW, drawH)
  ctx.restore()
}

function getHeroActionSprite(isMoving: boolean, attackPulse: number) {
  if (state.activeCharacter !== 'sword') return null
  if (attackPulse > 0.12) return swordActionSprites.slash
  if (isMoving || autoWorldWalk > 0 || !!moveTarget) return swordActionSprites.fly
  return swordActionSprites.idle
}

function drawHeroSide(x: number, groundY: number) {
  if (!ctx) {
    drawLegacyHero(x, groundY)
    return
  }
  const attackAge = performance.now() - lastAttackFlash
  const attackPulse = Math.max(0, 1 - attackAge / 820)
  const isAttacking = attackPulse > 0
  const isMoving = heroIsMoving()
  const t = performance.now() * 0.006
  const step = isMoving ? Math.sin(t * 0.86) : 0
  const actionSprite = getHeroActionSprite(isMoving, attackPulse)
  const actionFrame = getHeroActionFrame(isMoving, attackPulse)
  const actionSheet = actionFrame >= 0 ? swordActionSprites.sheet : null
  const useActionSheet = !!actionSheet?.complete && actionSheet.naturalWidth > 0
  const heroSprite = useActionSheet ? actionSheet : actionSprite ?? characterSprites[state.activeCharacter] ?? sprites.cultivator
  if (heroSprite.complete && heroSprite.naturalWidth > 0) {
    const usingActionSprite = heroSprite === actionSprite
    const usingActionSheet = useActionSheet && heroSprite === actionSheet
    const bob = isMoving ? Math.sin(t * 0.42) * 2.4 : Math.sin(t * 0.35) * 1.2
    ctx.save()
    ctx.translate(x, groundY + bob)
    if (shouldFlipHeroSprite()) ctx.scale(-1, 1)
    if (!usingActionSheet) drawRideSword(t, true)
    drawHeroMotionAura(t, isMoving, attackPulse)
    ctx.fillStyle = 'rgba(0,0,0,.34)'
    ctx.beginPath()
    ctx.ellipse(isMoving ? -4 - Math.abs(step) * 2 : 0, 18, usingActionSheet ? 66 : usingActionSprite ? 58 : isMoving ? 48 : 42, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = isAttacking ? '#e0f2fe' : '#67e8f9'
    ctx.shadowBlur = isAttacking ? 28 : 18
    const width = usingActionSheet ? 238 : usingActionSprite ? 222 : 166
    const height = usingActionSheet ? 308 : usingActionSprite ? 222 : 180
    if (usingActionSheet) drawHeroSheetFrame(heroSprite, actionFrame, width, height, isMoving, attackPulse, t)
    else drawHeroImageAnimated(heroSprite, width, height, isMoving, attackPulse, t)
    ctx.shadowBlur = 0
    if (!usingActionSheet || actionFrame === 2) drawHeroCastingGesture(t, attackPulse)
    ctx.strokeStyle = 'rgba(186,230,253,.68)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, -55, 34 + attackPulse * 4, 52, 0, -0.15, Math.PI * 1.1)
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
  const portraitUrl = versionedAsset(character.portrait)
  if (heroShowcaseImg.getAttribute('src') !== portraitUrl) heroShowcaseImg.src = portraitUrl
  const weapon = state.gear.weapon?.name ?? '无武器'
  const displayName = state.characterName || character.name
  heroShowcaseLevel.textContent = cultivationRealm()
  heroShowcaseTitle.textContent = `${displayName} · ${character.name} · ${state.mode === 'dungeon' ? dungeonStageTitle() : worldStageTitle()}`
  heroShowcaseGear.textContent = `本命术·${character.innateSkill} | ${character.title} | ${weapon}`
  heroShowcaseImg.classList.toggle('facing-left', shouldFlipHeroSprite())
}

function updateHud() {
  updateHeroShowcase()
  setText('ticket-count', String(state.tickets))
  setText('stone-count', String(state.spiritStones))
  setText('level-label', cultivationRealm())
  setText('atk-label', `攻击 ${totalAtk()}`)
  setText('mana-label', `法力 ${skillPower()}`)
  setText('kill-label', `击杀 ${state.kills}`)
  setText('soul-label', `魂质 ${state.soulExp}/${soulNeed()}`)
  const currentStage = worldStageNo()
  const stageGoal = worldStageGoal(currentStage)
  const stageStatus = state.bossSpawned || state.worldStageKills >= stageGoal
    ? `第${currentStage}关 Boss 战，击败后进入第${currentStage + 1}关`
    : `第${currentStage}关进度 ${state.worldStageKills}/${stageGoal}，满后挑战 Boss`
  setText('wave-label', state.mode === 'dungeon' ? `第${state.dungeonFloor}/${state.dungeonMaxFloors}层 ${Math.ceil(state.dungeonTime)}s` : `第${currentStage}关`)
  setText('mode-label', state.mode === 'dungeon' ? `副本·${dungeonStageTitle()}` : `世界地图·${worldStageTitle(currentStage)}`)
  setText('message', state.message)
  updateMainQuestLabel()
  const extractDistance = state.dungeonGateFound
    ? Math.round(Math.hypot(state.hero.x - state.dungeonExtractX, state.hero.y - state.dungeonExtractY))
    : 0
  const dungeon = activeDungeonDef()
  const dungeonKills = dungeonFloorKills()
  const floorGoal = dungeonFloorKillGoal(dungeon)
  const floorKillLabel = `${Math.min(dungeonKills, floorGoal)}/${floorGoal}`
  const gateProgress = state.dungeonGateFound ? `${dungeonGateLabel()} ${extractDistance}m` : `找${dungeonIsFinalFloor() ? '撤离门' : '下层入口'}`
  const dungeonProgress = state.mode === 'dungeon'
    ? state.bossSpawned
      ? `${dungeonFloorName()} ${state.dungeonFloor}/${state.dungeonMaxFloors} | Boss 战 | 门钥 ${state.dungeonMaterials}/${state.dungeonMaterialGoal} | 携带 券${state.dungeonLootTickets}/灵${state.dungeonLootStones}/精${state.dungeonLootSkill} | ${gateProgress}`
      : `${dungeonFloorName()} ${state.dungeonFloor}/${state.dungeonMaxFloors} | 清怪 ${floorKillLabel} | 门钥 ${state.dungeonMaterials}/${state.dungeonMaterialGoal} | 携带 券${state.dungeonLootTickets}/灵${state.dungeonLootStones}/精${state.dungeonLootSkill} | ${gateProgress}`
    : ''
  setText('quest-label', dungeonProgress || (state.questClaimed ? `${stageStatus} | 副本卷 ${state.dungeonEntries}张，世界Boss可掉落` : `${stageStatus} | 主线击杀 ${Math.min(state.kills, state.questTarget)}/${state.questTarget}`))
  const artifactCount = artifactKeys.filter((key) => hasArtifact(key)).length
  setText('gear-label', `法宝 ${artifactCount}/${artifactKeys.length} | 精华 ${state.skills.points} | 灵石 ${state.spiritStones} | 质变：${mutationSummary()} | 装备：${state.gear.weapon?.name ?? '无武器'} | ${state.gear.armor?.name ?? '无护甲'} | ${state.gear.core?.name ?? '无核心'}`)
  document.querySelector<HTMLElement>('#hp-bar')!.style.width = `${Math.max(0, state.hero.hp / maxHp()) * 100}%`
  modeBtn.textContent = state.mode === 'dungeon'
    ? state.dungeonGateFound
      ? (dungeonIsFinalFloor() ? '撤离' : '进下一层')
      : (dungeonIsFinalFloor() ? '找撤离门' : '找下层门')
    : `选择副本 ${state.dungeonEntries}张`
  autoOrb.classList.toggle('manual', !!moveTarget)
  autoOrb.classList.toggle('paused', state.mode === 'wild' && !state.autoExplore && !moveTarget)
  autoOrbLabel.innerHTML = moveTarget ? '手动<br>目标' : state.mode === 'dungeon' ? '副本<br>探索' : state.autoExplore ? '自动<br>推进' : '暂停<br>推进'
  pullOne.disabled = pulling || state.tickets < 1
  pullTen.disabled = pulling || state.tickets < 10
  gachaTicketCount.textContent = String(state.tickets)
  gachaStoneCount.textContent = String(state.spiritStones)
  gachaPityCount.textContent = `${Math.min(state.pity, 10)}/10`
  gachaPityBar.style.width = `${Math.min(100, state.pity * 10)}%`
}

function setText(id: string, text: string) {
  document.querySelector<HTMLElement>(`#${id}`)!.textContent = text
}

function toast(text: string) {
  state.message = text
}

function announceSkill(name: string, desc: string, color = '#67e8f9') {
  state.texts.push({ x: state.hero.x, y: state.hero.y - 126, text: `${name}·${desc}`, color, life: 0.82 })
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
  if (page !== 'artifact') closeArtifactDetail()
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
  const workStart = performance.now()
  const dt = Math.min(0.033, (now - last) / 1000)
  last = now
  update(dt)
  draw()
  lastFrameWorkMs = performance.now() - workStart
  // 每 30 秒自动存档一次，避免在 gainSoul 中高频写入 localStorage
  if (now - lastAutoSave >= 30000) {
    saveGame()
    lastAutoSave = now
  }
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
  profileModeLogin.addEventListener('click', () => setProfileAuthMode('login'))
  profileModeRegister.addEventListener('click', () => setProfileAuthMode('register'))
  profileSync.addEventListener('click', async () => {
    setProfileBusy(true)
    setProfileError('')
    try {
      saveGame()
      const save = readActiveProfileSave()
      clearQueuedCloudSave()
      await syncCloudSaveNow(save)
      toast('云端同步完成。')
    } catch (error) {
      cloudSyncState = 'error'
      cloudSyncMessage = (error as Error).message
      setProfileError((error as Error).message)
      updateCloudStatus()
    } finally {
      setProfileBusy(false)
      updateCloudStatus()
    }
  })
  profileChangePassword.addEventListener('click', () => {
    void changeCloudPassword()
  })
  profileCreateCancel.addEventListener('click', closeCharacterCreator)
  profileCreateConfirm.addEventListener('click', confirmCreateCharacterSlot)
  profileCreateSlot.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    confirmCreateCharacterSlot()
  })
  profilePasswordBox.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void changeCloudPassword()
  })
  profileLogout.addEventListener('click', () => {
    void logoutProfile()
  })
  profileGuest.addEventListener('click', () => {
    const index = readProfileIndex()
    const existing = index.profiles.find((profile) => profile.name === '游客')
    if (existing) {
      activateProfile(existing.id)
      return
    }
    const profile = createProfile('游客', '')
    index.profiles.push(profile)
    index.activeId = profile.id
    writeProfileIndex(index)
    activateProfile(profile.id)
  })
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const name = normalizeProfileName(profileNameInput.value)
    const pin = profilePinInput.value.trim()
    if (!name) {
      setProfileError('先输入玩家名。')
      profileNameInput.focus()
      return
    }
    setProfileBusy(true)
    if (profileAuthMode === 'login') {
      try {
        const result = await accountRequest<{ user: ServerUser }>('/login', { method: 'POST', json: { username: name, password: pin } })
        await activateServerUser(result.user)
        setProfileBusy(false)
        return
      } catch (error) {
        if (!apiUnavailable(error)) {
          setProfileError((error as Error).message)
          setProfileBusy(false)
          return
        }
      }
    } else {
      if (pin.length < 4) {
        setProfileError('注册密码至少 4 位；也可以用游客进入。')
        profilePinInput.focus()
        setProfileBusy(false)
        return
      }
      try {
        const result = await accountRequest<{ user: ServerUser }>('/register', { method: 'POST', json: { username: name, password: pin } })
        await activateServerUser(result.user)
        setProfileBusy(false)
        return
      } catch (error) {
        if (!apiUnavailable(error)) {
          setProfileError((error as Error).message)
          setProfileBusy(false)
          return
        }
      }
    }

    const index = readProfileIndex()
    const existing = index.profiles.find((profile) => profile.name.toLowerCase() === name.toLowerCase())
    if (profileAuthMode === 'login') {
      if (!existing) {
        setProfileError('服务器暂不可用，且本机没有这个档案。')
        setProfileBusy(false)
        return
      }
      if (existing.pin && existing.pin !== pin) {
        setProfileError('登录密码不对。')
        profilePinInput.focus()
        setProfileBusy(false)
        return
      }
      activateProfile(existing.id)
      setProfileBusy(false)
      return
    }
    if (existing) {
      setProfileAuthMode('login')
      setProfileError('这个账号已存在，切到登录继续。')
      profileNameInput.focus()
      setProfileBusy(false)
      return
    }
    if (pin.length < 4) {
      setProfileError('注册密码至少 4 位；也可以用游客进入。')
      profilePinInput.focus()
      setProfileBusy(false)
      return
    }
    const profile = createProfile(name, pin)
    index.profiles.push(profile)
    index.activeId = profile.id
    writeProfileIndex(index)
    activateProfile(profile.id)
    setProfileBusy(false)
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
  closeSettlement.addEventListener('click', () => {
    clearSettlementAutoClose()
    settlementPanel.hidden = true
  })
  closeEquip.addEventListener('click', () => { showPage('battle') })
  closeBag.addEventListener('click', () => { showPage('battle') })
  closeSkillPanel.addEventListener('click', () => { showPage('battle') })
  artifactDetailPanel.addEventListener('click', (event) => {
    if (event.target === artifactDetailPanel) closeArtifactDetail()
  })
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !artifactDetailPanel.hidden) closeArtifactDetail()
  })
  pullOne.addEventListener('click', () => pull(1))
  pullTen.addEventListener('click', () => pull(10))
}

function toggleAutoExplore() {
  if (state.mode !== 'wild') {
    toast('副本中使用点击落点移动，撤离后可切换自动推进。')
    updateHud()
    return
  }
  state.autoExplore = true
  moveTarget = null
  input = { x: 0, y: 0 }
  toast('自动推进已开启，魂球会自动吸收。')
  saveGame()
  updateHud()
}

function setMoveTargetFromPointer(event: PointerEvent, immediateTap: boolean) {
  if (activePage !== 'battle' || !evolutionPanel.hidden || !settlementPanel.hidden || !lorePanel.hidden || !profilePanel.hidden) return
  const now = performance.now()
  const minGap = immediateTap ? 120 : 34
  if (now - lastMoveTargetSetAt < minGap) return
  lastMoveTargetSetAt = now
  const rect = canvas.getBoundingClientRect()
  const sx = ((event.clientX - rect.left) / rect.width) * canvas.width
  const sy = ((event.clientY - rect.top) / rect.height) * canvas.height
  const groundY = canvas.height * 0.72
  const ox = heroScreenX(canvas.width) - state.hero.x
  const oy = groundY - state.hero.y
  moveTarget = {
    x: sx - ox,
    y: Math.max(-44, Math.min(44, sy - oy)),
  }
  moveTargetPulse = 0.45
  heroFacing = moveTarget.x < state.hero.x ? Math.PI : 0
  advanceGuide(0)
}

bindControls()
initProfiles()
if (activeProfile) loadGame()
void restoreServerSession()
ensureEnemies()
updateHud()
updateGuide()
setInterval(saveGame, 5000)
window.addEventListener('beforeunload', saveGame)
requestAnimationFrame(loop)
