# Cocos 场景装配清单

这份清单用于在 Cocos Creator 里把第一条横版修仙战斗线装起来。当前代码已经有规则、对象池、Boss、结算和下一关切换，编辑器里重点是把节点和字段拖对。

机器可读蓝图位于 `assets/Data/scene-blueprint.json`，可用测试里的 `validate-scene-blueprint.mjs` 校验关键节点、组件和绑定没有遗漏。

## 推荐节点树

```text
Canvas
  BattleRoot
    Runtime
    WorldLayer
    ActorLayer
      EnemySpawner
    EffectLayer
    DropLayer
    HudLayer
      StatusLabel
      StageClearPanel
        TitleLabel
        RewardLabel
        NextStageLabel
        NextStageButton
  Pools
    SoulOrbPool
    DamageNumberPool
    BossSkillEffectPool
    EnemyPool
```

## Runtime 节点

在 `BattleRoot/Runtime` 挂 `BattleRuntimeController`。

字段绑定：

- `designData`：拖入 `assets/Data/cultivation-design.json` 对应的 JsonAsset。
- `statusLabel`：拖入 `HudLayer/StatusLabel`。
- `stageClearPanel`：拖入 `HudLayer/StageClearPanel` 上的 `StageClearPanelController`。
- `enemySpawner`：拖入 `ActorLayer/EnemySpawner` 上的 `EnemySpawner`。
- `soulOrbPool`：拖入 `Pools/SoulOrbPool` 上的 `NodePoolController`。
- `damageNumberPool`：拖入 `Pools/DamageNumberPool` 上的 `NodePoolController`。
- `bossSkillEffectPool`：拖入 `Pools/BossSkillEffectPool` 上的 `NodePoolController`。
- `stageNumber`：默认 `1`。
- `heroAttack`：调试期可用 `260` 快速打死 Boss，正式调回数值表。
- `swordStartX` / `swordEndX` / `swordY` / `swordHitWidth`：先按横版主角前方路径调，后续接真实飞剑节点。

按钮事件：

- `NextStageButton` 的 click event 绑定 `BattleRoot/Runtime`。
- Component 选择 `BattleRuntimeController`。
- Handler 选择 `advanceToNextStageFromPanel`。

## StageClearPanel 节点

## EnemySpawner 节点

在 `BattleRoot/ActorLayer/EnemySpawner` 挂 `EnemySpawner`。

字段绑定：

- `enemyPool`：拖入 `Pools/EnemyPool` 上的 `NodePoolController`。
- `spawnX`：小怪出生横坐标，默认 `520`。
- `groundY`：地面怪高度，默认 `-60`。
- `flyingY`：飞行怪高度，默认 `70`。
- `bossSpawnX`：Boss 出生横坐标，默认 `610`。
- `bossY`：Boss 高度，默认 `-38`。
- `bossScale`：Boss 节点缩放，默认 `1.45`。

运行时行为：

- `BattleRuntimeController.update(deltaTime)` 统一调用规则层刷怪。
- 生成成功后调用 `EnemySpawner.spawnEnemy(enemy)`，从对象池取怪物节点并设置位置。
- `summonWorldBoss()` 成功后同样调用 `EnemySpawner.spawnEnemy(result.enemy)`，Boss 会使用单独的坐标和缩放。
- `BattleRuntimeController` 会登记生成出的节点；飞剑命中时节点收到 `enemy-hit` 事件，死亡时收到 `enemy-defeated` 事件。
- `EnemyVisualController` 收到 `enemy-hit` 播放 `hurt`，收到 `enemy-defeated` 播放 `death`，随后运行时延迟回收到 `EnemyPool`。
- `EnemySpawner` 不再创建自己的 `BattleRuntime`，避免和 Boss/结算状态分裂。

在 `HudLayer/StageClearPanel` 挂 `StageClearPanelController`。

字段绑定：

- `panelRoot`：拖入 `StageClearPanel` 自己。
- `titleLabel`：拖入 `TitleLabel`。
- `rewardLabel`：拖入 `RewardLabel`。
- `nextStageLabel`：拖入 `NextStageLabel`。
- `nextStageButton`：拖入 `NextStageButton` 上的 Button。

运行时行为：

