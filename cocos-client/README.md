# 虚境试炼 Cocos 客户端

这是从旧 Web/Canvas 原型迁移出来的 Cocos Creator 客户端工程，目标是抖音小游戏方向。

## 当前状态

- Dashboard 已安装到 `D:\CocosDashboard`。
- 本工程位于 `D:\游戏\douyin-mini-rpg\cocos-client`。
- 规则层已经先落地：境界、升级、法宝质变、副本奖励、世界 Boss 副本卷掉落。
- Cocos 组件骨架已经建立：战斗场景控制、玩家踩飞剑移动、御剑术弧线飞行。
- 世界关卡配置已经拆出：不同背景、不同怪物族群、每关 Boss。
- 副本配置已经拆出：4 个副本、每个 5 层、可撤离、Boss 掉法宝。
- Cocos 战斗循环组件已经拆出：关卡导演、敌人控制、副本控制、魂球吸附。
- 资源清单已经拆出：角色、怪物、技能、法宝各自有独立图片和动画落点。

## 打开方式

1. 启动 `D:\CocosDashboard\CocosDashboard.exe`。
2. 在 Dashboard 里登录 Cocos 账号。
3. 下载 Cocos Creator 3.8.x，编辑器目录请选择 D 盘。
4. Project 页添加本目录：`D:\游戏\douyin-mini-rpg\cocos-client`。

## 第一阶段目标

做一个小而完整的横版修仙割草闭环：

- 角色踩飞剑，点击屏幕移动。
- 不做普通攻击，只自动释放本命术。
- 初始剑修使用御剑术，飞剑弧线穿透并回锋。
- 怪物按场景主题切换。
- 每关需要召唤并击败世界 Boss 才算破关。
- 破关后领取结算奖励：灵石、法宝精华和副本入场卷。
- 击败怪物掉魂球，升级只加攻击、生命、法力。
- 法宝从副本获得，法宝等级 6/12/18 触发质变选项。

## 当前 Cocos 组件分工

- `StageDirector`：读取世界关卡，切换背景、怪物池和 Boss。
- `EnemyController`：横版靠近玩家，到距离后释放怪物技能。
- `DungeonRunController`：管理副本层数、撤离和 Boss 层奖励。
- `SoulOrbController`：魂球磁吸、拾取和销毁。
- `PlayerController`：角色踩飞剑平滑移动。
- `FlyingSwordSkill`：御剑术自动释放和弧线飞行。
- `AssetBindingController`：按角色、怪物、技能、法宝 id 查询资源路径。
- `AtlasAnimator`：按统一 atlas 和 manifest 播放多动作序列帧。
- `NodePoolController`：复用怪物、魂球、飞剑、伤害数字和技能特效节点，避免频繁创建销毁。
- `PoolableActor`：节点回收入口，供掉落物、怪物和特效主动归还对象池。
- `EnemySpawner`：按世界关卡主题生成怪物，并从对象池取节点。
- `DamageNumberController`：显示命中伤害飘字，播放完后回收到对象池。
- `BattleRuntimeController`：串联生成、Boss 出场、Boss 技能、御剑命中、伤害飘字、怪物死亡、魂球掉落和破关结算。
- `StageClearPanelController`：显示破关标题、奖励明细和下一关按钮。

## 资源目录约定

- `assets/resources/Assets/Characters/*`：角色立绘、战斗图、待机、移动、掐诀、受击动画。
- `assets/resources/Assets/Monsters/*`：按场景主题拆分怪物身体图和动作动画。
- `assets/resources/Assets/Skills/*`：技能图标、飞行物、命中特效、满屏质变特效。
- `assets/resources/Assets/Artifacts/*`：法宝图标和品质展示。

第一批 PNG 已经落在 `assets/resources/Assets` 下，来源和替换顺序见 `docs/asset-pipeline.md`。
角色和怪物也已经有第一版 4 帧动作 strip，可用于 Cocos 预览。
运行时优先使用 `assets/resources/Assets/ActorAtlases/*/atlas.png` 和 `assets/Data/animation-atlas.json`，避免多动作角色拆成大量散图。

## 验证

```bash
npm test
```
