# Boss 古篆符胆预警 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用古篆符胆、动态阵框和短寿命爆发替换第一关 Boss 的实心矩形预警，同时保持权威判定、时序和对象池容量不变。

**Architecture:** 新增不依赖 Cocos 的视觉 profile 模块，将 `danger.kind` 映射为符胆资源与颜色；新增池化节点视觉控制器，统一重置 `Graphics` 与 `Sprite`；`BossTelegraphPresenter` 继续拥有时序和代际，只负责把权威区域交给对应绘制器。符胆资源启动时异步预取，失败时回退为无字符阵，不阻断攻击。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Node test runner、Cocos `Graphics`/`Sprite`/`resources`、透明 PNG、现有 `NodePoolController`。

---

## 文件结构

- Create: `cocos-client/assets/Scripts/Core/BossTelegraphVisualProfile.ts` — 纯数据 profile、颜色和倒计时脉冲计算。
- Create: `cocos-client/tools/boss-telegraph-visual-profile.mjs` — Node 测试可执行镜像。
- Create: `cocos-client/tests/bossTelegraphVisualProfile.test.mjs` — profile、脉冲和 TS/ESM 一致性测试。
- Create: `cocos-client/assets/Scripts/Game/BossHazardVisualController.ts` — 单个池化预警节点的符胆、图形和回收重置。
- Create: `cocos-client/tests/bossHazardVisualController.test.mjs` — 连续复用与残留状态测试。
- Modify: `cocos-client/assets/Scripts/Game/BossTelegraphPresenter.ts` — 分招式绘制、资源预取、进度更新和无字回退。
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts` — 为每个 Boss 特效节点创建持久 `Talisman` Sprite 子节点并绑定控制器。
- Modify: `cocos-client/tests/bossTelegraphPresenter.test.mjs` — 保留时序/容量测试并验证不再绘制实心通用矩形。
- Modify: `cocos-client/tests/playableBattle.test.mjs` — 锁定运行时节点结构和资源预取接线。
- Create: `cocos-client/tests/bossTalismanAssets.test.mjs` — 三张透明符胆资源的存在、尺寸、透明度和差异性测试。
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_sweep.png` — `斩`符胆。
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_spike.png` — `突`符胆。
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_roar.png` — `镇`符胆。

### Task 1: 建立纯数据视觉 Profile

**Files:**
- Create: `cocos-client/assets/Scripts/Core/BossTelegraphVisualProfile.ts`
- Create: `cocos-client/tools/boss-telegraph-visual-profile.mjs`
- Create: `cocos-client/tests/bossTelegraphVisualProfile.test.mjs`

- [ ] **Step 1: 写 profile 映射的失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveBossTelegraphVisual, talismanPulse } from '../tools/boss-telegraph-visual-profile.mjs'

test('three Boss dangers resolve to distinct talisman profiles', () => {
  assert.deepEqual(
    ['sweep', 'spike', 'roar-sector'].map((kind) => resolveBossTelegraphVisual({ kind }).id),
    ['sweep-seal', 'spike-seal', 'roar-seal'],
  )
  assert.equal(resolveBossTelegraphVisual({ kind: 'sweep' }).talismanPath.endsWith('talisman_sweep/spriteFrame'), true)
  assert.equal(resolveBossTelegraphVisual({ kind: 'spike' }).glyph, '突')
  assert.equal(resolveBossTelegraphVisual({ kind: 'roar-sector' }).glyph, '镇')
})

test('last 0.15 seconds pulses without changing geometry', () => {
  assert.deepEqual(talismanPulse(0.8, 0.8), { progress: 0, alpha: 0.54, hot: false })
  assert.equal(talismanPulse(0.8, 0.1).hot, true)
  assert.equal(talismanPulse(0.8, 0).progress, 1)
})
```

- [ ] **Step 2: 运行测试并确认因导出不存在而失败**

Run: `cd cocos-client && node --test tests/bossTelegraphVisualProfile.test.mjs`

Expected: FAIL，提示 `resolveBossTelegraphVisual` 或模块不存在。

- [ ] **Step 3: 实现最小纯数据模块**

```ts
export type BossTelegraphVisualId = 'sweep-seal' | 'spike-seal' | 'roar-seal'