- `showResult(result)` 会显示面板并写入破关标题、灵石、法宝精华、副本卷、下一关文本。
- `nextStageTarget` 会保存 `result.nextStageId`，方便调试查看。
- `advanceToNextStageFromPanel` 会读取面板结果，隐藏面板并重建下一关运行时。

## 对象池节点

每个对象池节点都挂 `NodePoolController`。

`SoulOrbPool`：

- `poolKey`：`soul-orb`
- `capacity`：`80`
- `prefab`：挂带 `PoolableActor` 和 `SoulOrbController` 的魂球 prefab。

`DamageNumberPool`：

- `poolKey`：`damage-number`
- `capacity`：`120`
- `prefab`：挂带 `PoolableActor` 和 `DamageNumberController` 的伤害数字 prefab。

`BossSkillEffectPool`：

- `poolKey`：`boss-skill-effect`
- `capacity`：`24`
- `prefab`：Boss 技能特效 prefab，先用临时粒子或 SpriteAnimation，后续按主题替换。

`EnemyPool`：

- `poolKey`：`enemy`
- `capacity`：`80`
- `prefab`：挂带 `PoolableActor`、`EnemyController`、`EnemyVisualController` 和 `AtlasAnimator` 的怪物 prefab。

## Prefab 最小要求

魂球 prefab：

- 根节点挂 `PoolableActor`。
- 同节点或子节点挂 `SoulOrbController`。
- 贴图使用修仙主题魂球，不要沿用旧 Web 的圆点占位。

伤害数字 prefab：

- 根节点挂 `PoolableActor`。
- 根节点挂 `DamageNumberController`。
- 子节点放 Label，并拖到 `label` 字段。

Boss 技能 prefab：

- 根节点挂 `PoolableActor`。
- 建议子节点分为 `Warning`、`Impact`、`Afterglow`，后续按主题替换表现。
- 当前由 `BattleRuntimeController.tickBossSkill()` 从 `bossSkillEffectPool` 取出并定位。

怪物 prefab：

- 根节点挂 `PoolableActor`。
- 挂 `EnemyController` 控制靠近和攻击动作。
- 挂 `EnemyVisualController` 监听 `enemy-hit` 和 `enemy-defeated`。
- 挂 `AtlasAnimator` 播放 `idle`、`move`、`attack`、`hurt`、`death`。
- `EnemyVisualController.animator` 拖入同节点或子节点上的 `AtlasAnimator`。

## 手动验证流程

1. 打开场景后确认 `StatusLabel` 显示 `巡游`。
2. 调用 `tickSpawn()` 后确认小怪能生成。
3. 调用 `summonWorldBoss()` 后确认状态变成 `Boss`。
4. 调高 `heroAttack`，调用 `castFlyingSword()` 击败 Boss。
5. 调用 `claimStageClear()` 后确认 `StageClearPanel` 显示奖励。
6. 点击 `NextStageButton`，确认面板隐藏，`stageNumber` 进入下一关，状态回到 `巡游`。

## 当前边界

- 这里是编辑器装配清单，不是最终 UI 美术规范。
- Boss 技能已有事件和对象池入口，但 prefab 美术表现仍需要单独做。
- 怪物节点已经有运行时 id 绑定和受击/死亡事件入口，后续重点是替换真实 prefab 美术和动画。

## FlyingSwordSkill 节点

在 `BattleRoot/EffectLayer` 下创建 `FlyingSwordSkill` 节点，并在它下面创建 `Sword` 子节点。

字段绑定：
- `battleRuntime`：拖入 `BattleRoot/Runtime` 上的 `BattleRuntimeController`。
- `sword`：拖入 `BattleRoot/EffectLayer/FlyingSwordSkill/Sword`。
- `cooldown`：默认 `1.2`。
- `flightDuration`：默认 `0.62`。
- `arcHeight`：默认 `38`。

运行时行为：
- `FlyingSwordSkill` 自动调用 `BattleRuntimeController.castFlyingSword()`，不要在技能脚本里单独计算伤害。
- 飞剑视觉路径读取 `swordStartX`、`swordEndX`、`swordY`，和运行时命中路径保持一致。
- 每次施法会发出 `sword-cast-started` 事件，后续音效、拖尾、屏幕震动都从这个事件接入。
