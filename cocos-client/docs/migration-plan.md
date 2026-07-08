# Cocos 迁移计划

## 迁移判断

当前 Web 原型已经证明了核心方向，但继续在单个 Canvas/Vite 项目里补角色、怪物、技能、地图、音效和抖音小游戏发布，会让系统越来越难维护。

Cocos Creator 更适合后续目标：

- 场景、节点、Prefab、动画和资源分包是正式游戏工程思路。
- 支持 TypeScript 组件，能承接现有数值和服务端接口逻辑。
- 官方支持发布到 ByteDance Mini Game，适合抖音小游戏方向。
- 角色动作、怪物动作、法宝技能特效可以按 Sprite/Animation/Particle 管理。

## 保留旧 Web 项目

旧项目不删除，作为以下内容的参考：

- 账号登录和服务端存档接口。
- 抽卡、角色碎片、背包、法宝、材料的规则原型。
- 已生成的修仙主题图片资产。
- 游戏代理测试脚本思路。

## Cocos 第一阶段

第一阶段只做“能玩的一条战斗线”，不迁完整 UI：

1. `assets/Scripts/Core`
   - 纯规则层。
   - 不依赖 Cocos `cc` 模块。
   - 用 Node 测试锁住升级、法宝、副本、世界 Boss 规则。

2. `assets/Scripts/Game`
   - Cocos 组件层。
   - `BattleSceneController` 负责战斗状态入口。
   - `PlayerController` 负责踩飞剑移动。
   - `FlyingSwordSkill` 负责御剑术自动释放和弧线飞行。

3. 场景目标
   - 横版地图。
   - 主角靠左，怪物从右侧出现。
   - 没有普通攻击，只自动释放技能。
   - 击败怪物掉魂球。
   - 升级只加攻击、生命、法力。
   - 法宝升级触发技能质变卡。

## 第二阶段

- 角色选择和角色碎片。
- 法宝库和法宝详情弹窗。
- 多副本、多层数、撤离门。
- 世界 Boss 打完进入下一关。
- 抽卡券、入场券、灵石、材料完整货币循环。

## 第三阶段

- 接入旧项目的账号服务器。
- Cocos 构建 Web Preview。
- Cocos 构建 ByteDance Mini Game。
- 将构建产物接入现有远程部署流程。

## 当前阻塞

Dashboard 已安装到 `D:\CocosDashboard`。  
Creator 3.8.x 编辑器仍需要在 Dashboard 内登录后下载。下载编辑器时必须把编辑器目录也选到 D 盘。
