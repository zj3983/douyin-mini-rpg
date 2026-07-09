# Cocos 资源管线记录

## 当前资产批次

第一批 PNG 资源来自三张 AI 生成素材板：

- `assets/Assets/Generated/Atlases/characters-atlas.png`
- `assets/Assets/Generated/Atlases/monsters-atlas.png`
- `assets/Assets/Generated/Atlases/artifacts-skills-atlas.png`

素材板已经切到 `asset-catalog.json` 引用的目录里，当前可被 Cocos 直接导入。

## 当前动作帧批次

角色和怪物已经生成第一版 4 帧 PNG strip：

- 角色：`idle`、`move`、`cast`、`hurt`
- 怪物：`idle`、`move`、`attack`、`hurt`、`death`

这批帧表用于 Cocos 预览和节点挂载，不是最终美术。它们从现有 PNG 派生，能先解决“完全不会动”的问题；后续需要替换成透明全身横版动作帧。

## 目录约定

- `Assets/Characters/*`：角色立绘和战斗图。
- `Assets/Monsters/*`：怪物身体图，按场景主题拆分。
- `Assets/Artifacts/*`：法宝图标。
- `Assets/Skills/*`：技能图标、飞行物、命中特效、满屏特效。

## 后续替换顺序

1. 先替换角色战斗图为横版半身或全身透明 PNG。
2. 再补角色动作帧：待机、踩剑移动、掐诀施法、受击。
3. 再补怪物动作帧：待机、移动、攻击、受击、死亡。
4. 最后把技能图标和技能特效拆开，不再复用同一张切片。

## 验证

`tests/assetCatalog.test.mjs` 会检查清单中所有图片路径真实存在。
