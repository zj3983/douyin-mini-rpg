System.register("chunks:///_virtual/ActorAnimationBinder.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './AssetCatalog.ts', './StripAnimationRuntime.ts', './StripAnimator.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, JsonAsset, resources, Texture2D, Component, findCharacter, monstersForTheme, resourcePathForPng, StripAnimator;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      JsonAsset = module.JsonAsset;
      resources = module.resources;
      Texture2D = module.Texture2D;
      Component = module.Component;
    }, function (module) {
      findCharacter = module.findCharacter;
      monstersForTheme = module.monstersForTheme;
    }, function (module) {
      resourcePathForPng = module.resourcePathForPng;
    }, function (module) {
      StripAnimator = module.StripAnimator;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2;
      cclegacy._RF.push({}, "bf0613SOk1PYYZ3r87/Y8T+", "ActorAnimationBinder", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var ActorAnimationBinder = exports('ActorAnimationBinder', (_dec = ccclass('ActorAnimationBinder'), _dec2 = property(JsonAsset), _dec3 = property(StripAnimator), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(ActorAnimationBinder, _Component);
        function ActorAnimationBinder() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "assetCatalog", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "animator", _descriptor2, _assertThisInitialized(_this));
          _this.selectedCharacterId = 'qinglan-sword-cultivator';
          _this.selectedMonsterTheme = 'mist-bamboo';
          _this.selectedMonsterIndex = 0;
          return _this;
        }
        var _proto = ActorAnimationBinder.prototype;
        _proto.playCharacter = function playCharacter(motion) {
          var _this$assetCatalog;
          var catalog = (_this$assetCatalog = this.assetCatalog) == null ? void 0 : _this$assetCatalog.json;
          if (!catalog || !this.animator) return;
          var character = findCharacter(catalog, this.selectedCharacterId);
          this.loadStrip(character.motionFrames[motion]);
        };
        _proto.playMonster = function playMonster(motion) {
          var _this$assetCatalog2;
          var catalog = (_this$assetCatalog2 = this.assetCatalog) == null ? void 0 : _this$assetCatalog2.json;
          if (!catalog || !this.animator) return;
          var monsters = monstersForTheme(catalog, this.selectedMonsterTheme);
          var monster = monsters[this.selectedMonsterIndex % monsters.length];
          this.loadStrip(monster.motionFrames[motion]);
        };
        _proto.loadStrip = function loadStrip(assetPath) {
          var _this2 = this;
          var resourcePath = resourcePathForPng(assetPath);
          resources.load(resourcePath, Texture2D, function (error, texture) {
            if (error || !texture || !_this2.animator) return;
            _this2.animator.play(texture, 4, 8);
          });
        };
        return ActorAnimationBinder;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "assetCatalog", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "animator", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/AnimationAtlas.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        findActorAtlas: findActorAtlas,
        findAtlasAction: findAtlasAction
      });
      cclegacy._RF.push({}, "5d4655i7xNMP5AdsuF4fiWX", "AnimationAtlas", undefined);
      function findActorAtlas(manifest, actorId) {
        var actor = manifest.actors.find(function (entry) {
          return entry.id === actorId;
        });
        if (!actor) {
          throw new Error("Unknown actor atlas: " + actorId);
        }
        return actor;
      }
      function findAtlasAction(actor, actionName) {
        var action = actor.actions.find(function (entry) {
          return entry.name === actionName;
        });
        if (!action) {
          throw new Error("Unknown atlas action: " + actor.id + "." + actionName);
        }
        return action;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/AssetBindingController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './AssetCatalog.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, JsonAsset, Label, Component, findCharacter, skillsForCharacter, findArtifact, monstersForTheme;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      JsonAsset = module.JsonAsset;
      Label = module.Label;
      Component = module.Component;
    }, function (module) {
      findCharacter = module.findCharacter;
      skillsForCharacter = module.skillsForCharacter;
      findArtifact = module.findArtifact;
      monstersForTheme = module.monstersForTheme;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2;
      cclegacy._RF.push({}, "402f78cIHNEob77Xg4xsxR3", "AssetBindingController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var AssetBindingController = exports('AssetBindingController', (_dec = ccclass('AssetBindingController'), _dec2 = property(JsonAsset), _dec3 = property(Label), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(AssetBindingController, _Component);
        function AssetBindingController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "assetCatalog", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "debugLabel", _descriptor2, _assertThisInitialized(_this));
          _this.selectedCharacterId = 'qinglan-sword-cultivator';
          _this.selectedTheme = 'mist-bamboo';
          return _this;
        }
        var _proto = AssetBindingController.prototype;
        _proto.start = function start() {
          this.previewBindings();
        };
        _proto.previewBindings = function previewBindings() {
          if (!this.assetCatalog) return;
          var catalog = this.assetCatalog.json;
          var character = findCharacter(catalog, this.selectedCharacterId);
          var skill = skillsForCharacter(catalog, character.id)[0];
          var artifact = findArtifact(catalog, character.startingArtifact);
          var monsters = monstersForTheme(catalog, this.selectedTheme);
          if (this.debugLabel) {
            this.debugLabel.string = character.name + " / " + skill.name + " / " + artifact.name + " / \u602A\u7269" + monsters.length;
          }
        };
        return AssetBindingController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "assetCatalog", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "debugLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/AssetCatalog.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        findArtifact: findArtifact,
        findCharacter: findCharacter,
        findSkill: findSkill,
        monstersForTheme: monstersForTheme,
        skillsForCharacter: skillsForCharacter
      });
      cclegacy._RF.push({}, "0ddd7T85rhCvrTmtdqqOgpE", "AssetCatalog", undefined);
      function findById(list, id, label) {
        var item = list.find(function (entry) {
          return entry.id === id;
        });
        if (!item) {
          throw new Error("Unknown " + label + ": " + id);
        }
        return item;
      }
      function findCharacter(catalog, id) {
        return findById(catalog.characters, id, 'character');
      }
      function findArtifact(catalog, id) {
        return findById(catalog.artifacts, id, 'artifact');
      }
      function findSkill(catalog, id) {
        return findById(catalog.skills, id, 'skill');
      }
      function monstersForTheme(catalog, theme) {
        return catalog.monsters.filter(function (monster) {
          return monster.theme === theme;
        });
      }
      function skillsForCharacter(catalog, characterId) {
        var character = findCharacter(catalog, characterId);
        return [findSkill(catalog, character.innateSkill)];
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/AtlasAnimator.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './AnimationAtlas.ts', './StripAnimationRuntime.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, JsonAsset, Sprite, resources, Texture2D, SpriteFrame, Rect, Component, findActorAtlas, findAtlasAction, resourcePathForPng, shouldAdvanceAnimation, frameIndexAtTime;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      JsonAsset = module.JsonAsset;
      Sprite = module.Sprite;
      resources = module.resources;
      Texture2D = module.Texture2D;
      SpriteFrame = module.SpriteFrame;
      Rect = module.Rect;
      Component = module.Component;
    }, function (module) {
      findActorAtlas = module.findActorAtlas;
      findAtlasAction = module.findAtlasAction;
    }, function (module) {
      resourcePathForPng = module.resourcePathForPng;
      shouldAdvanceAnimation = module.shouldAdvanceAnimation;
      frameIndexAtTime = module.frameIndexAtTime;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7;
      cclegacy._RF.push({}, "07ceau7CvhGU4fDboJSWXEp", "AtlasAnimator", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var AtlasAnimator = exports('AtlasAnimator', (_dec = ccclass('AtlasAnimator'), _dec2 = property(JsonAsset), _dec3 = property(Sprite), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(AtlasAnimator, _Component);
        function AtlasAnimator() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "animationManifest", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "targetSprite", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "actorId", _descriptor3, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "visibleForAnimation", _descriptor4, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "distanceToCamera", _descriptor5, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "maxActiveDistance", _descriptor6, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "updateInterval", _descriptor7, _assertThisInitialized(_this));
          _this.action = null;
          _this.texture = null;
          _this.frames = [];
          _this.elapsed = 0;
          _this.accumulatedTime = 0;
          _this.frameIndex = 0;
          _this.playing = false;
          return _this;
        }
        var _proto = AtlasAnimator.prototype;
        _proto.play = function play(actionName) {
          var _this$animationManife,
            _this2 = this;
          var manifest = (_this$animationManife = this.animationManifest) == null ? void 0 : _this$animationManife.json;
          if (!manifest) return;
          var actor = findActorAtlas(manifest, this.actorId);
          var action = findAtlasAction(actor, actionName);
          this.action = action;
          this.elapsed = 0;
          this.accumulatedTime = 0;
          this.frameIndex = 0;
          this.playing = false;
          resources.load(resourcePathForPng(actor.atlas), Texture2D, function (error, texture) {
            if (error || !texture || _this2.action !== action) return;
            _this2.texture = texture;
            _this2.frames = _this2.buildFrames(texture, action);
            _this2.playing = _this2.frames.length > 0;
            _this2.applyFrame();
          });
        };
        _proto.update = function update(deltaTime) {
          if (!this.playing || !this.action || this.frames.length <= 1) return;
          this.accumulatedTime += deltaTime;
          if (!shouldAdvanceAnimation({
            visible: this.visibleForAnimation,
            distanceToCamera: this.distanceToCamera,
            maxActiveDistance: this.maxActiveDistance,
            accumulatedTime: this.accumulatedTime,
            updateInterval: this.updateInterval
          })) {
            return;
          }
          this.elapsed += deltaTime;
          this.accumulatedTime = 0;
          this.frameIndex = frameIndexAtTime({
            elapsed: this.elapsed,
            framesPerSecond: this.action.fps,
            frameCount: this.action.order.length,
            loop: this.action.loop
          });
          if (!this.action.loop && this.frameIndex >= this.action.order.length - 1) this.playing = false;
          this.applyFrame();
        };
        _proto.buildFrames = function buildFrames(texture, action) {
          return action.order.map(function (frameIndex) {
            var rect = action.frames[frameIndex];
            var frame = new SpriteFrame();
            frame.texture = texture;
            frame.rect = new Rect(rect.x, rect.y, rect.w, rect.h);
            return frame;
          });
        };
        _proto.applyFrame = function applyFrame() {
          if (!this.targetSprite || this.frames.length === 0) return;
          this.targetSprite.spriteFrame = this.frames[this.frameIndex];
        };
        return AtlasAnimator;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "animationManifest", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "targetSprite", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "actorId", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'qinglan-sword-cultivator';
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "visibleForAnimation", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "distanceToCamera", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "maxActiveDistance", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 900;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "updateInterval", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.033;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/BattleRuntime.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _extends, _createForOfIteratorHelperLoose, cclegacy;
  return {
    setters: [function (module) {
      _extends = module.extends;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        applyFlyingSwordHit: applyFlyingSwordHit,
        claimStageClear: claimStageClear,
        createBattleRuntime: createBattleRuntime,
        defeatEnemy: defeatEnemy,
        nextSpawn: nextSpawn,
        runtimeStats: runtimeStats,
        segmentHitEnemies: segmentHitEnemies,
        spawnBoss: spawnBoss,
        tickBossSkill: tickBossSkill
      });
      cclegacy._RF.push({}, "c73cbDaoMFIh47WfXiY/LE0", "BattleRuntime", undefined);
      function createBattleRuntime(stage, heroAttack) {
        return {
          stage: stage,
          heroAttack: heroAttack,
          spawnTimer: 0,
          spawnInterval: 1,
          nextEnemyId: 1,
          enemies: [],
          soulDrops: [],
          bossSpawned: false,
          bossSkillTimer: 0,
          bossSkillInterval: 2.6,
          stageCleared: false,
          stageClearClaimed: false
        };
      }
      function nextSpawn(runtime, deltaTime) {
        runtime.spawnTimer += deltaTime;
        if (runtime.spawnTimer < runtime.spawnInterval) return {
          ok: false,
          enemy: null
        };
        runtime.spawnTimer = 0;
        var pool = runtime.stage.enemies.filter(function (enemy) {
          return enemy.role !== 'boss';
        });
        var profile = pool[(runtime.nextEnemyId - 1) % pool.length];
        var enemy = {
          id: runtime.nextEnemyId,
          profile: profile,
          hp: 100,
          position: {
            x: 520,
            y: profile.role === 'flying' ? 70 : -60
          },
          radius: profile.role === 'boss' ? 64 : 34,
          alive: true,
          dropped: false
        };
        runtime.nextEnemyId += 1;
        runtime.enemies.push(enemy);
        return {
          ok: true,
          enemy: enemy
        };
      }
      function applyFlyingSwordHit(runtime, pierce, damageScale, path) {
        var targets = path ? segmentHitEnemies(runtime, _extends({}, path, {
          pierce: pierce
        })) : runtime.enemies.filter(function (enemy) {
          return enemy.alive;
        }).slice(0, Math.max(0, pierce));
        var damage = Math.round(runtime.heroAttack * damageScale);
        var damageEvents = [];
        var defeatedEnemyIds = [];
        var stageClear = false;
        for (var _iterator = _createForOfIteratorHelperLoose(targets), _step; !(_step = _iterator()).done;) {
          var enemy = _step.value;
          enemy.hp -= damage;
          damageEvents.push({
            enemyId: enemy.id,
            damage: damage,
            remainingHp: Math.max(0, enemy.hp),
            position: _extends({}, enemy.position)
          });
          if (enemy.hp <= 0 && defeatEnemy(runtime, enemy.id)) {
            defeatedEnemyIds.push(enemy.id);
            if (enemy.profile.role === 'boss') {
              runtime.stageCleared = true;
              stageClear = true;
            }
          }
        }
        return {
          hitCount: targets.length,
          damageEvents: damageEvents,
          defeatedEnemyIds: defeatedEnemyIds,
          stageClear: stageClear
        };
      }
      function spawnBoss(runtime) {
        if (runtime.bossSpawned || runtime.stageCleared) return {
          ok: false,
          enemy: null
        };
        var profile = runtime.stage.boss;
        var enemy = {
          id: runtime.nextEnemyId,
          profile: profile,
          hp: 520,
          position: {
            x: 580,
            y: -42
          },
          radius: 70,
          alive: true,
          dropped: false
        };
        runtime.nextEnemyId += 1;
        runtime.bossSpawned = true;
        runtime.enemies.push(enemy);
        return {
          ok: true,
          enemy: enemy
        };
      }
      function tickBossSkill(runtime, deltaTime) {
        var boss = runtime.enemies.find(function (enemy) {
          return enemy.profile.role === 'boss' && enemy.alive;
        });
        if (!boss || runtime.stageCleared) return {
          ok: false,
          event: null
        };
        runtime.bossSkillTimer += deltaTime;
        if (runtime.bossSkillTimer + 0.000001 < runtime.bossSkillInterval) return {
          ok: false,
          event: null
        };
        runtime.bossSkillTimer = 0;
        return {
          ok: true,
          event: {
            enemyId: boss.id,
            skillId: boss.profile.theme + "-boss-skill",
            name: boss.profile.theme === 'flame-cave' ? '地火裂涌' : boss.profile.theme === 'starlight-ruin' ? '星陨压境' : '妖气冲袭',
            damage: boss.profile.theme === 'flame-cave' ? 18 : boss.profile.theme === 'starlight-ruin' ? 16 : 14,
            position: _extends({}, boss.position)
          }
        };
      }
      function claimStageClear(runtime) {
        if (!runtime.stageCleared) return {
          ok: false,
          reason: 'not-cleared',
          result: null
        };
        if (runtime.stageClearClaimed) return {
          ok: false,
          reason: 'already-claimed',
          result: null
        };
        runtime.stageClearClaimed = true;
        var stageId = runtime.stage.id;
        var passCycle = [{
          id: 'mist-bamboo-secret',
          name: '青竹令'
        }, {
          id: 'flame-cave',
          name: '赤焰符券'
        }, {
          id: 'soul-bell-valley',
          name: '摄魂残铃'
        }, {
          id: 'star-gate-ruins',
          name: '星门残券'
        }];
        return {
          ok: true,
          reason: null,
          result: {
            title: "\u7B2C" + stageId + "\u5173\u7A81\u7834",
            stageId: stageId,
            nextStageId: stageId + 1,
            reward: {
              spiritStones: 180 + stageId * 20,
              artifactEssence: 2 + stageId,
              dungeonPass: passCycle[(stageId - 1) % passCycle.length]
            }
          }
        };
      }
      function segmentHitEnemies(runtime, input) {
        return runtime.enemies.filter(function (enemy) {
          return enemy.alive;
        }).map(function (enemy) {
          var projection = projectPointToSegment(enemy.position, input.from, input.to);
          return {
            enemy: enemy,
            progress: projection.t,
            distance: projection.distance
          };
        }).filter(function (hit) {
          return hit.distance <= hit.enemy.radius + input.width;
        }).sort(function (a, b) {
          return a.progress - b.progress;
        }).slice(0, Math.max(0, input.pierce)).map(function (hit) {
          return hit.enemy;
        });
      }
      function projectPointToSegment(point, from, to) {
        var dx = to.x - from.x;
        var dy = to.y - from.y;
        var lengthSq = dx * dx + dy * dy;
        var rawT = lengthSq === 0 ? 0 : ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq;
        var t = Math.max(0, Math.min(1, rawT));
        var x = from.x + dx * t;
        var y = from.y + dy * t;
        var distance = Math.hypot(point.x - x, point.y - y);
        return {
          t: t,
          distance: distance
        };
      }
      function defeatEnemy(runtime, enemyId) {
        var enemy = runtime.enemies.find(function (entry) {
          return entry.id === enemyId;
        });
        if (!enemy || enemy.dropped) return false;
        enemy.alive = false;
        enemy.dropped = true;
        runtime.soulDrops.push({
          enemyId: enemyId,
          amount: enemy.profile.role === 'boss' ? 5 : 1
        });
        return true;
      }
      function runtimeStats(runtime) {
        return {
          aliveEnemies: runtime.enemies.filter(function (enemy) {
            return enemy.alive;
          }).length,
          defeatedEnemies: runtime.enemies.filter(function (enemy) {
            return !enemy.alive;
          }).length,
          soulDrops: runtime.soulDrops.length,
          bossAlive: runtime.enemies.some(function (enemy) {
            return enemy.profile.role === 'boss' && enemy.alive;
          }),
          stageCleared: runtime.stageCleared,
          stageClearClaimed: runtime.stageClearClaimed
        };
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/BattleRuntimeController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './BattleRuntime.ts', './CultivationRuntime.ts', './DamageNumberController.ts', './EnemySpawner.ts', './NodePoolController.ts', './StageClearPanelController.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _createForOfIteratorHelperLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, JsonAsset, Label, Vec3, Component, createBattleRuntime, nextSpawn, spawnBoss, tickBossSkill, claimStageClear, applyFlyingSwordHit, runtimeStats, stageProfileFromDesign, DamageNumberController, EnemySpawner, NodePoolController, StageClearPanelController;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      JsonAsset = module.JsonAsset;
      Label = module.Label;
      Vec3 = module.Vec3;
      Component = module.Component;
    }, function (module) {
      createBattleRuntime = module.createBattleRuntime;
      nextSpawn = module.nextSpawn;
      spawnBoss = module.spawnBoss;
      tickBossSkill = module.tickBossSkill;
      claimStageClear = module.claimStageClear;
      applyFlyingSwordHit = module.applyFlyingSwordHit;
      runtimeStats = module.runtimeStats;
    }, function (module) {
      stageProfileFromDesign = module.stageProfileFromDesign;
    }, function (module) {
      DamageNumberController = module.DamageNumberController;
    }, function (module) {
      EnemySpawner = module.EnemySpawner;
    }, function (module) {
      NodePoolController = module.NodePoolController;
    }, function (module) {
      StageClearPanelController = module.StageClearPanelController;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14;
      cclegacy._RF.push({}, "43c72ChzftCMYs6dJ+U4ZPQ", "BattleRuntimeController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var BattleRuntimeController = exports('BattleRuntimeController', (_dec = ccclass('BattleRuntimeController'), _dec2 = property(JsonAsset), _dec3 = property(NodePoolController), _dec4 = property(NodePoolController), _dec5 = property(NodePoolController), _dec6 = property(Label), _dec7 = property(StageClearPanelController), _dec8 = property(EnemySpawner), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(BattleRuntimeController, _Component);
        function BattleRuntimeController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "designData", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "soulOrbPool", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "damageNumberPool", _descriptor3, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "bossSkillEffectPool", _descriptor4, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "statusLabel", _descriptor5, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "stageClearPanel", _descriptor6, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "enemySpawner", _descriptor7, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "stageNumber", _descriptor8, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "heroAttack", _descriptor9, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "swordStartX", _descriptor10, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "swordEndX", _descriptor11, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "swordY", _descriptor12, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "swordHitWidth", _descriptor13, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "deathRecycleDelay", _descriptor14, _assertThisInitialized(_this));
          _this.runtime = null;
          _this.enemyNodes = new Map();
          return _this;
        }
        var _proto = BattleRuntimeController.prototype;
        _proto.start = function start() {
          this.rebuildRuntime(this.stageNumber);
        };
        _proto.advanceToStage = function advanceToStage(stageNumber) {
          var _this$stageClearPanel;
          this.rebuildRuntime(stageNumber);
          (_this$stageClearPanel = this.stageClearPanel) == null || _this$stageClearPanel.hide();
          return {
            ok: Boolean(this.runtime),
            stageNumber: this.stageNumber
          };
        };
        _proto.advanceToNextStageFromPanel = function advanceToNextStageFromPanel() {
          var _this$stageClearPanel2;
          var result = (_this$stageClearPanel2 = this.stageClearPanel) == null ? void 0 : _this$stageClearPanel2.takeResult();
          if (!result) return {
            ok: false,
            stageNumber: this.stageNumber
          };
          return this.advanceToStage(result.nextStageId);
        };
        _proto.rebuildRuntime = function rebuildRuntime(stageNumber) {
          if (!this.designData) return;
          this.stageNumber = Math.max(1, Math.floor(stageNumber || 1));
          var stage = stageProfileFromDesign(this.designData.json, this.stageNumber);
          this.runtime = createBattleRuntime(stage, this.heroAttack);
          this.enemyNodes.clear();
          this.refresh();
        };
        _proto.tickSpawn = function tickSpawn(deltaTime) {
          if (!this.runtime) return {
            ok: false,
            enemy: null
          };
          return nextSpawn(this.runtime, deltaTime);
        };
        _proto.update = function update(deltaTime) {
          var spawn = this.tickSpawn(deltaTime);
          if (spawn.ok && spawn.enemy) {
            var _this$enemySpawner;
            var node = (_this$enemySpawner = this.enemySpawner) == null ? void 0 : _this$enemySpawner.spawnEnemy(spawn.enemy);
            this.registerEnemyNode(spawn.enemy.id, node);
            this.refresh();
          }
        };
        _proto.summonWorldBoss = function summonWorldBoss() {
          if (!this.runtime) return {
            ok: false,
            enemy: null
          };
          var result = spawnBoss(this.runtime);
          if (result.ok && result.enemy) {
            var _this$enemySpawner2;
            var node = (_this$enemySpawner2 = this.enemySpawner) == null ? void 0 : _this$enemySpawner2.spawnEnemy(result.enemy);
            this.registerEnemyNode(result.enemy.id, node);
          }
          this.refresh();
          return result;
        };
        _proto.tickBossSkill = function tickBossSkill$1(deltaTime) {
          if (!this.runtime) return {
            ok: false,
            event: null
          };
          var result = tickBossSkill(this.runtime, deltaTime);
          if (result.ok && result.event) {
            var _this$bossSkillEffect;
            var effectNode = (_this$bossSkillEffect = this.bossSkillEffectPool) == null ? void 0 : _this$bossSkillEffect.spawn();
            effectNode == null || effectNode.setPosition(new Vec3(result.event.position.x - 48, result.event.position.y + 24, 0));
          }
          return result;
        };
        _proto.claimStageClear = function claimStageClear$1() {
          if (!this.runtime) return {
            ok: false,
            reason: 'not-cleared',
            result: null
          };
          var result = claimStageClear(this.runtime);
          if (result.ok && result.result) {
            var _this$stageClearPanel3;
            (_this$stageClearPanel3 = this.stageClearPanel) == null || _this$stageClearPanel3.showResult(result.result);
          }
          this.refresh();
          return result;
        };
        _proto.castFlyingSword = function castFlyingSword() {
          var _this2 = this;
          if (!this.runtime) return {
            hitCount: 0,
            damageEvents: [],
            defeatedEnemyIds: []
          };
          var result = applyFlyingSwordHit(this.runtime, 3, 1, {
            from: {
              x: this.swordStartX,
              y: this.swordY
            },
            to: {
              x: this.swordEndX,
              y: this.swordY
            },
            width: this.swordHitWidth
          });
          for (var _iterator = _createForOfIteratorHelperLoose(result.damageEvents), _step; !(_step = _iterator()).done;) {
            var _this$damageNumberPoo, _damageNode$getCompon;
            var event = _step.value;
            var enemyNode = this.enemyNodes.get(event.enemyId);
            enemyNode == null || enemyNode.emit('enemy-hit', event);
            var damageNode = (_this$damageNumberPoo = this.damageNumberPool) == null ? void 0 : _this$damageNumberPoo.spawn();
            if (!damageNode) continue;
            damageNode.setPosition(new Vec3(event.position.x, event.position.y + 54, 0));
            (_damageNode$getCompon = damageNode.getComponent(DamageNumberController)) == null || _damageNode$getCompon.show(event.damage);
          }
          var _loop = function _loop() {
            var _this2$soulOrbPool;
            var enemyId = _step2.value;
            var enemyNode = _this2.enemyNodes.get(enemyId);
            enemyNode == null || enemyNode.emit('enemy-defeated', enemyId);
            if (enemyNode) {
              _this2.scheduleOnce(function () {
                var _this2$enemySpawner;
                (_this2$enemySpawner = _this2.enemySpawner) == null || _this2$enemySpawner.despawnEnemy(enemyNode);
              }, _this2.deathRecycleDelay);
            }
            _this2.enemyNodes["delete"](enemyId);
            (_this2$soulOrbPool = _this2.soulOrbPool) == null || _this2$soulOrbPool.spawn();
          };
          for (var _iterator2 = _createForOfIteratorHelperLoose(result.defeatedEnemyIds), _step2; !(_step2 = _iterator2()).done;) {
            _loop();
          }
          this.refresh();
          return result;
        };
        _proto.registerEnemyNode = function registerEnemyNode(enemyId, node) {
          if (!node) return;
          this.enemyNodes.set(enemyId, node);
        };
        _proto.refresh = function refresh() {
          if (!this.statusLabel || !this.runtime) return;
          var stats = runtimeStats(this.runtime);
          var bossText = stats.stageClearClaimed ? '已结算' : stats.stageCleared ? '已破关' : stats.bossAlive ? 'Boss' : '巡游';
          this.statusLabel.string = "\u654C " + stats.aliveEnemies + " | \u9B42\u7403 " + stats.soulDrops + " | " + bossText;
        };
        return BattleRuntimeController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "designData", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "soulOrbPool", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "damageNumberPool", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "bossSkillEffectPool", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "statusLabel", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "stageClearPanel", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "enemySpawner", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "stageNumber", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "heroAttack", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 40;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "swordStartX", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return -180;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "swordEndX", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 300;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "swordY", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return -30;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "swordHitWidth", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 18;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "deathRecycleDelay", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.45;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/BattleSceneController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './CultivationRules.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Label, Component, applyLevelUp, artifactMutationOptions, dungeonClearReward, realmName;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Label = module.Label;
      Component = module.Component;
    }, function (module) {
      applyLevelUp = module.applyLevelUp;
      artifactMutationOptions = module.artifactMutationOptions;
      dungeonClearReward = module.dungeonClearReward;
      realmName = module.realmName;
    }],
    execute: function () {
      var _dec, _dec2, _class, _class2, _descriptor;
      cclegacy._RF.push({}, "56fdacO1ABL1J4qjNM3dCZa", "BattleSceneController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var BattleSceneController = exports('BattleSceneController', (_dec = ccclass('BattleSceneController'), _dec2 = property(Label), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(BattleSceneController, _Component);
        function BattleSceneController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "statusLabel", _descriptor, _assertThisInitialized(_this));
          _this.hero = {
            level: 1,
            realm: realmName(1),
            attack: 24,
            health: 160,
            mana: 12
          };
          return _this;
        }
        var _proto = BattleSceneController.prototype;
        _proto.start = function start() {
          this.refreshStatus();
        };
        _proto.debugLevelUp = function debugLevelUp() {
          this.hero = applyLevelUp(this.hero);
          this.refreshStatus();
        };
        _proto.previewFlyingSwordMutation = function previewFlyingSwordMutation() {
          return artifactMutationOptions('flyingSword', 6);
        };
        _proto.previewDungeonReward = function previewDungeonReward() {
          return dungeonClearReward(5, true, 'flyingSword');
        };
        _proto.refreshStatus = function refreshStatus() {
          if (!this.statusLabel) return;
          this.statusLabel.string = this.hero.realm + " | \u653B\u51FB " + this.hero.attack + " | \u751F\u547D " + this.hero.health + " | \u6CD5\u529B " + this.hero.mana;
        };
        return BattleSceneController;
      }(Component), _descriptor = _applyDecoratedDescriptor(_class2.prototype, "statusLabel", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/CultivationRules.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _extends, cclegacy;
  return {
    setters: [function (module) {
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        applyLevelUp: applyLevelUp,
        artifactMutationOptions: artifactMutationOptions,
        canMutateArtifact: canMutateArtifact,
        dungeonClearReward: dungeonClearReward,
        realmName: realmName,
        worldBossPassDrop: worldBossPassDrop
      });
      cclegacy._RF.push({}, "aaf9bhDDjJNPLp0FH9nJglm", "CultivationRules", undefined);
      var artifactMaxLevel = exports('artifactMaxLevel', 18);
      var artifactMutationLevels = exports('artifactMutationLevels', [6, 12, 18]);
      var levelUpStats = exports('levelUpStats', ['attack', 'health', 'mana']);
      var realms = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘'];
      var stages = ['一重', '二重', '三重', '四重', '五重', '六重', '七重', '八重', '九重'];
      function realmName(level) {
        var safeLevel = Math.max(1, Math.floor(level));
        var realmIndex = Math.min(realms.length - 1, Math.floor((safeLevel - 1) / stages.length));
        return "" + realms[realmIndex] + stages[(safeLevel - 1) % stages.length];
      }
      function applyLevelUp(stats) {
        var nextLevel = stats.level + 1;
        return _extends({}, stats, {
          level: nextLevel,
          realm: realmName(nextLevel),
          attack: stats.attack + 6,
          health: stats.health + 28,
          mana: stats.mana + 4
        });
      }
      function canMutateArtifact(level) {
        return artifactMutationLevels.includes(level);
      }
      function artifactMutationOptions(artifact, level) {
        if (!canMutateArtifact(level)) return [];
        if (artifact === 'flyingSword') {
          return [{
            id: 'flyingSword.split',
            artifact: artifact,
            unlockLevel: level,
            title: '御剑·分光',
            description: '飞剑分化剑影，穿透多个目标。'
          }, {
            id: 'flyingSword.returnArc',
            artifact: artifact,
            unlockLevel: level,
            title: '御剑·回锋',
            description: '飞剑掠出后弧线回旋，再次切入敌阵。'
          }, {
            id: 'flyingSword.cloudPierce',
            artifact: artifact,
            unlockLevel: level,
            title: '御剑·穿云',
            description: '飞剑轨迹抬升，优先贯穿飞行妖兽。'
          }];
        }
        return [{
          id: artifact + ".wide",
          artifact: artifact,
          unlockLevel: level,
          title: '法宝·扩域',
          description: '扩大法宝影响范围。'
        }, {
          id: artifact + ".echo",
          artifact: artifact,
          unlockLevel: level,
          title: '法宝·残响',
          description: '释放后追加一次残响。'
        }, {
          id: artifact + ".focus",
          artifact: artifact,
          unlockLevel: level,
          title: '法宝·凝神',
          description: '降低冷却并提高命中稳定性。'
        }];
      }
      function worldBossPassDrop(stage) {
        if (stage <= 0) return 0;
        return stage % 5 === 0 ? 2 : 1;
      }
      function dungeonClearReward(floor, bossKilled, artifact) {
        var safeFloor = Math.max(1, Math.floor(floor));
        return {
          gachaTickets: bossKilled ? 2 + safeFloor : safeFloor,
          spiritStones: 60 + safeFloor * 18,
          artifactEssence: bossKilled ? 2 + Math.floor(safeFloor / 2) : 1,
          materials: 2 + safeFloor,
          artifact: bossKilled ? artifact : undefined
        };
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/CultivationRuntime.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _extends, cclegacy;
  return {
    setters: [function (module) {
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        dungeonRunPlanFromDesign: dungeonRunPlanFromDesign,
        resolveDungeonFloor: resolveDungeonFloor,
        stageProfileFromDesign: stageProfileFromDesign
      });
      cclegacy._RF.push({}, "db9c6VEg9BDwJr7py9nel1c", "CultivationRuntime", undefined);
      function stageProfileFromDesign(design, stageNumber) {
        var safeStage = Math.max(1, Math.floor(stageNumber || 1));
        var stage = design.worldStages[(safeStage - 1) % design.worldStages.length];
        var boss = stage.enemies.find(function (enemy) {
          return enemy.role === 'boss';
        });
        if (!boss) {
          throw new Error("Stage " + stage.name + " is missing a boss enemy.");
        }
        return _extends({}, stage, {
          id: safeStage,
          boss: boss
        });
      }
      function dungeonRunPlanFromDesign(design, dungeonId) {
        var dungeon = design.dungeons.list.find(function (item) {
          return item.id === dungeonId || item.name === dungeonId;
        });
        if (!dungeon) {
          throw new Error("Unknown dungeon: " + dungeonId);
        }
        return dungeon;
      }
      function resolveDungeonFloor(dungeon, floorNumber, outcome) {
        var floor = dungeon.floors.find(function (item) {
          return item.floor === floorNumber;
        });
        if (!floor) {
          throw new Error("Unknown floor " + floorNumber + " in " + dungeon.name);
        }
        var bossKilled = Boolean(outcome.bossKilled && floor.boss);
        var extracted = Boolean(outcome.extracted && !bossKilled);
        return {
          status: bossKilled ? 'cleared' : extracted ? 'extracted' : 'fighting',
          floor: floor,
          reward: {
            material: floor.material,
            gachaTickets: bossKilled ? 3 : 1,
            spiritStones: 40 + floor.floor * 20 + (bossKilled ? 120 : 0),
            artifactEssence: bossKilled ? 4 + floor.floor : 1,
            artifact: bossKilled ? dungeon.bossArtifact : undefined
          }
        };
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/CultivationTypes.ts", ['cc'], function () {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "d3113xi/rJPSrUtV1gCefWB", "CultivationTypes", undefined);
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/DamageNumberController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './PoolableActor.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Label, Color, Vec3, Component, PoolableActor;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Label = module.Label;
      Color = module.Color;
      Vec3 = module.Vec3;
      Component = module.Component;
    }, function (module) {
      PoolableActor = module.PoolableActor;
    }],
    execute: function () {
      var _dec, _dec2, _class, _class2, _descriptor, _descriptor2, _descriptor3;
      cclegacy._RF.push({}, "61888iuMONBtrOKo9Dv3hCt", "DamageNumberController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var DamageNumberController = exports('DamageNumberController', (_dec = ccclass('DamageNumberController'), _dec2 = property(Label), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(DamageNumberController, _Component);
        function DamageNumberController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "label", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "lifetime", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "riseDistance", _descriptor3, _assertThisInitialized(_this));
          _this.elapsed = 0;
          _this.startPosition = new Vec3();
          _this.active = false;
          return _this;
        }
        var _proto = DamageNumberController.prototype;
        _proto.show = function show(damage) {
          this.elapsed = 0;
          this.active = true;
          var position = this.node.position;
          this.startPosition.set(position.x, position.y, position.z);
          if (this.label) {
            this.label.string = "-" + damage;
            this.label.color = new Color(255, 232, 118, 255);
          }
        };
        _proto.update = function update(deltaTime) {
          if (!this.active) return;
          this.elapsed += deltaTime;
          var progress = Math.min(1, this.elapsed / this.lifetime);
          this.node.setPosition(this.startPosition.x, this.startPosition.y + this.riseDistance * progress, this.startPosition.z);
          if (this.label) {
            this.label.color = new Color(255, 232, 118, Math.round(255 * (1 - progress)));
          }
          if (progress >= 1) {
            this.active = false;
            var poolable = this.getComponent(PoolableActor);
            if (poolable) poolable.despawn();else this.node.active = false;
          }
        };
        return DamageNumberController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "label", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "lifetime", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.55;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "riseDistance", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 48;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/DungeonRunController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './CultivationRuntime.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, JsonAsset, Label, Component, dungeonRunPlanFromDesign, resolveDungeonFloor;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      JsonAsset = module.JsonAsset;
      Label = module.Label;
      Component = module.Component;
    }, function (module) {
      dungeonRunPlanFromDesign = module.dungeonRunPlanFromDesign;
      resolveDungeonFloor = module.resolveDungeonFloor;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2;
      cclegacy._RF.push({}, "7b6a1a2eidBRaPRC4mfgPAt", "DungeonRunController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var DungeonRunController = exports('DungeonRunController', (_dec = ccclass('DungeonRunController'), _dec2 = property(JsonAsset), _dec3 = property(Label), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(DungeonRunController, _Component);
        function DungeonRunController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "designData", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "floorLabel", _descriptor2, _assertThisInitialized(_this));
          _this.dungeonId = 'star-gate-ruins';
          _this.currentFloor = 1;
          _this.dungeon = null;
          return _this;
        }
        var _proto = DungeonRunController.prototype;
        _proto.start = function start() {
          this.enterDungeon(this.dungeonId);
        };
        _proto.enterDungeon = function enterDungeon(dungeonId) {
          if (!this.designData) return;
          this.dungeonId = dungeonId;
          this.currentFloor = 1;
          this.dungeon = dungeonRunPlanFromDesign(this.designData.json, dungeonId);
          this.updateLabel();
        };
        _proto.evacuate = function evacuate() {
          if (!this.dungeon) return null;
          return resolveDungeonFloor(this.dungeon, this.currentFloor, {
            extracted: true,
            bossKilled: false
          });
        };
        _proto.clearFloor = function clearFloor(bossKilled) {
          if (!this.dungeon) return null;
          var result = resolveDungeonFloor(this.dungeon, this.currentFloor, {
            extracted: false,
            bossKilled: bossKilled
          });
          if (result.status !== 'cleared') {
            this.currentFloor = Math.min(this.currentFloor + 1, this.dungeon.floors.length);
          }
          this.updateLabel();
          return result;
        };
        _proto.updateLabel = function updateLabel() {
          if (this.floorLabel && this.dungeon) {
            this.floorLabel.string = this.dungeon.name + " \u7B2C" + this.currentFloor + "\u5C42";
          }
        };
        return DungeonRunController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "designData", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "floorLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/EnemyController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Vec3, Component;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Vec3 = module.Vec3;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _class, _class2, _descriptor, _descriptor2, _descriptor3;
      cclegacy._RF.push({}, "5a082rID7JCcoFxVrVoMnfW", "EnemyController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var EnemyController = exports('EnemyController', (_dec = ccclass('EnemyController'), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(EnemyController, _Component);
        function EnemyController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "moveSpeed", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "attackRange", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "attackCooldown", _descriptor3, _assertThisInitialized(_this));
          _this.target = null;
          _this.cooldownLeft = 0;
          return _this;
        }
        var _proto = EnemyController.prototype;
        _proto.setTarget = function setTarget(worldPosition) {
          this.target = worldPosition.clone();
        };
        _proto.update = function update(deltaTime) {
          if (!this.target) return;
          this.cooldownLeft = Math.max(0, this.cooldownLeft - deltaTime);
          var current = this.node.worldPosition;
          var distance = Vec3.distance(current, this.target);
          if (distance > this.attackRange) {
            var next = current.clone();
            var direction = this.target.clone().subtract(current).normalize();
            next.add(direction.multiplyScalar(this.moveSpeed * deltaTime));
            this.node.setWorldPosition(next);
            return;
          }
          if (this.cooldownLeft <= 0) {
            this.cooldownLeft = this.attackCooldown;
            this.node.emit('enemy-skill-cast');
          }
        };
        return EnemyController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "moveSpeed", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 90;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "attackRange", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 70;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "attackCooldown", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1.8;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/EnemySpawner.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './EnemyController.ts', './NodePoolController.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Vec3, Component, EnemyController, NodePoolController;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Vec3 = module.Vec3;
      Component = module.Component;
    }, function (module) {
      EnemyController = module.EnemyController;
    }, function (module) {
      NodePoolController = module.NodePoolController;
    }],
    execute: function () {
      var _dec, _dec2, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7;
      cclegacy._RF.push({}, "2a32cIv+0ZNpJHIAiTJtZ+S", "EnemySpawner", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var EnemySpawner = exports('EnemySpawner', (_dec = ccclass('EnemySpawner'), _dec2 = property(NodePoolController), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(EnemySpawner, _Component);
        function EnemySpawner() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "enemyPool", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "spawnX", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "groundY", _descriptor3, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "flyingY", _descriptor4, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "bossSpawnX", _descriptor5, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "bossY", _descriptor6, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "bossScale", _descriptor7, _assertThisInitialized(_this));
          return _this;
        }
        var _proto = EnemySpawner.prototype;
        _proto.spawnEnemy = function spawnEnemy(enemy) {
          if (!this.enemyPool) return null;
          var node = this.enemyPool.spawn();
          if (!node) return null;
          var isBoss = enemy.profile.role === 'boss';
          var spawnX = isBoss ? this.bossSpawnX : this.spawnX;
          var spawnY = isBoss ? this.bossY : enemy.profile.role === 'flying' ? this.flyingY : this.groundY;
          node.setPosition(new Vec3(spawnX, spawnY, 0));
          node.setScale(new Vec3(isBoss ? this.bossScale : 1, isBoss ? this.bossScale : 1, 1));
          enemy.position = {
            x: spawnX,
            y: spawnY
          };
          var controller = node.getComponent(EnemyController);
          if (controller) controller.setTarget(new Vec3(-180, spawnY, 0));
          node.emit('enemy-runtime-spawned', enemy.id, enemy.profile);
          return node;
        };
        _proto.despawnEnemy = function despawnEnemy(node) {
          var _this$enemyPool;
          (_this$enemyPool = this.enemyPool) == null || _this$enemyPool.despawn(node);
        };
        return EnemySpawner;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "enemyPool", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "spawnX", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 520;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "groundY", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return -60;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "flyingY", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 70;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "bossSpawnX", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 610;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "bossY", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return -38;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "bossScale", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1.45;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/EnemyVisualController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './AtlasAnimator.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Component, AtlasAnimator;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Component = module.Component;
    }, function (module) {
      AtlasAnimator = module.AtlasAnimator;
    }],
    execute: function () {
      var _dec, _dec2, _class, _class2, _descriptor, _descriptor2;
      cclegacy._RF.push({}, "da0c5p2i5BNhJEznd3tuQ0S", "EnemyVisualController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var EnemyVisualController = exports('EnemyVisualController', (_dec = ccclass('EnemyVisualController'), _dec2 = property(AtlasAnimator), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(EnemyVisualController, _Component);
        function EnemyVisualController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "animator", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "deathDuration", _descriptor2, _assertThisInitialized(_this));
          return _this;
        }
        var _proto = EnemyVisualController.prototype;
        _proto.onEnable = function onEnable() {
          this.node.on('enemy-hit', this.onEnemyHit, this);
          this.node.on('enemy-defeated', this.onEnemyDefeated, this);
        };
        _proto.onDisable = function onDisable() {
          this.node.off('enemy-hit', this.onEnemyHit, this);
          this.node.off('enemy-defeated', this.onEnemyDefeated, this);
        };
        _proto.onEnemyHit = function onEnemyHit(event) {
          var _this$animator;
          (_this$animator = this.animator) == null || _this$animator.play('hurt');
          this.node.emit('enemy-visual-hit', event);
        };
        _proto.onEnemyDefeated = function onEnemyDefeated(enemyId) {
          var _this$animator2,
            _this2 = this;
          (_this$animator2 = this.animator) == null || _this$animator2.play('death');
          this.node.emit('enemy-visual-death', enemyId);
          this.scheduleOnce(function () {
            _this2.node.emit('enemy-despawn-ready', enemyId);
          }, this.deathDuration);
        };
        return EnemyVisualController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "animator", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "deathDuration", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.45;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/FlyingSwordSkill.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './BattleRuntimeController.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Node, Vec3, Component, BattleRuntimeController;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Node = module.Node;
      Vec3 = module.Vec3;
      Component = module.Component;
    }, function (module) {
      BattleRuntimeController = module.BattleRuntimeController;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5;
      cclegacy._RF.push({}, "221c7TOwaxDTYHk+eGyMaRh", "FlyingSwordSkill", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var FlyingSwordSkill = exports('FlyingSwordSkill', (_dec = ccclass('FlyingSwordSkill'), _dec2 = property(BattleRuntimeController), _dec3 = property(Node), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(FlyingSwordSkill, _Component);
        function FlyingSwordSkill() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "battleRuntime", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "sword", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "cooldown", _descriptor3, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "flightDuration", _descriptor4, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "arcHeight", _descriptor5, _assertThisInitialized(_this));
          _this.timer = 0;
          _this.castTime = 0;
          return _this;
        }
        var _proto = FlyingSwordSkill.prototype;
        _proto.update = function update(deltaTime) {
          this.timer -= deltaTime;
          if (this.timer <= 0) this.cast();
          this.animateFlight(deltaTime);
        };
        _proto.cast = function cast() {
          var _this$battleRuntime;
          this.timer = this.cooldown;
          this.castTime = this.flightDuration;
          var result = (_this$battleRuntime = this.battleRuntime) == null ? void 0 : _this$battleRuntime.castFlyingSword();
          this.node.emit('sword-cast-started', result);
        };
        _proto.animateFlight = function animateFlight(deltaTime) {
          var _this$battleRuntime$s, _this$battleRuntime2, _this$battleRuntime$s2, _this$battleRuntime3, _this$battleRuntime$s3, _this$battleRuntime4;
          if (!this.sword || this.castTime <= 0) return;
          this.castTime -= deltaTime;
          var t = 1 - Math.max(0, this.castTime / this.flightDuration);
          var startX = (_this$battleRuntime$s = (_this$battleRuntime2 = this.battleRuntime) == null ? void 0 : _this$battleRuntime2.swordStartX) != null ? _this$battleRuntime$s : -180;
          var endX = (_this$battleRuntime$s2 = (_this$battleRuntime3 = this.battleRuntime) == null ? void 0 : _this$battleRuntime3.swordEndX) != null ? _this$battleRuntime$s2 : 300;
          var baseY = (_this$battleRuntime$s3 = (_this$battleRuntime4 = this.battleRuntime) == null ? void 0 : _this$battleRuntime4.swordY) != null ? _this$battleRuntime$s3 : -30;
          var x = startX + (endX - startX) * t;
          var y = baseY + Math.sin(t * Math.PI) * this.arcHeight;
          this.sword.setPosition(new Vec3(x, y, 0));
        };
        return FlyingSwordSkill;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "battleRuntime", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "sword", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "cooldown", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1.2;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "flightDuration", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.62;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "arcHeight", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 38;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/main", ['./AnimationAtlas.ts', './AssetCatalog.ts', './BattleRuntime.ts', './CultivationRules.ts', './CultivationRuntime.ts', './CultivationTypes.ts', './PoolingRuntime.ts', './StripAnimationRuntime.ts', './ActorAnimationBinder.ts', './AssetBindingController.ts', './AtlasAnimator.ts', './BattleRuntimeController.ts', './BattleSceneController.ts', './DamageNumberController.ts', './DungeonRunController.ts', './EnemyController.ts', './EnemySpawner.ts', './EnemyVisualController.ts', './FlyingSwordSkill.ts', './NodePoolController.ts', './PlayerController.ts', './PoolableActor.ts', './SoulOrbController.ts', './StageClearPanelController.ts', './StageDirector.ts', './StripAnimator.ts'], function () {
  return {
    setters: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    execute: function () {}
  };
});