export interface BossTelegraphVisualProfile {
  readonly id: BossTelegraphVisualId
  readonly glyph: '斩' | '突' | '镇'
  readonly talismanPath: string
  readonly warning: readonly [number, number, number, number]
  readonly spirit: readonly [number, number, number, number]
  readonly impact: readonly [number, number, number, number]
}

const PROFILES = Object.freeze({
  sweep: Object.freeze({ id: 'sweep-seal', glyph: '斩', talismanPath: 'Assets/Skills/BossDomain/talisman_sweep/spriteFrame', warning: [232, 190, 88, 220] as const, spirit: [141, 232, 218, 190] as const, impact: [255, 240, 189, 245] as const }),
  spike: Object.freeze({ id: 'spike-seal', glyph: '突', talismanPath: 'Assets/Skills/BossDomain/talisman_spike/spriteFrame', warning: [164, 58, 44, 220] as const, spirit: [141, 232, 218, 190] as const, impact: [255, 240, 189, 245] as const }),
  'roar-sector': Object.freeze({ id: 'roar-seal', glyph: '镇', talismanPath: 'Assets/Skills/BossDomain/talisman_roar/spriteFrame', warning: [232, 190, 88, 220] as const, spirit: [141, 232, 218, 190] as const, impact: [255, 240, 189, 245] as const }),
}) satisfies Readonly<Record<string, BossTelegraphVisualProfile>>

export function resolveBossTelegraphVisual(danger: { readonly kind: string }): BossTelegraphVisualProfile {
  return PROFILES[danger.kind as keyof typeof PROFILES] ?? PROFILES.sweep
}

export function talismanPulse(duration: number, remaining: number) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  const safeRemaining = Math.max(0, Math.min(safeDuration, Number.isFinite(remaining) ? remaining : safeDuration))
  const progress = Math.round((1 - safeRemaining / safeDuration) * 1000) / 1000
  const hot = safeRemaining <= 0.15
  const alpha = hot ? 0.72 + 0.2 * Math.sin(progress * Math.PI * 18) : 0.54 + progress * 0.24
  return { progress, alpha: Math.round(alpha * 1000) / 1000, hot }
}
```

将同样行为写入 `tools/boss-telegraph-visual-profile.mjs`，并增加 TypeScript 经 `stripTypeScriptTypes` 后与 ESM 镜像输出一致的测试。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd cocos-client && node --test tests/bossTelegraphVisualProfile.test.mjs`

Expected: PASS，至少 3 项测试通过。

- [ ] **Step 5: 提交 profile**

```bash
git add cocos-client/assets/Scripts/Core/BossTelegraphVisualProfile.ts cocos-client/tools/boss-telegraph-visual-profile.mjs cocos-client/tests/bossTelegraphVisualProfile.test.mjs
git commit -m "feat: define boss talisman visual profiles"
```

### Task 2: 生成并校验三张符胆资源

**Files:**
- Create: `cocos-client/tests/bossTalismanAssets.test.mjs`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_sweep.png`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_spike.png`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_roar.png`

- [ ] **Step 1: 写资源契约失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { decodePngRgba } from '../tools/png-alpha-runtime.mjs'

test('Boss talismans are distinct transparent square PNG assets', async () => {
  const names = ['talisman_sweep.png', 'talisman_spike.png', 'talisman_roar.png']
  const buffers = await Promise.all(names.map((name) => readFile(resolve('assets/resources/Assets/Skills/BossDomain', name))))
  for (const buffer of buffers) {
    const image = decodePngRgba(buffer)
    assert.equal(image.width, image.height)
    assert.ok(image.width >= 512 && image.width <= 2048)
    assert.equal(image.data.some((value, index) => index % 4 === 3 && value === 0), true)
    assert.equal(image.data.some((value, index) => index % 4 === 3 && value > 180), true)
  }
  assert.equal(new Set(buffers.map((buffer) => createHash('sha256').update(buffer).digest('hex'))).size, 3)
})
```

