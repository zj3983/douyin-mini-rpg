# Cocos 角色动画资产管线

## 权威资产

- 原始序列帧：`art-source/vertical-slice/<actor>/<action>/*.png`
- 动作规格：`assets/Data/vertical-slice-animation-sources.json`
- 运行时图集：`assets/resources/Assets/ActorAtlases/<Actor>/*.png`
- 播放清单：`assets/Data/animation-atlas.json`
- 运行时清单镜像：`assets/resources/Data/animation-atlas.json`

同一角色的动作、帧率、循环规则、帧顺序和锚点必须由播放清单统一描述。Cocos 运行时只加载 `ActorAtlases`，不再从早期的整张素材板或 `Assets/Combat` 动作条加载。

## 生成流程

1. 将通过验收的透明序列帧放入 `art-source/vertical-slice`。
2. 在 `vertical-slice-animation-sources.json` 中登记角色、动作、帧数、尺寸和锚点。
3. 运行生成器：

```powershell
python tools/build-vertical-slice-atlases.py --check
```

4. 检查 `ActorAtlases` 中每帧主体完整、脚底对齐、方向一致、透明边界正常。
5. 运行资产和动画测试：

```powershell
node --test tests/animationAtlas.test.mjs tests/verticalSliceAtlasBuilder.test.mjs
```

`tools/build-frame-strip.py` 仅用于离线整理新的独立序列帧，不得把输出写回已经停用的旧目录。

## 已停用目录

以下目录已从远程资源 Bundle 删除，不得重新创建：

- `assets/resources/Assets/Generated/Atlases`
- `assets/resources/Assets/Combat`

它们分别是早期 AI 素材板和旧动作条，已被正式 `ActorAtlases` 替代。`tests/legacyResourceCleanup.test.mjs` 会阻止生产清单重新引用这些路径。

`assets/resources/Assets/Monsters` 仍属于下一批迁移范围。目前旧 `asset-catalog.json` 仍引用该目录，完成清单迁移前不能删除。

## 运行时规则

- `AtlasAnimator` 根据 `animation-atlas.json` 播放角色动作。
- 角色移动、攻击、受击和死亡只切换动作，不直接改写角色世界坐标。
- 远离镜头或不可见的普通怪物允许降低动画更新频率。
- 敌人、飞剑、伤害数字、灵魂球和 Boss 特效全部使用有上限的对象池。
- 关卡切换通过资源代次拒绝过期回调，并释放上一关资源。

## 发布检查

```powershell
npm.cmd run plan:douyin-resources
npm.cmd run report:resources
npm.cmd run check:douyin
```

抖音构建中 `main` 和 `resources` Bundle 均为远程资源。生成的 `build/bytedance-mini-game/remote` 目录必须按原路径上传到 HTTPS CDN。
