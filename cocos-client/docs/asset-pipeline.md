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

## 验证

`tests/assetCatalog.test.mjs` 会检查清单中所有图片路径真实存在。