System.register("chunks:///_virtual/NodePoolController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './PoolingRuntime.ts', './PoolableActor.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Prefab, instantiate, Component, createPoolState, spawnFromPool, despawnFromPool, PoolableActor;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Prefab = module.Prefab;
      instantiate = module.instantiate;
      Component = module.Component;
    }, function (module) {
      createPoolState = module.createPoolState;
      spawnFromPool = module.spawnFromPool;
      despawnFromPool = module.despawnFromPool;
    }, function (module) {
      PoolableActor = module.PoolableActor;
    }],
    execute: function () {
      var _dec, _dec2, _class, _class2, _descriptor, _descriptor2, _descriptor3;
      cclegacy._RF.push({}, "8fd4dxhuJtIhZLxO9bTECpO", "NodePoolController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var NodePoolController = exports('NodePoolController', (_dec = ccclass('NodePoolController'), _dec2 = property(Prefab), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(NodePoolController, _Component);
        function NodePoolController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "poolKey", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "capacity", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "prefab", _descriptor3, _assertThisInitialized(_this));
          _this.state = createPoolState('default', 0);
          _this.nodes = new Map();
          return _this;
        }
        var _proto = NodePoolController.prototype;
        _proto.onLoad = function onLoad() {
          this.state = createPoolState(this.poolKey, this.capacity);
        };
        _proto.spawn = function spawn() {
          if (!this.prefab) return null;
          var result = spawnFromPool(this.state);
          if (!result.ok || result.id === null) return null;
          var node = this.nodes.get(result.id);
          if (!node) {
            node = instantiate(this.prefab);
            this.node.addChild(node);
            this.nodes.set(result.id, node);
            node.on('pool-despawn-requested', this.despawnByEvent, this);
          }
          var poolable = node.getComponent(PoolableActor);
          if (poolable) {
            poolable.poolKey = this.poolKey;
            poolable.onSpawn(result.id);
          } else {
            node.active = true;
          }
          return node;
        };
        _proto.despawn = function despawn(node) {
          var poolable = node.getComponent(PoolableActor);
          if (!poolable) {
            node.active = false;
            return;
          }
          despawnFromPool(this.state, poolable.poolId);
          poolable.onDespawn();
        };
        _proto.despawnByEvent = function despawnByEvent(poolKey, poolId, node) {
          if (poolKey !== this.poolKey) return;
          despawnFromPool(this.state, poolId);
          var poolable = node.getComponent(PoolableActor);
          if (poolable) poolable.onDespawn();else node.active = false;
        };
        return NodePoolController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "poolKey", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'default';
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "capacity", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 80;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "prefab", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/PlayerController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Node, Vec3, Component;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Node = module.Node;
      Vec3 = module.Vec3;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _dec2, _class, _class2, _descriptor, _descriptor2;
      cclegacy._RF.push({}, "99424XJEQdBJ6lvl/+Qcc9e", "PlayerController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var PlayerController = exports('PlayerController', (_dec = ccclass('PlayerController'), _dec2 = property(Node), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(PlayerController, _Component);
        function PlayerController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "swordMount", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "moveSpeed", _descriptor2, _assertThisInitialized(_this));
          _this.target = new Vec3();
          _this.hasTarget = false;
          return _this;
        }
        var _proto = PlayerController.prototype;
        _proto.moveTo = function moveTo(worldPosition) {
          this.target.set(worldPosition);
          this.hasTarget = true;
        };
        _proto.update = function update(deltaTime) {
          this.animateSword(deltaTime);
          if (!this.hasTarget) return;
          var current = this.node.worldPosition;
          var next = new Vec3();
          Vec3.lerp(next, current, this.target, Math.min(1, deltaTime * 4));
          this.node.setWorldPosition(next);
          if (Vec3.distance(next, this.target) < 4) this.hasTarget = false;
        };
        _proto.animateSword = function animateSword(deltaTime) {
          if (!this.swordMount) return;
          var y = Math.sin(Date.now() * 0.004) * 4;
          this.swordMount.setPosition(this.swordMount.position.x, y - 36, this.swordMount.position.z);
        };
        return PlayerController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "swordMount", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "moveSpeed", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 220;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/PoolableActor.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Component;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _class, _class2, _descriptor;
      cclegacy._RF.push({}, "e4559123YFJnY8rr50CtPGQ", "PoolableActor", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var PoolableActor = exports('PoolableActor', (_dec = ccclass('PoolableActor'), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(PoolableActor, _Component);
        function PoolableActor() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "poolKey", _descriptor, _assertThisInitialized(_this));
          _this.poolId = 0;
          return _this;
        }
        var _proto = PoolableActor.prototype;
        _proto.onSpawn = function onSpawn(poolId) {
          this.poolId = poolId;
          this.node.active = true;
          this.node.emit('pool-spawned', poolId);
        };
        _proto.despawn = function despawn() {
          this.node.emit('pool-despawn-requested', this.poolKey, this.poolId, this.node);
        };
        _proto.onDespawn = function onDespawn() {
          this.node.active = false;
          this.node.emit('pool-despawned', this.poolId);
        };
        return PoolableActor;
      }(Component), _descriptor = _applyDecoratedDescriptor(_class2.prototype, "poolKey", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'default';
        }
      }), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/PoolingRuntime.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        createPoolState: createPoolState,
        despawnFromPool: despawnFromPool,
        poolStats: poolStats,
        spawnFromPool: spawnFromPool
      });
      cclegacy._RF.push({}, "a761a8HkIVKcb3zsvNoBgX/", "PoolingRuntime", undefined);
      function createPoolState(kind, capacity) {
        return {
          kind: kind,
          capacity: Math.max(0, Math.floor(capacity)),
          nextId: 1,
          created: 0,
          overflow: 0,
          items: []
        };
      }
      function spawnFromPool(pool) {
        var inactive = pool.items.find(function (item) {
          return !item.active;
        });
        if (inactive) {
          inactive.active = true;
          return {
            ok: true,
            id: inactive.id,
            reused: true
          };
        }
        if (pool.created >= pool.capacity) {
          pool.overflow += 1;
          return {
            ok: false,
            id: null,
            reused: false
          };
        }
        var item = {
          id: pool.nextId,
          active: true
        };
        pool.nextId += 1;
        pool.created += 1;
        pool.items.push(item);
        return {
          ok: true,
          id: item.id,
          reused: false
        };
      }
      function despawnFromPool(pool, id) {
        var item = pool.items.find(function (entry) {
          return entry.id === id;
        });
        if (!item) return false;
        item.active = false;
        return true;
      }
      function poolStats(pool) {
        return {
          kind: pool.kind,
          capacity: pool.capacity,
          created: pool.created,
          active: pool.items.filter(function (item) {
            return item.active;
          }).length,
          inactive: pool.items.filter(function (item) {
            return !item.active;
          }).length,
          overflow: pool.overflow
        };
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/SoulOrbController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './PoolableActor.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Vec3, Component, PoolableActor;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Vec3 = module.Vec3;
      Component = module.Component;
    }, function (module) {
      PoolableActor = module.PoolableActor;
    }],
    execute: function () {
      var _dec, _class, _class2, _descriptor, _descriptor2, _descriptor3;
      cclegacy._RF.push({}, "efdb9GIFPhDJaC912sKddzH", "SoulOrbController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var SoulOrbController = exports('SoulOrbController', (_dec = ccclass('SoulOrbController'), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(SoulOrbController, _Component);
        function SoulOrbController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "pickupRadius", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "magnetRadius", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "magnetSpeed", _descriptor3, _assertThisInitialized(_this));
          _this.target = null;
          return _this;
        }
        var _proto = SoulOrbController.prototype;
        _proto.follow = function follow(target) {
          this.target = target;
        };
        _proto.update = function update(deltaTime) {
          if (!this.target) return;
          var current = this.node.worldPosition;
          var targetPosition = this.target.worldPosition;
          var distance = Vec3.distance(current, targetPosition);
          if (distance <= this.pickupRadius) {
            this.node.emit('soul-orb-picked');
            var poolable = this.node.getComponent(PoolableActor);
            if (poolable) poolable.despawn();else this.node.active = false;
            return;
          }
          if (distance <= this.magnetRadius) {
            var next = current.clone();
            var direction = targetPosition.clone().subtract(current).normalize();
            next.add(direction.multiplyScalar(this.magnetSpeed * deltaTime));
            this.node.setWorldPosition(next);
          }
        };
        return SoulOrbController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "pickupRadius", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 44;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "magnetRadius", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 220;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "magnetSpeed", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 420;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/StageClearPanelController.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Node, Label, Button, Component;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Node = module.Node;
      Label = module.Label;
      Button = module.Button;
      Component = module.Component;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5;
      cclegacy._RF.push({}, "92aefkgSe1L/Zn9BVLBU7Ka", "StageClearPanelController", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var StageClearPanelController = exports('StageClearPanelController', (_dec = ccclass('StageClearPanelController'), _dec2 = property(Node), _dec3 = property(Label), _dec4 = property(Label), _dec5 = property(Label), _dec6 = property(Button), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(StageClearPanelController, _Component);
        function StageClearPanelController() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "panelRoot", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "titleLabel", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "rewardLabel", _descriptor3, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "nextStageLabel", _descriptor4, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "nextStageButton", _descriptor5, _assertThisInitialized(_this));
          _this.nextStageTarget = 1;
          _this.result = null;
          return _this;
        }
        var _proto = StageClearPanelController.prototype;
        _proto.onLoad = function onLoad() {
          this.hide();
        };
        _proto.showResult = function showResult(result) {
          var _this$panelRoot;
          this.result = result;
          this.nextStageTarget = result.nextStageId;
          var root = (_this$panelRoot = this.panelRoot) != null ? _this$panelRoot : this.node;
          root.active = true;
          if (this.titleLabel) {
            this.titleLabel.string = result.title;
          }
          if (this.rewardLabel) {
            this.rewardLabel.string = ["\u7075\u77F3 +" + result.reward.spiritStones, "\u6CD5\u5B9D\u7CBE\u534E +" + result.reward.artifactEssence, "\u526F\u672C\u5377 " + result.reward.dungeonPass.name + " x1"].join('\n');
          }
          if (this.nextStageLabel) {
            this.nextStageLabel.string = "\u524D\u5F80\u7B2C" + result.nextStageId + "\u5173";
          }
          if (this.nextStageButton) {
            this.nextStageButton.interactable = true;
          }
        };
        _proto.hide = function hide() {
          var _this$panelRoot2;
          var root = (_this$panelRoot2 = this.panelRoot) != null ? _this$panelRoot2 : this.node;
          root.active = false;
        };
        _proto.takeResult = function takeResult() {
          return this.result;
        };
        return StageClearPanelController;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "panelRoot", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "titleLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "rewardLabel", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "nextStageLabel", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "nextStageButton", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/StageDirector.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './CultivationRuntime.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, JsonAsset, Label, Component, stageProfileFromDesign;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      JsonAsset = module.JsonAsset;
      Label = module.Label;
      Component = module.Component;
    }, function (module) {
      stageProfileFromDesign = module.stageProfileFromDesign;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2;
      cclegacy._RF.push({}, "967c6pSVtJCjZyLEUbCZVLl", "StageDirector", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var StageDirector = exports('StageDirector', (_dec = ccclass('StageDirector'), _dec2 = property(JsonAsset), _dec3 = property(Label), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(StageDirector, _Component);
        function StageDirector() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "designData", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "stageLabel", _descriptor2, _assertThisInitialized(_this));
          _this.stageNumber = 1;
          _this.currentStage = null;
          return _this;
        }
        var _proto = StageDirector.prototype;
        _proto.start = function start() {
          this.loadStage(this.stageNumber);
        };
        _proto.loadStage = function loadStage(stageNumber) {
          if (!this.designData) return;
          this.stageNumber = Math.max(1, Math.floor(stageNumber));
          this.currentStage = stageProfileFromDesign(this.designData.json, this.stageNumber);
          if (this.stageLabel && this.currentStage) {
            this.stageLabel.string = "\u7B2C" + this.stageNumber + "\u5173 " + this.currentStage.name;
          }
        };
        _proto.nextStageAfterBoss = function nextStageAfterBoss() {
          this.loadStage(this.stageNumber + 1);
        };
        return StageDirector;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "designData", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "stageLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/StripAnimationRuntime.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        frameIndexAtTime: frameIndexAtTime,
        resourcePathForPng: resourcePathForPng,
        shouldAdvanceAnimation: shouldAdvanceAnimation
      });
      cclegacy._RF.push({}, "6cab7dM1npI25FpyEZ5BEXA", "StripAnimationRuntime", undefined);
      function frameIndexAtTime(input) {
        var safeFrameCount = Math.max(1, Math.floor(input.frameCount));
        var safeFps = Math.max(1, input.framesPerSecond);
        var rawIndex = Math.floor(Math.max(0, input.elapsed) * safeFps);
        return input.loop ? rawIndex % safeFrameCount : Math.min(safeFrameCount - 1, rawIndex);
      }
      function shouldAdvanceAnimation(input) {
        if (!input.visible) return false;
        if (input.distanceToCamera > input.maxActiveDistance) return false;
        return input.accumulatedTime >= input.updateInterval;
      }
      function resourcePathForPng(assetPath) {
        return assetPath.replace(/\.png$/, '');
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/StripAnimator.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './StripAnimationRuntime.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, cclegacy, _decorator, Sprite, SpriteFrame, Rect, Component, shouldAdvanceAnimation, frameIndexAtTime;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Sprite = module.Sprite;
      SpriteFrame = module.SpriteFrame;
      Rect = module.Rect;
      Component = module.Component;
    }, function (module) {
      shouldAdvanceAnimation = module.shouldAdvanceAnimation;
      frameIndexAtTime = module.frameIndexAtTime;
    }],
    execute: function () {
      var _dec, _dec2, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8;
      cclegacy._RF.push({}, "fce94GGBOBJZZjxbaJt+Eed", "StripAnimator", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;
      var StripAnimator = exports('StripAnimator', (_dec = ccclass('StripAnimator'), _dec2 = property(Sprite), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(StripAnimator, _Component);
        function StripAnimator() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "targetSprite", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "frameCount", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "framesPerSecond", _descriptor3, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "loop", _descriptor4, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "visibleForAnimation", _descriptor5, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "distanceToCamera", _descriptor6, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "maxActiveDistance", _descriptor7, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "updateInterval", _descriptor8, _assertThisInitialized(_this));
          _this.frames = [];
          _this.elapsed = 0;
          _this.accumulatedTime = 0;
          _this.frameIndex = 0;
          _this.playing = false;
          return _this;
        }
        var _proto = StripAnimator.prototype;
        _proto.play = function play(texture, frameCount, framesPerSecond) {
          if (frameCount === void 0) {
            frameCount = this.frameCount;
          }
          if (framesPerSecond === void 0) {
            framesPerSecond = this.framesPerSecond;
          }
          this.frameCount = Math.max(1, Math.floor(frameCount));
          this.framesPerSecond = Math.max(1, framesPerSecond);
          this.frames = this.buildFrames(texture, this.frameCount);
          this.elapsed = 0;
          this.accumulatedTime = 0;
          this.frameIndex = 0;
          this.playing = this.frames.length > 0;
          this.applyFrame();
        };
        _proto.stop = function stop() {
          this.playing = false;
          this.elapsed = 0;
        };
        _proto.update = function update(deltaTime) {
          if (!this.playing || this.frames.length <= 1) return;
          this.accumulatedTime += deltaTime;
          if (!shouldAdvanceAnimation({
            visible: this.visibleForAnimation,
            distanceToCamera: this.distanceToCamera,
            maxActiveDistance: this.maxActiveDistance,
            accumulatedTime: this.accumulatedTime,
            updateInterval: this.updateInterval
          })) {
            return;
          }
          this.elapsed += deltaTime;
          this.accumulatedTime = 0;
          this.frameIndex = frameIndexAtTime({
            elapsed: this.elapsed,
            framesPerSecond: this.framesPerSecond,
            frameCount: this.frames.length,
            loop: this.loop
          });
          if (!this.loop && this.frameIndex >= this.frames.length - 1) this.playing = false;
          this.applyFrame();
        };
        _proto.buildFrames = function buildFrames(texture, frameCount) {
          var width = texture.width / frameCount;
          var height = texture.height;
          var frames = [];
          for (var index = 0; index < frameCount; index += 1) {
            var frame = new SpriteFrame();
            frame.texture = texture;
            frame.rect = new Rect(index * width, 0, width, height);
            frames.push(frame);
          }
          return frames;
        };
        _proto.applyFrame = function applyFrame() {
          if (!this.targetSprite || this.frames.length === 0) return;
          this.targetSprite.spriteFrame = this.frames[this.frameIndex];
        };
        return StripAnimator;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "targetSprite", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "frameCount", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 4;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "framesPerSecond", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 8;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "loop", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "visibleForAnimation", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "distanceToCamera", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "maxActiveDistance", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 900;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "updateInterval", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.033;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});