- [ ] **Step 2: 运行测试确认因资源缺失而失败**

Run: `cd cocos-client && node --test tests/bossTalismanAssets.test.mjs`

Expected: FAIL，提示 `ENOENT talisman_sweep.png`。

- [ ] **Step 3: 用图像生成工具分别生成三张 512×512 透明 PNG**

测试文件从 `../tools/png-alpha-runtime.mjs` 导入 `decodePngRgba`，不增加新的图片解析依赖。

每张都使用以下固定约束：正方形画布、单个古篆符胆居中、残缺朱砂笔触、暗金边缘、透明背景、无阵框、无场景、无额外文字、无发光底板。三个提示词的主体分别为：

```text
斩：古篆“斩”字，笔势横向锐利，像竹叶剑痕。
突：古篆“突”字，笔势由下向上，像地脉竹刺。
镇：古篆“镇”字，笔势厚重稳定，像山岳封印。
```

生成后保存到上述精确路径；不要从一张合图裁切，避免三个符胆共享底纹。

- [ ] **Step 4: 运行资源测试确认通过**

Run: `cd cocos-client && node --test tests/bossTalismanAssets.test.mjs`

Expected: PASS，三张图尺寸、透明通道和哈希均符合契约。

- [ ] **Step 5: 提交原始资源与测试**

```bash
git add cocos-client/tests/bossTalismanAssets.test.mjs cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_*.png
git commit -m "feat: add boss talisman artwork"
```

### Task 3: 建立池化 Boss 特效节点控制器

**Files:**
- Create: `cocos-client/assets/Scripts/Game/BossHazardVisualController.ts`
- Create: `cocos-client/tests/bossHazardVisualController.test.mjs`
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`

- [ ] **Step 1: 写连续复用失败测试**

测试应实例化 Cocos mock 控制器，按 `sweep → spike → roar → despawn` 连续 20 轮调用，并断言每次 `resetVisual()` 后：

```js
assert.equal(graphics.calls.at(-1).type, 'clear')
assert.equal(sprite.spriteFrame, null)
assert.equal(sprite.color.a, 0)
assert.deepEqual(sprite.node.scale, { x: 1, y: 1, z: 1 })
assert.equal(sprite.node.angle, 0)
```

- [ ] **Step 2: 运行测试并确认控制器不存在**

Run: `cd cocos-client && node --test tests/bossHazardVisualController.test.mjs`

Expected: FAIL，提示无法导入 `BossHazardVisualController.ts`。

- [ ] **Step 3: 实现控制器的最小接口**

```ts
@ccclass('BossHazardVisualController')
export class BossHazardVisualController extends Component {
  @property(Graphics) graphics: Graphics | null = null
  @property(Sprite) talisman: Sprite | null = null

  resetVisual(): void {
    this.graphics?.clear()
    if (!this.talisman) return
    this.talisman.spriteFrame = null
    this.talisman.color = new Color(255, 255, 255, 0)
    this.talisman.node.setScale(1, 1, 1)
    this.talisman.node.setRotationFromEuler(0, 0, 0)
  }

