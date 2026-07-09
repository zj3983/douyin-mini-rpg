# Cocos 资源管线记录

## 当前资产批次

第一批 PNG 资源来自三张 AI 生成素材板：

- `assets/resources/Assets/Generated/Atlases/characters-atlas.png`
- `assets/resources/Assets/Generated/Atlases/monsters-atlas.png`
- `assets/resources/Assets/Generated/Atlases/artifacts-skills-atlas.png`

素材板已经切到 `asset-catalog.json` 引用的目录里，当前可被 Cocos 直接导入。

## 当前动作帧批次

角色和怪物已经生成第一版 4 帧 PNG strip：

- 角色：`idle`、`move`、`cast`、`hurt`
- 怪物：`idle`、`move`、`attack`、`hurt`、`death`

这批帧表用于 Cocos 预览和节点挂载，不是最终美术。它们从现有 PNG 派生，能先解决“完全不会动”的问题；后续需要替换成透明全身横版动作帧。

## 统一动画图集

运行时优先使用统一图集，而不是逐动作加载独立 strip：

- 每个角色或怪物对应一张 `atlas.png`。
- `assets/Data/animation-atlas.json` 记录动作名、帧 rect、播放顺序、FPS 和循环规则。
- `AtlasAnimator` 只需要加载一张贴图，然后按配置切换不同动作。

这能减少资源数量和加载次数，后续多动作角色不会因为移动、攻击、受击、死亡分散成多张图而增加运行时开销。

## 目录约定

- `assets/resources/Assets/Characters/*`：角色立绘和战斗图。
- `assets/resources/Assets/Monsters/*`：怪物身体图，按场景主题拆分。
- `assets/resources/Assets/Artifacts/*`：法宝图标。
- `assets/resources/Assets/Skills/*`：技能图标、飞行物、命中特效、满屏特效。

## 后续替换顺序

1. 先替换角色战斗图为横版半身或全身透明 PNG。
2. 再补角色动作帧：待机、踩剑移动、掐诀施法、受击。
3. 再补怪物动作帧：待机、移动、攻击、受击、死亡。
4. 最后把技能图标和技能特效拆开，不再复用同一张切片。

## AI 序列帧处理

AI 生成的连续 PNG 帧先放到临时目录，再用脚本统一处理：

```bash
python tools/build-frame-strip.py --input-dir tmp/source-frames --output assets/resources/Assets/Characters/QinglanSwordCultivator/Frames/idle.png --frame-width 256 --frame-height 256 --limit 4
```

脚本会做三件事：

- 按 alpha 边界裁掉空白。
- 居中到固定画布。
- 横向打包成 Cocos 播放用 strip。

如果要生成统一图集，执行：

```bash
python tools/build-actor-atlases.py
```

这个脚本会读取 `asset-catalog.json` 里的动作帧路径，生成每个角色/怪物自己的 atlas 和 `animation-atlas.json`。

## 运行时性能约束

- 多动作角色使用 `AtlasAnimator`，一个 actor 只加载一张 atlas。
- 怪物、魂球、飞剑、伤害数字和技能特效使用 `NodePoolController` 复用节点。
- 拾取魂球时只触发回收，不直接 `destroy()`。
- 离屏或距离过远的动画通过 `StripAnimationRuntime` 降低更新频率。

## 战斗运行时接入

- `BattleRuntime` 负责纯规则：刷怪、Boss 出场、Boss 技能事件、飞剑命中、伤害事件、死亡、魂球掉落、关卡通关、结算领奖。
- `EnemySpawner` 负责把规则里的怪物生成事件映射成 Cocos 节点。
- `BattleRuntimeController` 负责把 Boss 技能、御剑命中、伤害飘字、魂球对象池和破关结算串起来。
- `StageClearPanelController` 负责把破关结算结果渲染到 Cocos 面板，后续只需要在编辑器里绑定 prefab 字段。
- 御剑命中按飞剑线段轨迹、怪物坐标和碰撞半径计算，不再简单取前几个活怪。
- 当前仍是第一版闭环，后续需要继续接 Boss 技能 prefab 表现、结算面板美术 prefab 和更强命中特效。

## 验证

`tests/assetCatalog.test.mjs` 会检查清单中所有图片路径真实存在。
