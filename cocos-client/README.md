# 虚境试炼 Cocos 客户端

这是从旧 Web/Canvas 原型迁移出来的 Cocos Creator 客户端工程，目标是抖音小游戏方向。

## 当前状态

- Dashboard 已安装到 `D:\CocosDashboard`。
- 本工程位于 `D:\游戏\douyin-mini-rpg\cocos-client`。
- 规则层已经先落地：境界、升级、法宝质变、副本奖励、世界 Boss 副本卷掉落。
- Cocos 组件骨架已经建立：战斗场景控制、玩家踩飞剑移动、御剑术弧线飞行。

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
- 击败怪物掉魂球，升级只加攻击、生命、法力。
- 法宝从副本获得，法宝等级 6/12/18 触发质变选项。

## 验证

```bash
npm test
```