  setTalisman(frame: SpriteFrame | null, color: Color, width: number, height: number): void {
    if (!this.talisman) return
    this.talisman.spriteFrame = frame
    this.talisman.color = color
    this.talisman.node.getComponent(UITransform)?.setContentSize(Math.min(width, 112), Math.min(height, 112))
  }
}
```

在 `createBossEffectNode()` 中一次性创建 `Talisman` 子节点和 `Sprite`，把 `Graphics`、`Sprite` 绑定到控制器；注册 `pool-despawned` 时调用 `resetVisual()`。

- [ ] **Step 4: 运行控制器与结构测试**

Run: `cd cocos-client && node --test tests/bossHazardVisualController.test.mjs tests/playableBattle.test.mjs`

Expected: PASS，池化状态无残留，工厂节点包含 `Graphics`、`Sprite`、`BossHazardVisualController` 和 `PoolableActor`。

- [ ] **Step 5: 提交池化节点结构**

```bash
git add cocos-client/assets/Scripts/Game/BossHazardVisualController.ts cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts cocos-client/tests/bossHazardVisualController.test.mjs cocos-client/tests/playableBattle.test.mjs
git commit -m "feat: add pooled boss hazard visuals"
```

### Task 4: 将 Presenter 改为分招式阵纹绘制

**Files:**
- Modify: `cocos-client/assets/Scripts/Game/BossTelegraphPresenter.ts`
- Modify: `cocos-client/tests/bossTelegraphPresenter.test.mjs`

- [ ] **Step 1: 扩展 Presenter 测试并先观察失败**

为测试节点增加 `BossHazardVisualController` mock，断言：

```js
assert.equal(sweepNode.visual.profileId, 'sweep-seal')
assert.equal(spikeNode.visual.profileId, 'spike-seal')
assert.equal(roarNode.visual.profileId, 'roar-seal')
assert.equal(telegraphNode.graphics.calls.some((call) => call.type === 'fill'), false)
assert.equal(telegraphNode.graphics.calls.some((call) => call.type === 'rect'), false)
assert.deepEqual(pool.activationLog.map((entry) => entry.area), expected.telegraph)
```

最后一条必须继续证明视觉节点的位置和尺寸完全覆盖权威判定区域。

- [ ] **Step 2: 运行测试确认仍使用通用 `drawArea` 而失败**

Run: `cd cocos-client && node --test tests/bossTelegraphPresenter.test.mjs`

Expected: FAIL，profile 未设置或仍出现 `rect/fill` 调用。

- [ ] **Step 3: 实现资源预取与安全回退**

在 Presenter 中维护只读路径到 `SpriteFrame` 的缓存：

```ts
private readonly talismanFrames = new Map<string, SpriteFrame>()

preloadTalismans(): void {
  for (const kind of ['sweep', 'spike', 'roar-sector'] as const) {
    const profile = resolveBossTelegraphVisual({ kind })
    resources.load(profile.talismanPath, SpriteFrame, (error, frame) => {
      if (!error && frame && this.node.isValid) this.talismanFrames.set(profile.talismanPath, frame)
    })
  }
}
```

加载失败不记录错误状态；绘制时传入 `null` 即为无字符阵回退，攻击仍按原时序激活。

- [ ] **Step 4: 实现三种预警绘制器**

将 `drawArea` 替换为按 profile 分派的方法：

```ts
private drawTelegraph(node: Node, delivery: EnemyTelegraphDelivery): void {
  const profile = resolveBossTelegraphVisual(delivery.danger ?? { kind: 'sweep' })
  const geometry = centerAndSize(delivery.area)
  this.prepareNode(node, geometry)
  if (profile.id === 'sweep-seal') this.drawSweepTelegraph(node, geometry, profile)
  else if (profile.id === 'spike-seal') this.drawSpikeTelegraph(node, geometry, profile)
  else this.drawRoarTelegraph(node, geometry, profile, delivery.danger)
}
```

绘制约束：预警阶段只能调用 `moveTo`、`lineTo`、`circle`、`ellipse`、`stroke`，不得调用 `fill` 或 `rect`；爆发阶段可绘制短寿命裂纹和白金边线，但内部 alpha 不得超过 51（20%）。安全缺口由 BossBrain 不生成危险 sector 保证，Presenter 不补画缺口。

- [ ] **Step 5: 为每个视觉记录原始 duration 并更新倒计时脉冲**

把 `TelegraphVisual` 扩展为 `{ node, duration, remaining }`，在 `update` 中调用 `talismanPulse(duration, remaining)`，只更新符胆透明度和阵框颜色，不修改节点位置、尺寸或 authority key。

- [ ] **Step 6: 运行 Presenter 全套测试**

Run: `cd cocos-client && node --test tests/bossTelegraphPresenter.test.mjs tests/bossTelegraphVisualProfile.test.mjs`

Expected: PASS，三招差异化、权威区域、0.8 秒时序、18 节点容量与代际清理全部保持。

- [ ] **Step 7: 提交 Presenter 改造**

```bash
git add cocos-client/assets/Scripts/Game/BossTelegraphPresenter.ts cocos-client/tests/bossTelegraphPresenter.test.mjs
git commit -m "feat: render boss talisman telegraphs"
```

### Task 5: Cocos 导入、全量测试和构建验证

**Files:**
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_sweep.png.meta`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_spike.png.meta`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_roar.png.meta`
- Verify only: `cocos-client/build/web-mobile/**`

- [ ] **Step 1: 用 Cocos Creator 3.8.8 打开或构建项目，使三张 PNG 生成合法 `.meta`**

Run from PowerShell with `Start-Process -Wait`:

```powershell
$args=@('--project','D:\游戏\douyin-mini-rpg\.worktrees\combat-vertical-slice\cocos-client','--build','platform=web-mobile;debug=false')
Start-Process -FilePath 'D:\CocosCreator\3.8.8\CocosCreator.exe' -ArgumentList $args -Wait -WindowStyle Hidden
```

Expected: 构建日志包含 `build Task (web-mobile) Finished`。进程可能以已知的退出码 36 结束，必须以日志和正式产物验证结果为准。

- [ ] **Step 2: 运行资源测试、全量测试和正式产物验证**

```bash
cd cocos-client
node --test tests/bossTalismanAssets.test.mjs tests/bossTelegraphVisualProfile.test.mjs tests/bossHazardVisualController.test.mjs tests/bossTelegraphPresenter.test.mjs
npm.cmd test
npm.cmd run verify:build-output -- build/web-mobile
git diff --check
```

Expected: 所有测试通过，唯一允许的跳过项仍是依赖显式 `COCOS_BUILD_ROOT` 的条件测试，产物验证输出 `"ok": true`。

- [ ] **Step 3: 只提交三张新资源对应的 `.meta`**

```bash
git add cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_*.png.meta
git commit -m "chore: import boss talisman assets"
```

不要把 Cocos 重建产生的无关音频 meta、设置文件或整个 `build/web-mobile` 目录加入此提交。

### Task 6: 浏览器自动试玩验收

**Files:**
- No source changes expected.

- [ ] **Step 1: 启动本地 Web 构建服务**

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory build/web-mobile
```

Expected: `http://127.0.0.1:4173/` 返回 Cocos 游戏。

- [ ] **Step 2: 在 390×844 竖屏运行到 Boss 首次完成三种招式**

验收：控制台 0 error/warn；人物、Boss 和飞剑在预警期间可见；横扫上下有逃生空间；竹刺三个落点顺序出现；咆哮安全缺口无危险绘制。

- [ ] **Step 3: 在横屏运行同一流程并记录性能**

验收：没有池耗尽异常、没有同帧生成/销毁抖动、技能期间无明显长帧；符胆加载失败模拟下仍能显示无字符阵并正常结算伤害。

- [ ] **Step 4: 最终检查与提交（仅在验收发现并修复问题时）**

```bash
git status --short
git log -6 --oneline
```

Expected: 计划内源码与资源均已提交；允许保留本地 Cocos 构建产物和既有 `tools/__pycache__/`，不得误提交或删除它们。
