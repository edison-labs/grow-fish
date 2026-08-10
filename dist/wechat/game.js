/* 大鱼吃小鱼 V0.1 - 原创程序化资源 */
"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/platform/platform-port.js
  var require_platform_port = __commonJS({
    "src/platform/platform-port.js"(exports, module) {
      "use strict";
      var PlatformPort = class {
        createCanvas() {
          throw new Error("createCanvas not implemented");
        }
        getViewport() {
          throw new Error("getViewport not implemented");
        }
        requestFrame() {
          throw new Error("requestFrame not implemented");
        }
        cancelFrame() {
        }
        now() {
          return Date.now();
        }
        onPointer() {
          return () => {
          };
        }
        onHide() {
          return () => {
          };
        }
        onShow() {
          return () => {
          };
        }
        onResize() {
          return () => {
          };
        }
        load() {
          return void 0;
        }
        save() {
          return false;
        }
        createAudioContext() {
          return null;
        }
        vibrate() {
          return false;
        }
        log() {
        }
      };
      module.exports = { PlatformPort };
    }
  });

  // src/platform/wechat-platform.js
  var require_wechat_platform = __commonJS({
    "src/platform/wechat-platform.js"(exports, module) {
      "use strict";
      var { PlatformPort } = require_platform_port();
      var WechatPlatform2 = class extends PlatformPort {
        constructor(wxApi) {
          super();
          this.wx = wxApi;
          this.canvas = null;
          this.lastViewport = {
            width: 800,
            height: 450,
            dpr: 1,
            safeArea: null,
            menuButton: null
          };
        }
        createCanvas() {
          if (!this.canvas) this.canvas = this.wx.createCanvas();
          return this.canvas;
        }
        getViewport() {
          const validInfo = (candidate) => candidate && Number.isFinite(candidate.windowWidth) && candidate.windowWidth > 0 && Number.isFinite(candidate.windowHeight) && candidate.windowHeight > 0;
          let info = null;
          if (this.wx.getWindowInfo) {
            try {
              info = this.wx.getWindowInfo();
            } catch (e) {
              info = null;
            }
          }
          if (!validInfo(info)) info = null;
          if (!info && this.wx.getSystemInfoSync) {
            try {
              info = this.wx.getSystemInfoSync();
            } catch (e) {
              info = null;
            }
          }
          if (!validInfo(info)) return this.cloneViewport(this.lastViewport);
          let menuButton = null;
          try {
            menuButton = this.wx.getMenuButtonBoundingClientRect ? this.wx.getMenuButtonBoundingClientRect() : null;
          } catch (e) {
            menuButton = null;
          }
          this.lastViewport = {
            width: info.windowWidth,
            height: info.windowHeight,
            dpr: Number.isFinite(info.pixelRatio) && info.pixelRatio > 0 ? info.pixelRatio : 1,
            safeArea: info.safeArea || null,
            menuButton
          };
          return this.cloneViewport(this.lastViewport);
        }
        cloneViewport(viewport) {
          return {
            ...viewport,
            safeArea: viewport.safeArea ? { ...viewport.safeArea } : null,
            menuButton: viewport.menuButton ? { ...viewport.menuButton } : null
          };
        }
        requestFrame(callback) {
          if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
          if (this.canvas && this.canvas.requestAnimationFrame) return this.canvas.requestAnimationFrame(callback);
          return setTimeout(() => callback(this.now()), 16);
        }
        cancelFrame(id) {
          if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
          else if (this.canvas && this.canvas.cancelAnimationFrame) this.canvas.cancelAnimationFrame(id);
          else clearTimeout(id);
        }
        now() {
          return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        }
        onPointer(listener) {
          const adapt = (type) => (event) => {
            const touches = event.changedTouches || [];
            for (const touch of touches) listener(type, { id: touch.identifier, x: touch.clientX, y: touch.clientY, timeStamp: event.timeStamp || this.now() });
          };
          const start = adapt("start");
          const move = adapt("move");
          const end = adapt("end");
          const cancel = adapt("cancel");
          this.wx.onTouchStart(start);
          this.wx.onTouchMove(move);
          this.wx.onTouchEnd(end);
          this.wx.onTouchCancel(cancel);
          return () => {
            if (this.wx.offTouchStart) this.wx.offTouchStart(start);
            if (this.wx.offTouchMove) this.wx.offTouchMove(move);
            if (this.wx.offTouchEnd) this.wx.offTouchEnd(end);
            if (this.wx.offTouchCancel) this.wx.offTouchCancel(cancel);
          };
        }
        onHide(listener) {
          this.wx.onHide(listener);
          return () => this.wx.offHide && this.wx.offHide(listener);
        }
        onShow(listener) {
          this.wx.onShow(listener);
          return () => this.wx.offShow && this.wx.offShow(listener);
        }
        onResize(listener) {
          if (this.wx.onWindowResize) this.wx.onWindowResize(listener);
          return () => this.wx.offWindowResize && this.wx.offWindowResize(listener);
        }
        load(key) {
          try {
            return this.wx.getStorageSync(key);
          } catch (e) {
            return void 0;
          }
        }
        save(key, value) {
          try {
            this.wx.setStorageSync(key, value);
            return true;
          } catch (error) {
            this.log("warn", "storage_write_failed", { message: error.message });
            return false;
          }
        }
        createAudioContext() {
          try {
            return this.wx.createWebAudioContext ? this.wx.createWebAudioContext() : null;
          } catch (e) {
            return null;
          }
        }
        vibrate(kind = "light") {
          if (!this.wx.vibrateShort) return false;
          try {
            this.wx.vibrateShort({ type: kind, fail: () => {
            } });
            return true;
          } catch (e) {
            return false;
          }
        }
        log(level, event, data) {
          try {
            const logger = this.wx.getLogManager ? this.wx.getLogManager({ level: 1 }) : console;
            const method = (logger == null ? void 0 : logger[level]) || (logger == null ? void 0 : logger.log);
            if (typeof method === "function") method.call(logger, `[grow-fish] ${event}`, data || "");
          } catch (e) {
          }
        }
      };
      module.exports = { WechatPlatform: WechatPlatform2 };
    }
  });

  // src/config/game-config.js
  var require_game_config = __commonJS({
    "src/config/game-config.js"(exports, module) {
      "use strict";
      var GAME_CONFIG = Object.freeze({
        version: "0.1.0",
        tickRate: 60,
        maxCatchUpTicks: 5,
        maxFrameDelta: 0.1,
        player: Object.freeze({
          baseWidthRatio: 0.08,
          sizePerLevel: 1.08,
          maxWidthRatio: 0.16,
          baseSpeedRatio: 0.36,
          speedPerLevel: 0.96,
          bodyAspect: 0.52,
          collisionRatio: 0.7,
          spawnXRatio: 0.35,
          turnSmoothTime: 0.12,
          releaseTime: 0.2
        }),
        input: Object.freeze({ radiusShortSideRatio: 0.08, deadZoneRatio: 0.15 }),
        fish: Object.freeze({
          baseSpeedRatio: 0.14,
          levelSpeedScale: 0.98,
          minRandomSpeed: 0.85,
          maxRandomSpeed: 1.15,
          warningTime: 0.5,
          offscreenPadding: 24,
          spawnAttempts: 5,
          retryDelay: 0.2,
          safeContactTime: 0.8,
          equalCooldown: 0.5,
          equalBounceSpeedRatio: 0.08,
          capacity: 24
        }),
        grass: Object.freeze({
          initialCount: 6,
          maxAtLevelOne: 8,
          maxAfterLevelOne: 4,
          growTime: 0.4,
          respawnMin: 2,
          respawnMax: 3,
          noVisibleFallbackTime: 4,
          placementAttempts: 8,
          retryDelay: 0.5,
          capacity: 10
        }),
        spawn: Object.freeze({
          minInterval: 0.6,
          baseInterval: 1,
          intervalLevelStep: 0.04,
          lowPopulationRatio: 0.6,
          lowPopulationMultiplier: 0.5,
          edibleMinRatio: 0.5,
          openingProtectionTime: 5,
          levelUpPPlus2Protection: 2
        }),
        score: Object.freeze({ comboWindow: 3, comboStep: 0.1, comboMax: 2 }),
        timing: Object.freeze({ levelUpVisual: 0.3, invincible: 0.8, dead: 0.8, deadSlowMotion: 0.4, win: 1.2, tutorialLead: 3 }),
        layout: Object.freeze({ hudHeightRatio: 0.08, minAspect: 4 / 3, maxAspect: 21 / 9, maxDpr: 2 }),
        pools: Object.freeze({ effects: 128, floatingText: 32, warnings: 4 })
      });
      function growthForFish(level) {
        return 1 + level * (level - 1) / 2;
      }
      function upgradeNeed(level) {
        if (level === 1) return 3;
        if (level >= 10) return Infinity;
        return 2 * growthForFish(level - 1);
      }
      function playerSizeScale(level) {
        return Math.min(2, Math.pow(GAME_CONFIG.player.sizePerLevel, level - 1));
      }
      function playerSpeedScale(level) {
        return Math.pow(GAME_CONFIG.player.speedPerLevel, level - 1);
      }
      function targetFishCount(level) {
        return Math.min(14, 8 + Math.floor((level - 1) * 2 / 3));
      }
      function spawnInterval(level) {
        return Math.max(GAME_CONFIG.spawn.minInterval, GAME_CONFIG.spawn.baseInterval - GAME_CONFIG.spawn.intervalLevelStep * (level - 1));
      }
      function lethalCap(level) {
        if (level === 1) return 1;
        return Math.min(3, 1 + Math.floor(level / 3));
      }
      function validateConfig(config = GAME_CONFIG) {
        const errors = [];
        if (config.tickRate !== 60) errors.push("tickRate must be 60");
        if (config.player.releaseTime <= 0 || config.player.turnSmoothTime <= 0) errors.push("player timing must be positive");
        if (config.fish.capacity < 18) errors.push("fish pool too small");
        for (let level = 1; level <= 9; level += 1) {
          if (!Number.isFinite(upgradeNeed(level)) || upgradeNeed(level) <= 0) errors.push(`invalid upgradeNeed ${level}`);
          if (targetFishCount(level) < 8 || targetFishCount(level) > 14) errors.push(`invalid target ${level}`);
        }
        return errors;
      }
      module.exports = {
        GAME_CONFIG,
        growthForFish,
        upgradeNeed,
        playerSizeScale,
        playerSpeedScale,
        targetFishCount,
        spawnInterval,
        lethalCap,
        validateConfig
      };
    }
  });

  // src/core/seeded-rng.js
  var require_seeded_rng = __commonJS({
    "src/core/seeded-rng.js"(exports, module) {
      "use strict";
      function hashLabel(label) {
        let hash = 2166136261 >>> 0;
        for (let i = 0; i < label.length; i += 1) {
          hash ^= label.charCodeAt(i);
          hash = Math.imul(hash, 16777619) >>> 0;
        }
        return hash >>> 0;
      }
      var SeededRng = class _SeededRng {
        constructor(seed = 1) {
          this.initialSeed = seed >>> 0;
          this.state = this.initialSeed;
          this.cursor = 0;
        }
        reset(seed = this.initialSeed) {
          this.initialSeed = seed >>> 0;
          this.state = this.initialSeed;
          this.cursor = 0;
        }
        nextUint() {
          this.state = this.state + 1831565813 >>> 0;
          let value = this.state;
          value = Math.imul(value ^ value >>> 15, value | 1);
          value ^= value + Math.imul(value ^ value >>> 7, value | 61);
          this.cursor += 1;
          return (value ^ value >>> 14) >>> 0;
        }
        next() {
          return this.nextUint() / 4294967296;
        }
        range(min, max) {
          return min + (max - min) * this.next();
        }
        int(min, maxInclusive) {
          return min + Math.floor(this.next() * (maxInclusive - min + 1));
        }
        derive(label) {
          return new _SeededRng((this.initialSeed ^ hashLabel(label)) >>> 0);
        }
        snapshot() {
          return { seed: this.initialSeed, state: this.state, cursor: this.cursor };
        }
      };
      module.exports = { SeededRng, hashLabel };
    }
  });

  // src/core/object-pool.js
  var require_object_pool = __commonJS({
    "src/core/object-pool.js"(exports, module) {
      "use strict";
      var ObjectPool = class {
        constructor(name, capacity, factory) {
          this.name = name;
          this.items = Array.from({ length: capacity }, (_, index) => factory(index));
          this.created = capacity;
          this.borrowed = 0;
          this.returned = 0;
          this.peakActive = 0;
        }
        acquire(reset) {
          const item = this.items.find((candidate) => !candidate.inUse);
          if (!item) return null;
          item.inUse = true;
          item.generation = item.generation + 1 >>> 0;
          this.borrowed += 1;
          if (reset) reset(item);
          this.peakActive = Math.max(this.peakActive, this.activeCount());
          return item;
        }
        release(item, clear) {
          if (!item || !item.inUse) return;
          if (clear) clear(item);
          item.inUse = false;
          this.returned += 1;
        }
        releaseAll(clear) {
          for (const item of this.items) this.release(item, clear);
        }
        activeCount() {
          let count = 0;
          for (const item of this.items) if (item.inUse) count += 1;
          return count;
        }
        stats() {
          return { name: this.name, created: this.created, borrowed: this.borrowed, returned: this.returned, active: this.activeCount(), peakActive: this.peakActive };
        }
      };
      module.exports = { ObjectPool };
    }
  });

  // src/core/math.js
  var require_math = __commonJS({
    "src/core/math.js"(exports, module) {
      "use strict";
      var clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      var lerp = (from, to, alpha) => from + (to - from) * alpha;
      var length = (x, y) => Math.sqrt(x * x + y * y);
      function normalize(x, y, fallbackX = 1, fallbackY = 0) {
        const magnitude = length(x, y);
        return magnitude > 1e-9 ? { x: x / magnitude, y: y / magnitude } : { x: fallbackX, y: fallbackY };
      }
      function ellipsesOverlap(a, b) {
        const rx = a.rx + b.rx;
        const ry = a.ry + b.ry;
        if (rx <= 0 || ry <= 0) return false;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx / (rx * rx) + dy * dy / (ry * ry) <= 1;
      }
      function relationFor(playerLevel, fishLevel) {
        if (fishLevel < playerLevel) return "EDIBLE";
        if (fishLevel === playerLevel) return "EQUAL";
        return "LETHAL";
      }
      module.exports = { clamp, lerp, length, normalize, ellipsesOverlap, relationFor };
    }
  });

  // src/core/entities.js
  var require_entities = __commonJS({
    "src/core/entities.js"(exports, module) {
      "use strict";
      function createFishSlot(poolIndex) {
        return {
          poolIndex,
          inUse: false,
          generation: 0,
          spawnSeq: 0,
          active: false,
          pending: false,
          level: 1,
          visualId: 0,
          side: "left",
          direction: 1,
          x: 0,
          y: 0,
          baseY: 0,
          vx: 0,
          width: 0,
          height: 0,
          age: 0,
          phase: 0,
          amplitude: 0,
          period: 2,
          warningRemaining: 0,
          equalCooldown: 0,
          dangerSuppressed: false,
          entering: false
        };
      }
      function resetFish(fish) {
        fish.active = false;
        fish.pending = false;
        fish.level = 1;
        fish.visualId = 0;
        fish.side = "left";
        fish.direction = 1;
        fish.x = 0;
        fish.y = 0;
        fish.baseY = 0;
        fish.vx = 0;
        fish.width = 0;
        fish.height = 0;
        fish.age = 0;
        fish.phase = 0;
        fish.amplitude = 0;
        fish.period = 2;
        fish.warningRemaining = 0;
        fish.equalCooldown = 0;
        fish.dangerSuppressed = false;
        fish.entering = false;
      }
      function createGrassSlot(poolIndex) {
        return {
          poolIndex,
          inUse: false,
          generation: 0,
          spawnSeq: 0,
          active: false,
          visualId: -1,
          x: 0,
          y: 0,
          width: 24,
          height: 42,
          growRemaining: 0,
          respawnRemaining: 0,
          swayPhase: 0
        };
      }
      function resetGrass(grass) {
        grass.active = false;
        grass.visualId = -1;
        grass.x = 0;
        grass.y = 0;
        grass.width = 24;
        grass.height = 42;
        grass.growRemaining = 0;
        grass.respawnRemaining = 0;
        grass.swayPhase = 0;
      }
      function fishBody(fish) {
        return { x: fish.x, y: fish.y, rx: fish.width * 0.35, ry: fish.height * 0.35 };
      }
      function fishVisualMargins(fish) {
        const facingRight = (fish.direction || 1) >= 0;
        return {
          left: fish.width * (facingRight ? 0.65 : 0.42),
          right: fish.width * (facingRight ? 0.42 : 0.65),
          top: fish.height * 0.5,
          bottom: fish.height * 0.5
        };
      }
      function grassBody(grass) {
        return { x: grass.x, y: grass.y - grass.height * 0.16, rx: grass.width * 0.32, ry: grass.height * 0.25 };
      }
      module.exports = { createFishSlot, resetFish, createGrassSlot, resetGrass, fishBody, fishVisualMargins, grassBody };
    }
  });

  // src/render/layout.js
  var require_layout = __commonJS({
    "src/render/layout.js"(exports, module) {
      "use strict";
      var { GAME_CONFIG } = require_game_config();
      var clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      function finiteOr(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
      }
      function positiveFiniteOr(value, fallback) {
        return Number.isFinite(value) && value > 0 ? value : fallback;
      }
      function computeLayout(viewport = {}) {
        const width = Math.max(1, positiveFiniteOr(viewport.width, 1));
        const height = Math.max(1, positiveFiniteOr(viewport.height, 1));
        const safe = viewport.safeArea && typeof viewport.safeArea === "object" ? viewport.safeArea : {};
        let safeLeft = clamp(finiteOr(safe.left, 0), 0, width);
        let safeRight = clamp(finiteOr(safe.right, width), 0, width);
        let safeTop = clamp(finiteOr(safe.top, 0), 0, height);
        let safeBottom = clamp(finiteOr(safe.bottom, height), 0, height);
        if (safeRight - safeLeft < 1) {
          safeLeft = 0;
          safeRight = width;
        }
        if (safeBottom - safeTop < 1) {
          safeTop = 0;
          safeBottom = height;
        }
        const hudHeight = Math.max(height * GAME_CONFIG.layout.hudHeightRatio, safeTop);
        const rawMenu = viewport.menuButton && typeof viewport.menuButton === "object" ? viewport.menuButton : null;
        const menu = rawMenu ? {
          ...rawMenu,
          left: clamp(finiteOr(rawMenu.left, safeRight), 0, width),
          top: clamp(finiteOr(rawMenu.top, safeTop), 0, height),
          width: Math.max(0, finiteOr(rawMenu.width, 0)),
          height: Math.max(0, finiteOr(rawMenu.height, 0))
        } : null;
        return {
          width,
          height,
          dpr: Math.min(positiveFiniteOr(viewport.dpr, 1), GAME_CONFIG.layout.maxDpr),
          isLandscape: width >= height,
          hudHeight,
          safeTop,
          playable: { left: safeLeft, top: Math.min(hudHeight, safeBottom - 1), right: safeRight, bottom: safeBottom },
          menuButton: menu
        };
      }
      function uiRects(layout, screenState) {
        const w = layout.width;
        const h = layout.height;
        const safeLeft = layout.playable.left;
        const safeRight = layout.playable.right;
        const buttonW = Math.min(240, w * 0.34);
        const buttonH = Math.max(44, h * 0.12);
        const center = (y) => ({ x: (w - buttonW) / 2, y, width: buttonW, height: buttonH });
        const top = Math.max(8, layout.safeTop || 0);
        const settings = {
          sound: { x: safeLeft + 12, y: top, width: 46, height: 38 },
          haptic: { x: safeLeft + 66, y: top, width: 46, height: 38 }
        };
        const menuLeft = layout.menuButton ? layout.menuButton.left : safeRight;
        const pauseX = Math.max(safeLeft + 120, Math.min(safeRight - 54, menuLeft - 58));
        if (screenState === "HOME") return { ...settings, start: center(h * 0.58) };
        if (screenState === "RUNNING") return { pause: { x: pauseX, y: top, width: 46, height: 38 } };
        if (screenState === "PAUSED") return { resume: center(h * 0.44), quit: center(h * 0.61) };
        if (screenState === "RESULT") return { ...settings, retry: center(h * 0.62), home: center(h * 0.78) };
        return {};
      }
      function pointInRect(x, y, rect) {
        return !!rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
      }
      function hitUi(layout, state, x, y) {
        const rects = uiRects(layout, state);
        for (const [name, rect] of Object.entries(rects)) if (pointInRect(x, y, rect)) return name;
        return null;
      }
      module.exports = { computeLayout, uiRects, pointInRect, hitUi };
    }
  });

  // src/input/input-controller.js
  var require_input_controller = __commonJS({
    "src/input/input-controller.js"(exports, module) {
      "use strict";
      var { GAME_CONFIG } = require_game_config();
      var { clamp, length, normalize } = require_math();
      var { hitUi } = require_layout();
      var InputController = class {
        constructor(actionSink) {
          this.actionSink = actionSink;
          this.captures = /* @__PURE__ */ new Map();
          this.moveId = null;
          this.move = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, directionX: 0, directionY: 0, ratio: 0, released: false };
        }
        handle(type, pointer, layout, screenState) {
          if (!["start", "move", "end", "cancel"].includes(type) || !pointer || !this._validId(pointer.id)) return false;
          const finitePosition = Number.isFinite(pointer.x) && Number.isFinite(pointer.y);
          if (type === "start" && (!finitePosition || this.captures.has(pointer.id))) return false;
          if (type === "start") return this._start(pointer, layout, screenState);
          const capture = this.captures.get(pointer.id);
          if (!capture) return false;
          if (!finitePosition) {
            if (type === "end" || type === "cancel") return this._finish(pointer, capture, layout, screenState, true);
            return false;
          }
          if (type === "move") return this._move(pointer, capture, layout, screenState);
          return this._finish(pointer, capture, layout, screenState, type === "cancel");
        }
        _validId(id) {
          return typeof id === "number" && Number.isFinite(id) || typeof id === "string";
        }
        _start(pointer, layout, screenState) {
          const button = hitUi(layout, screenState, pointer.x, pointer.y);
          if (button) {
            this.captures.set(pointer.id, { owner: "UI", button, inside: true });
            return true;
          }
          if (screenState === "RUNNING" && this.moveId === null) {
            this.moveId = pointer.id;
            this.captures.set(pointer.id, { owner: "MOVE" });
            Object.assign(this.move, { active: true, startX: pointer.x, startY: pointer.y, currentX: pointer.x, currentY: pointer.y, directionX: 0, directionY: 0, ratio: 0, released: false });
            return true;
          }
          this.captures.set(pointer.id, { owner: "IGNORED" });
          return false;
        }
        _move(pointer, capture, layout, screenState) {
          if (capture.owner === "UI") {
            capture.inside = hitUi(layout, screenState, pointer.x, pointer.y) === capture.button;
            return true;
          }
          if (capture.owner !== "MOVE" || pointer.id !== this.moveId) return false;
          this.move.currentX = pointer.x;
          this.move.currentY = pointer.y;
          const dx = pointer.x - this.move.startX;
          const dy = pointer.y - this.move.startY;
          const radius = Math.min(layout.width, layout.height) * GAME_CONFIG.input.radiusShortSideRatio;
          const deadZone = radius * GAME_CONFIG.input.deadZoneRatio;
          const distance = length(dx, dy);
          if (distance <= deadZone) {
            this.move.directionX = 0;
            this.move.directionY = 0;
            this.move.ratio = 0;
          } else {
            const direction = normalize(dx, dy);
            this.move.directionX = direction.x;
            this.move.directionY = direction.y;
            this.move.ratio = clamp((distance - deadZone) / (radius - deadZone), 0, 1);
          }
          return true;
        }
        _finish(pointer, capture, layout, screenState, cancelled) {
          if (capture.owner === "UI" && !cancelled && capture.inside && hitUi(layout, screenState, pointer.x, pointer.y) === capture.button) this.actionSink(capture.button);
          if (capture.owner === "MOVE" && pointer.id === this.moveId) {
            this.moveId = null;
            this.move.active = false;
            this.move.released = true;
            this.move.ratio = 0;
          }
          this.captures.delete(pointer.id);
          return true;
        }
        clear(hard = false) {
          this.captures.clear();
          this.moveId = null;
          this.move.active = false;
          this.move.released = !hard;
          this.move.ratio = 0;
          this.move.directionX = 0;
          this.move.directionY = 0;
        }
        snapshot() {
          return { ...this.move };
        }
      };
      module.exports = { InputController };
    }
  });

  // src/storage/save-manager.js
  var require_save_manager = __commonJS({
    "src/storage/save-manager.js"(exports, module) {
      "use strict";
      var SAVE_KEY = "growFish.save.v1";
      function defaults() {
        return {
          schemaVersion: 1,
          highestScore: 0,
          highestLevel: 1,
          fastestWinMs: null,
          tutorialCompleted: false,
          soundEnabled: true,
          hapticEnabled: true
        };
      }
      function normalizeSave(raw) {
        const result = defaults();
        if (!raw || typeof raw !== "object") return result;
        if (Number.isFinite(raw.highestScore) && raw.highestScore >= 0) result.highestScore = Math.floor(raw.highestScore);
        if (Number.isFinite(raw.highestLevel) && raw.highestLevel >= 1 && raw.highestLevel <= 10) result.highestLevel = Math.floor(raw.highestLevel);
        if (Number.isFinite(raw.fastestWinMs) && raw.fastestWinMs > 0) result.fastestWinMs = raw.fastestWinMs;
        if (typeof raw.tutorialCompleted === "boolean") result.tutorialCompleted = raw.tutorialCompleted;
        if (typeof raw.soundEnabled === "boolean") result.soundEnabled = raw.soundEnabled;
        if (typeof raw.hapticEnabled === "boolean") result.hapticEnabled = raw.hapticEnabled;
        return result;
      }
      var SaveManager = class {
        constructor(platform2) {
          this.platform = platform2;
          this.data = normalizeSave(platform2.load(SAVE_KEY));
          this.lastWriteOk = true;
        }
        commitResult(result) {
          let changed = false;
          const highestScore = Math.max(this.data.highestScore, result.score || 0);
          const highestLevel = Math.max(this.data.highestLevel, result.level || 1);
          if (highestScore !== this.data.highestScore) {
            this.data.highestScore = highestScore;
            changed = true;
          }
          if (highestLevel !== this.data.highestLevel) {
            this.data.highestLevel = highestLevel;
            changed = true;
          }
          if (result.won && Number.isFinite(result.durationMs)) {
            if (this.data.fastestWinMs === null || result.durationMs < this.data.fastestWinMs) {
              this.data.fastestWinMs = result.durationMs;
              changed = true;
            }
          }
          if (!changed) {
            this.lastWriteOk = true;
            return true;
          }
          return this.write();
        }
        setTutorialCompleted(value = true) {
          this.data.tutorialCompleted = !!value;
          return this.write();
        }
        setSoundEnabled(value) {
          this.data.soundEnabled = !!value;
          return this.write();
        }
        setHapticEnabled(value) {
          this.data.hapticEnabled = !!value;
          return this.write();
        }
        clear() {
          this.data = defaults();
          return this.write();
        }
        import(raw) {
          this.data = normalizeSave(raw);
          return this.write();
        }
        export() {
          return JSON.parse(JSON.stringify(this.data));
        }
        write() {
          this.lastWriteOk = this.platform.save(SAVE_KEY, this.data);
          return this.lastWriteOk;
        }
      };
      module.exports = { SAVE_KEY, defaults, normalizeSave, SaveManager };
    }
  });

  // src/spawn/spawn-manager.js
  var require_spawn_manager = __commonJS({
    "src/spawn/spawn-manager.js"(exports, module) {
      "use strict";
      var { GAME_CONFIG, targetFishCount, spawnInterval, lethalCap } = require_game_config();
      var { relationFor } = require_math();
      var { fishVisualMargins } = require_entities();
      var SpawnManager = class {
        constructor(world) {
          this.world = world;
          this.timer = 0;
          this.retryRemaining = 0;
          this.initialFill = true;
          this.lastDecision = null;
          this.trace = [];
        }
        reset() {
          this.timer = 0;
          this.retryRemaining = 0;
          this.initialFill = true;
          this.lastDecision = null;
          this.trace.length = 0;
        }
        update(dt) {
          const player = this.world.player;
          if (this.world.screenState !== "RUNNING" || player.level >= 10) return;
          if (this.updatePending(dt)) return;
          if (this.retryRemaining > 0) {
            this.retryRemaining = Math.max(0, this.retryRemaining - dt);
            if (this.retryRemaining <= 1e-9) this.retryRemaining = 0;
            if (this.retryRemaining > 0) return;
            this.timer = Number.POSITIVE_INFINITY;
          }
          const counts = this.counts();
          const target = targetFishCount(player.level);
          if (counts.totalReserved >= target) {
            this.initialFill = false;
            this.timer = Math.min(this.timer, spawnInterval(player.level));
            return;
          }
          if (this.initialFill) {
            this.tryReserve(counts, target);
            return;
          }
          this.timer += dt;
          let interval = spawnInterval(player.level);
          if (counts.totalReserved < target * GAME_CONFIG.spawn.lowPopulationRatio) interval *= GAME_CONFIG.spawn.lowPopulationMultiplier;
          if (this.timer + 1e-9 < interval) return;
          this.timer = 0;
          this.tryReserve(counts, target);
        }
        updatePending(dt) {
          let due = null;
          for (const fish of this.world.fishPool.items) {
            if (!fish.inUse || !fish.pending) continue;
            fish.warningRemaining = Math.max(0, fish.warningRemaining - dt);
            if (fish.warningRemaining <= 1e-9) fish.warningRemaining = 0;
            if (fish.warningRemaining <= 0 && (!due || fish.spawnSeq < due.spawnSeq)) due = fish;
          }
          if (!due) return false;
          const relation = relationFor(this.world.player.level, due.level);
          if (relation === "LETHAL" && !this.world.isDangerSpawnSafe(due, true)) {
            const data = { result: "activation_unsafe_cancelled", fishLevel: due.level, side: due.side, id: due.spawnSeq };
            this.world.releaseFish(due);
            this.record(data);
            return true;
          }
          due.pending = false;
          due.active = true;
          due.entering = true;
          this.world.emit("fish_activated", { id: due.spawnSeq, level: due.level, side: due.side, relation });
          return true;
        }
        tryReserve(counts = this.counts(), target = targetFishCount(this.world.player.level)) {
          const playerLevel = this.world.player.level;
          const decision = {
            tick: this.world.tick,
            playerLevel,
            target,
            counts: { ...counts },
            openingProtection: this.world.runClock < GAME_CONFIG.spawn.openingProtectionTime,
            pPlus2Protection: this.world.pPlus2Protection > 0,
            rngBefore: this.world.gameplayRng.snapshot(),
            rawWeights: null,
            weights: null,
            rejections: [],
            result: null
          };
          let weights = this.buildWeights(playerLevel);
          decision.rawWeights = { ...weights };
          if (decision.openingProtection) weights = this.keepOpeningLevels(weights);
          const edibleMinimum = playerLevel >= 2 ? Math.ceil(target * GAME_CONFIG.spawn.edibleMinRatio) : 0;
          if (counts.edibleActive < edibleMinimum) weights = this.keepRelation(weights, (level2) => level2 < playerLevel);
          weights = this.applyCaps(weights, counts, playerLevel);
          decision.weights = { ...weights };
          const level = this.weightedLevel(weights);
          if (level === null) {
            decision.result = "no_allowed_level";
            this.scheduleRetry(GAME_CONFIG.fish.retryDelay);
            return this.record(decision);
          }
          const relation = relationFor(playerLevel, level);
          const side = this.chooseSide(relation, counts);
          if (!side) {
            decision.result = "side_cap_full";
            this.scheduleRetry(GAME_CONFIG.fish.retryDelay);
            return this.record(decision);
          }
          for (let attempt = 1; attempt <= GAME_CONFIG.fish.spawnAttempts; attempt += 1) {
            const candidate = this.world.acquireFish(level, side, true);
            if (!candidate) {
              decision.result = "pool_exhausted";
              this.scheduleRetry(GAME_CONFIG.fish.retryDelay);
              return this.record(decision);
            }
            this.placeCandidate(candidate, side);
            if (!this.hasVerticalSpacing(candidate)) {
              decision.rejections.push({ attempt, reason: "vertical_spacing", y: candidate.y });
              this.world.releaseFish(candidate);
              continue;
            }
            if (relation === "LETHAL" && !this.world.isDangerSpawnSafe(candidate, false)) {
              decision.rejections.push({ attempt, reason: "unsafe_path", y: candidate.y });
              this.world.releaseFish(candidate);
              continue;
            }
            decision.result = relation === "LETHAL" ? "warning_reserved" : "spawn_reserved";
            decision.level = level;
            decision.side = side;
            decision.y = candidate.y;
            decision.attempt = attempt;
            if (relation === "LETHAL") {
              candidate.pending = true;
              candidate.active = false;
              candidate.warningRemaining = GAME_CONFIG.fish.warningTime;
              this.world.emit("danger_warning", { id: candidate.spawnSeq, level, side, y: candidate.y });
            } else {
              candidate.active = true;
              candidate.pending = false;
              candidate.entering = true;
              this.world.emit("fish_activated", { id: candidate.spawnSeq, level, side, relation });
            }
            return this.record(decision);
          }
          decision.result = "position_attempts_exhausted";
          this.scheduleRetry(GAME_CONFIG.fish.retryDelay);
          return this.record(decision);
        }
        buildWeights(playerLevel) {
          const weights = {};
          const add = (level, weight) => {
            const bounded = Math.max(1, Math.min(10, level));
            weights[bounded] = (weights[bounded] || 0) + weight;
          };
          if (playerLevel === 1) {
            add(1, 0.55);
            add(2, 0.4);
            add(3, 0.05);
          } else {
            if (playerLevel - 2 < 1) add(playerLevel - 1, 0.2);
            else add(playerLevel - 2, 0.2);
            add(playerLevel - 1, 0.45);
            add(playerLevel, 0.15);
            add(playerLevel + 1, 0.17);
            if (playerLevel + 2 > 10) add(playerLevel + 1, 0.03);
            else add(playerLevel + 2, 0.03);
          }
          return weights;
        }
        keepOpeningLevels(weights) {
          const kept = {};
          if (weights[1]) kept[1] = weights[1];
          if (weights[2]) kept[2] = weights[2];
          if (!Object.keys(kept).length) {
            kept[1] = 0.65;
            kept[2] = 0.35;
          }
          return kept;
        }
        keepRelation(weights, predicate) {
          const kept = {};
          for (const [key, weight] of Object.entries(weights)) if (predicate(Number(key))) kept[key] = weight;
          return kept;
        }
        applyCaps(weights, counts, playerLevel) {
          const result = { ...weights };
          for (const key of Object.keys(result)) {
            const level = Number(key);
            if (level > playerLevel && counts.lethalReserved >= lethalCap(playerLevel)) delete result[key];
            if (level === playerLevel + 2 && (counts.pPlus2Reserved >= 1 || this.world.pPlus2Protection > 0)) delete result[key];
          }
          return result;
        }
        weightedLevel(weights) {
          const entries = Object.entries(weights).filter(([, value]) => value > 0).sort((a, b) => Number(a[0]) - Number(b[0]));
          const total = entries.reduce((sum, entry) => sum + entry[1], 0);
          if (!total) return null;
          let roll = this.world.gameplayRng.next() * total;
          for (const [level, weight] of entries) {
            roll -= weight;
            if (roll <= 0) return Number(level);
          }
          return Number(entries[entries.length - 1][0]);
        }
        chooseSide(relation, counts) {
          if (relation === "LETHAL") {
            if (counts.enteringLeft >= 1 && counts.enteringRight >= 1) return null;
            if (counts.enteringLeft >= 1) return "right";
            if (counts.enteringRight >= 1) return "left";
          }
          return this.world.gameplayRng.next() < 0.5 ? "left" : "right";
        }
        placeCandidate(fish, side) {
          const bounds = this.world.layout.playable;
          const padding = Math.max(12, fish.height * 0.5 + 12);
          fish.y = this.world.gameplayRng.range(bounds.top + padding, bounds.bottom - padding);
          fish.baseY = fish.y;
          const visual = fishVisualMargins(fish);
          fish.x = side === "left" ? bounds.left - visual.right - GAME_CONFIG.fish.offscreenPadding : bounds.right + visual.left + GAME_CONFIG.fish.offscreenPadding;
        }
        hasVerticalSpacing(candidate) {
          for (const fish of this.world.fishPool.items) {
            if (!fish.inUse || fish === candidate || !fish.pending && !fish.entering) continue;
            if (fish.side !== candidate.side) continue;
            if (Math.abs(fish.y - candidate.y) < Math.max(fish.height, candidate.height) * 1.2) return false;
          }
          return true;
        }
        counts() {
          const result = { active: 0, pending: 0, totalReserved: 0, edibleActive: 0, lethalReserved: 0, pPlus2Reserved: 0, enteringLeft: 0, enteringRight: 0 };
          const playerLevel = this.world.player.level;
          for (const fish of this.world.fishPool.items) {
            if (!fish.inUse) continue;
            if (fish.active) result.active += 1;
            if (fish.pending) result.pending += 1;
            result.totalReserved += 1;
            const relation = relationFor(playerLevel, fish.level);
            if (fish.active && relation === "EDIBLE") result.edibleActive += 1;
            if (relation === "LETHAL") {
              result.lethalReserved += 1;
              if (fish.pending || fish.entering) result[fish.side === "left" ? "enteringLeft" : "enteringRight"] += 1;
            }
            if (fish.level === playerLevel + 2) result.pPlus2Reserved += 1;
          }
          return result;
        }
        record(decision) {
          if (!decision.rngAfter) decision.rngAfter = this.world.gameplayRng.snapshot();
          this.lastDecision = decision;
          this.trace.push(decision);
          if (this.trace.length > 256) this.trace.shift();
          this.world.emit("spawn_decision", decision);
          return decision;
        }
        scheduleRetry(delay) {
          this.retryRemaining = delay;
          this.timer = 0;
        }
      };
      module.exports = { SpawnManager };
    }
  });

  // src/collision/collision-system.js
  var require_collision_system = __commonJS({
    "src/collision/collision-system.js"(exports, module) {
      "use strict";
      var { GAME_CONFIG } = require_game_config();
      var { ellipsesOverlap, normalize, relationFor } = require_math();
      var { fishBody, grassBody } = require_entities();
      var CollisionSystem = class {
        constructor(world) {
          this.world = world;
          this.lethal = [];
          this.edible = [];
          this.grass = [];
          this.equal = [];
          this.injected = null;
        }
        inject(events) {
          this.injected = Array.isArray(events) ? events.slice() : null;
        }
        resolve(frameSnapshot) {
          this.lethal.length = 0;
          this.edible.length = 0;
          this.grass.length = 0;
          this.equal.length = 0;
          if (this.injected) this.collectInjected(frameSnapshot);
          else this.collectDetected(frameSnapshot);
          this.injected = null;
          const byId = (a, b) => a.spawnSeq - b.spawnSeq;
          this.lethal.sort(byId);
          this.edible.sort(byId);
          this.grass.sort(byId);
          this.equal.sort(byId);
          if (this.lethal.length) {
            this.world.lockDeath(this.lethal[0]);
            return;
          }
          for (const fish of this.edible) if (fish.inUse && fish.active) this.world.consumeFish(fish);
          for (const grass of this.grass) if (grass.inUse && grass.active && grass.growRemaining <= 0) this.world.consumeGrass(grass);
          for (const fish of this.equal) if (fish.inUse && fish.active) this.bounceEqual(fish);
        }
        collectDetected(frameSnapshot) {
          const playerBody = this.world.playerBody();
          for (const fish of this.world.fishPool.items) {
            if (!fish.inUse || !fish.active) continue;
            const overlaps = ellipsesOverlap(playerBody, fishBody(fish));
            if (!overlaps) {
              fish.dangerSuppressed = false;
              continue;
            }
            const relation = relationFor(frameSnapshot.level, fish.level);
            if (relation === "LETHAL") {
              if (frameSnapshot.invincible) fish.dangerSuppressed = true;
              else if (!fish.dangerSuppressed) this.lethal.push(fish);
            } else if (relation === "EDIBLE") this.edible.push(fish);
            else if (fish.equalCooldown <= 0) this.equal.push(fish);
          }
          for (const grass of this.world.grassPool.items) {
            if (!grass.inUse || !grass.active || grass.growRemaining > 0) continue;
            if (ellipsesOverlap(playerBody, grassBody(grass))) this.grass.push(grass);
          }
        }
        collectInjected(frameSnapshot) {
          for (const event of this.injected) {
            if (!event || !event.entity) continue;
            const type = event.type || (event.entity.level ? relationFor(frameSnapshot.level, event.entity.level) : "GRASS");
            if (type === "LETHAL") {
              if (frameSnapshot.invincible) event.entity.dangerSuppressed = true;
              else if (!event.entity.dangerSuppressed) this.lethal.push(event.entity);
            } else if (type === "EDIBLE") this.edible.push(event.entity);
            else if (type === "EQUAL") this.equal.push(event.entity);
            else if (type === "GRASS") this.grass.push(event.entity);
          }
        }
        bounceEqual(fish) {
          const fallbackAngle = (fish.spawnSeq * 2654435761 >>> 0) / 4294967296 * Math.PI * 2;
          const direction = normalize(this.world.player.x - fish.x, this.world.player.y - fish.y, Math.cos(fallbackAngle), Math.sin(fallbackAngle));
          const speed = this.world.layout.width * GAME_CONFIG.fish.equalBounceSpeedRatio;
          this.world.player.vx += direction.x * speed;
          this.world.player.vy += direction.y * speed;
          if (!this.world.input.move.active) {
            this.world.input.move.released = true;
            this.world.player.releaseElapsed = 0;
            this.world.player.releaseVx = this.world.player.vx;
            this.world.player.releaseVy = this.world.player.vy;
          }
          fish.x -= direction.x * Math.min(fish.width * 0.12, this.world.layout.width * 0.015);
          fish.y -= direction.y * Math.min(fish.height * 0.12, this.world.layout.width * 0.015);
          fish.equalCooldown = GAME_CONFIG.fish.equalCooldown;
          this.world.emit("equal_bounce", { id: fish.spawnSeq, level: fish.level });
        }
      };
      module.exports = { CollisionSystem };
    }
  });

  // src/core/game-core.js
  var require_game_core = __commonJS({
    "src/core/game-core.js"(exports, module) {
      "use strict";
      var {
        GAME_CONFIG,
        growthForFish,
        upgradeNeed,
        playerSizeScale,
        playerSpeedScale,
        validateConfig
      } = require_game_config();
      var { SeededRng } = require_seeded_rng();
      var { ObjectPool } = require_object_pool();
      var { clamp, ellipsesOverlap, relationFor } = require_math();
      var { createFishSlot, resetFish, createGrassSlot, resetGrass, fishBody, fishVisualMargins } = require_entities();
      var { computeLayout } = require_layout();
      var { InputController } = require_input_controller();
      var { SaveManager } = require_save_manager();
      var { SpawnManager } = require_spawn_manager();
      var { CollisionSystem } = require_collision_system();
      function decayTimer(value, dt) {
        const next = value - dt;
        return next <= 1e-9 ? 0 : next;
      }
      var GameCore = class {
        constructor(platform2, options = {}) {
          const errors = validateConfig();
          if (errors.length) throw new Error(`Invalid game config: ${errors.join(", ")}`);
          this.platform = platform2;
          this.layout = computeLayout(options.viewport || platform2.getViewport());
          this.saveManager = options.saveManager || new SaveManager(platform2);
          this.input = new InputController((action) => this.handleAction(action));
          this.fishPool = new ObjectPool("fish", GAME_CONFIG.fish.capacity, createFishSlot);
          this.grassPool = new ObjectPool("grass", GAME_CONFIG.grass.capacity, createGrassSlot);
          this.spawnManager = new SpawnManager(this);
          this.collisionSystem = new CollisionSystem(this);
          this.events = [];
          this.eventLog = [];
          this.tick = 0;
          this.runId = 0;
          this.spawnSeq = 0;
          this.screenState = "HOME";
          this.pausedFrom = null;
          this.orientationBlocked = !this.layout.isLandscape;
          this.hidden = false;
          this.resultLocked = false;
          this.resultCommitted = false;
          this.result = null;
          this.runClock = 0;
          this.cinematicClock = 0;
          this.levelUpRemaining = 0;
          this.invincibleRemaining = 0;
          this.pPlus2Protection = 0;
          this.noVisibleGrassTime = 0;
          this.grassRetryRemaining = 0;
          this.comboEligibleThisFrame = false;
          this.masterSeed = options.seed === void 0 ? 20260731 : options.seed >>> 0;
          this.setSeed(this.masterSeed);
          this.player = this.createPlayer();
          this.stats = this.createStats();
          this.tutorial = this.createTutorial();
          this.debug = { enabled: false, freezeAI: false, showCollision: false, droppedTicks: 0 };
        }
        setSeed(seed) {
          this.masterSeed = seed >>> 0;
          const master = new SeededRng(this.masterSeed);
          this.gameplayRng = master.derive("gameplay");
          this.appearanceRng = master.derive("appearance");
          this.fxRng = master.derive("fx");
        }
        createPlayer() {
          return { level: 1, xp: 0, x: 0, y: 0, vx: 0, vy: 0, width: 0, height: 0, facing: 1, releaseVx: 0, releaseVy: 0, releaseElapsed: GAME_CONFIG.player.releaseTime };
        }
        createStats() {
          return { score: 0, fishEaten: 0, grassEaten: 0, comboCount: 0, comboTimer: 0, highestCombo: 0 };
        }
        createTutorial() {
          return { enabled: !this.saveManager.data.tutorialCompleted, elapsed: 0, ateGrass: false, ateFish: false };
        }
        startRun(seed) {
          this.releaseAllEntities();
          this.runId += 1;
          this.tick = 0;
          this.spawnSeq = 0;
          this.setSeed(seed === void 0 ? (this.platform.now() >>> 0 ^ Math.imul(this.runId, 2654435761)) >>> 0 : seed);
          this.screenState = "RUNNING";
          this.pausedFrom = null;
          this.orientationBlocked = !this.layout.isLandscape;
          this.resultLocked = false;
          this.resultCommitted = false;
          this.result = null;
          this.runClock = 0;
          this.cinematicClock = 0;
          this.levelUpRemaining = 0;
          this.invincibleRemaining = 0;
          this.pPlus2Protection = 0;
          this.noVisibleGrassTime = 0;
          this.grassRetryRemaining = 0;
          this.comboEligibleThisFrame = false;
          this.player = this.createPlayer();
          this.stats = this.createStats();
          this.tutorial = this.createTutorial();
          this.spawnManager.reset();
          this.input.clear(true);
          this.updatePlayerDimensions();
          const bounds = this.layout.playable;
          this.player.x = bounds.left + (bounds.right - bounds.left) * GAME_CONFIG.player.spawnXRatio;
          this.player.y = bounds.top + (bounds.bottom - bounds.top) * 0.5;
          this.spawnInitialGrass();
          this.spawnInitialFish();
          this.emit("game_start", { runId: this.runId, seed: this.masterSeed, firstTutorial: this.tutorial.enabled });
          if (this.orientationBlocked) this.pause("orientation");
        }
        update(dt = 1 / GAME_CONFIG.tickRate) {
          if (this.screenState === "DEAD" || this.screenState === "WIN") return this.updateCinematic(dt);
          if (this.screenState !== "RUNNING") return;
          const frameSnapshot = { level: this.player.level, invincible: this.invincibleRemaining > 0 };
          const levelUpActiveAtFrameStart = this.levelUpRemaining > 0;
          this.comboEligibleThisFrame = this.stats.comboTimer > 0;
          this.tick += 1;
          this.runClock += dt;
          if (this.tutorial.enabled) this.tutorial.elapsed += dt;
          if (this.stats.comboTimer > 0) {
            this.stats.comboTimer = decayTimer(this.stats.comboTimer, dt);
          }
          if (this.invincibleRemaining > 0) this.invincibleRemaining = decayTimer(this.invincibleRemaining, dt);
          if (this.pPlus2Protection > 0) this.pPlus2Protection = decayTimer(this.pPlus2Protection, dt);
          if (this.levelUpRemaining > 0) {
            this.levelUpRemaining = decayTimer(this.levelUpRemaining, dt);
            if (this.levelUpRemaining === 0) this.emit("level_up_visual_end", { level: this.player.level });
          }
          this.updatePlayer(dt);
          if (!this.debug.freezeAI) this.updateFish(dt);
          this.updateGrass(dt);
          this.spawnManager.update(dt);
          this.collisionSystem.resolve(frameSnapshot);
          if (this.stats.comboTimer === 0) this.stats.comboCount = 0;
          if (this.screenState !== "RUNNING") return;
          if (!levelUpActiveAtFrameStart && this.levelUpRemaining <= 0 && this.player.level < 10 && this.player.xp >= upgradeNeed(this.player.level)) this.applyLevelUp();
        }
        updateCinematic(dt) {
          if (this.screenState === "DEAD" && this.cinematicClock < GAME_CONFIG.timing.deadSlowMotion && !this.debug.freezeAI) {
            const remaining = GAME_CONFIG.timing.deadSlowMotion - this.cinematicClock;
            const motionDt = Math.min(dt, remaining);
            const slowScale = 0.35 * clamp(remaining / GAME_CONFIG.timing.deadSlowMotion, 0, 1);
            this.updateFish(motionDt * slowScale);
          }
          this.cinematicClock += dt;
          const duration = this.screenState === "DEAD" ? GAME_CONFIG.timing.dead : GAME_CONFIG.timing.win;
          if (this.cinematicClock + 1e-9 >= duration) this.enterResult();
        }
        updatePlayer(dt) {
          const move = this.input.move;
          const maxSpeed = this.layout.width * GAME_CONFIG.player.baseSpeedRatio * playerSpeedScale(this.player.level);
          if (move.active) {
            const targetX = move.directionX * maxSpeed * move.ratio;
            const targetY = move.directionY * maxSpeed * move.ratio;
            const alpha = 1 - Math.exp(-dt / GAME_CONFIG.player.turnSmoothTime);
            this.player.vx += (targetX - this.player.vx) * alpha;
            this.player.vy += (targetY - this.player.vy) * alpha;
            this.player.releaseElapsed = 0;
          } else if (move.released) {
            if (this.player.releaseElapsed === 0) {
              this.player.releaseVx = this.player.vx;
              this.player.releaseVy = this.player.vy;
            }
            this.player.releaseElapsed = Math.min(GAME_CONFIG.player.releaseTime, this.player.releaseElapsed + dt);
            const ratio = 1 - this.player.releaseElapsed / GAME_CONFIG.player.releaseTime;
            this.player.vx = this.player.releaseVx * Math.max(0, ratio);
            this.player.vy = this.player.releaseVy * Math.max(0, ratio);
            if (this.player.releaseElapsed >= GAME_CONFIG.player.releaseTime) move.released = false;
          } else if (!move.active) {
            this.player.vx = 0;
            this.player.vy = 0;
          }
          this.player.x += this.player.vx * dt;
          this.player.y += this.player.vy * dt;
          if (Math.abs(this.player.vx) > maxSpeed * 0.04) this.player.facing = this.player.vx < 0 ? -1 : 1;
          this.clampPlayerToBounds();
        }
        updateFish(dt) {
          const bounds = this.layout.playable;
          for (const fish of this.fishPool.items) {
            if (!fish.inUse || !fish.active) continue;
            fish.age += dt;
            fish.equalCooldown = decayTimer(fish.equalCooldown, dt);
            fish.x += fish.vx * dt;
            fish.y = clamp(fish.baseY + Math.sin(fish.phase + fish.age * Math.PI * 2 / fish.period) * fish.amplitude, bounds.top + fish.height * 0.5, bounds.bottom - fish.height * 0.5);
            const visual = fishVisualMargins(fish);
            fish.entering = fish.side === "left" ? fish.x - visual.left < bounds.left : fish.x + visual.right > bounds.right;
            const departed = fish.direction > 0 ? fish.x - visual.left > bounds.right : fish.x + visual.right < bounds.left;
            if (departed) this.releaseFish(fish);
          }
        }
        updateGrass(dt) {
          this.enforceGrassPopulationCap();
          let visible = 0;
          let active = 0;
          for (const grass of this.grassPool.items) {
            if (!grass.inUse) continue;
            if (grass.active) {
              active += 1;
              grass.growRemaining = decayTimer(grass.growRemaining, dt);
              if (grass.growRemaining <= 0) visible += 1;
            } else if (grass.respawnRemaining > 0) grass.respawnRemaining = decayTimer(grass.respawnRemaining, dt);
          }
          const maxGrass = this.player.level === 1 ? GAME_CONFIG.grass.maxAtLevelOne : GAME_CONFIG.grass.maxAfterLevelOne;
          for (const grass of this.grassPool.items) {
            if (active >= maxGrass) break;
            if (grass.inUse && !grass.active && grass.respawnRemaining <= 0 && this.placeGrass(grass, false)) {
              active += 1;
              visible += 0;
            }
          }
          if (this.player.level === 1 && visible === 0) this.noVisibleGrassTime += dt;
          else this.noVisibleGrassTime = 0;
          if (this.grassRetryRemaining > 0) this.grassRetryRemaining = decayTimer(this.grassRetryRemaining, dt);
          if (this.player.level === 1 && this.noVisibleGrassTime >= GAME_CONFIG.grass.noVisibleFallbackTime && this.grassRetryRemaining <= 0) {
            const grass = this.grassPool.items.find((item) => !item.inUse || !item.active && item.respawnRemaining <= 0);
            if (grass && this.placeGrass(grass, true)) this.noVisibleGrassTime = 0;
            else this.grassRetryRemaining = GAME_CONFIG.grass.retryDelay;
          }
        }
        updatePlayerDimensions() {
          const width = Math.min(this.layout.width * GAME_CONFIG.player.maxWidthRatio, this.layout.width * GAME_CONFIG.player.baseWidthRatio * playerSizeScale(this.player.level));
          this.player.width = width;
          this.player.height = width * GAME_CONFIG.player.bodyAspect;
        }
        playerBody(position = this.player) {
          return { x: position.x, y: position.y, rx: this.player.width * 0.35, ry: this.player.height * 0.35 };
        }
        clampPlayerToBounds() {
          const bounds = this.layout.playable;
          const rx = this.player.width * 0.35;
          const ry = this.player.height * 0.35;
          if (this.player.x < bounds.left + rx) {
            this.player.x = bounds.left + rx;
            if (this.player.vx < 0) this.player.vx = 0;
          }
          if (this.player.x > bounds.right - rx) {
            this.player.x = bounds.right - rx;
            if (this.player.vx > 0) this.player.vx = 0;
          }
          if (this.player.y < bounds.top + ry) {
            this.player.y = bounds.top + ry;
            if (this.player.vy < 0) this.player.vy = 0;
          }
          if (this.player.y > bounds.bottom - ry) {
            this.player.y = bounds.bottom - ry;
            if (this.player.vy > 0) this.player.vy = 0;
          }
        }
        acquireFish(level, side, randomize = true) {
          const fish = this.fishPool.acquire(resetFish);
          if (!fish) return null;
          fish.spawnSeq = ++this.spawnSeq;
          fish.level = clamp(Math.floor(level), 1, 10);
          fish.side = side;
          fish.direction = side === "left" ? 1 : -1;
          fish.visualId = randomize ? this.appearanceRng.int(0, 4) : fish.spawnSeq % 5;
          const size = Math.min(this.layout.width * GAME_CONFIG.player.maxWidthRatio, this.layout.width * GAME_CONFIG.player.baseWidthRatio * playerSizeScale(fish.level));
          fish.width = size;
          fish.height = size * GAME_CONFIG.player.bodyAspect;
          const randomScale = randomize ? this.gameplayRng.range(GAME_CONFIG.fish.minRandomSpeed, GAME_CONFIG.fish.maxRandomSpeed) : 1;
          fish.vx = fish.direction * this.layout.width * GAME_CONFIG.fish.baseSpeedRatio * randomScale * Math.pow(GAME_CONFIG.fish.levelSpeedScale, fish.level - 1);
          fish.phase = randomize ? this.gameplayRng.range(0, Math.PI * 2) : fish.spawnSeq;
          fish.amplitude = this.layout.height * (randomize ? this.gameplayRng.range(0.01, 0.03) : 0.015);
          fish.period = randomize ? this.gameplayRng.range(1.5, 3) : 2.2;
          return fish;
        }
        releaseFish(fish) {
          this.fishPool.release(fish, resetFish);
        }
        spawnInitialFish() {
          const bounds = this.layout.playable;
          const positions = [[0.62, 0.22], [0.8, 0.43], [0.58, 0.72], [0.83, 0.84]];
          positions.forEach(([nx, ny], index) => {
            const side = index % 2 === 0 ? "left" : "right";
            const fish = this.acquireFish(1, side, false);
            if (!fish) return;
            fish.active = true;
            fish.entering = false;
            fish.x = bounds.left + (bounds.right - bounds.left) * nx;
            fish.y = bounds.top + (bounds.bottom - bounds.top) * ny;
            fish.baseY = fish.y;
          });
        }
        spawnInitialGrass() {
          const angleSet = [0, Math.PI * 0.72, Math.PI * 1.15, Math.PI * 1.55, Math.PI * 0.3, Math.PI * 1.85];
          for (let index = 0; index < GAME_CONFIG.grass.initialCount; index += 1) {
            const grass = this.grassPool.acquire(resetGrass);
            if (!grass) break;
            grass.spawnSeq = ++this.spawnSeq;
            const near = index < 2;
            const distance = this.player.width * (near ? index === 0 ? 1.4 : 2.1 : 2.8 + index * 0.3);
            const angle = angleSet[index];
            grass.x = this.player.x + Math.cos(angle) * distance;
            grass.y = this.player.y + Math.sin(angle) * distance;
            if (this.isGrassPositionLegal(grass, true)) this.activateGrass(grass);
            else if (near && this.placeInitialNearGrass(grass, index)) continue;
            else if (!this.placeGrass(grass, false)) this.placeInitialGrassFallback(grass, index);
          }
        }
        placeInitialNearGrass(grass, index) {
          const distances = index === 0 ? [1.4, 1.8, 2.2, 1.1, 2.5] : [2.1, 1.6, 2.4, 1.2, 1.9];
          for (const distanceRatio of distances) {
            for (let angleIndex = 0; angleIndex < 16; angleIndex += 1) {
              const angle = (angleIndex + index * 5) / 16 * Math.PI * 2;
              grass.x = this.player.x + Math.cos(angle) * this.player.width * distanceRatio;
              grass.y = this.player.y + Math.sin(angle) * this.player.width * distanceRatio;
              if (this.isGrassPositionLegal(grass, true)) {
                this.activateGrass(grass);
                return true;
              }
            }
          }
          return false;
        }
        placeInitialGrassFallback(grass, index) {
          const legal = this.grassPlacementBounds(grass);
          const columns = 9;
          const rows = 5;
          for (let offset = 0; offset < columns * rows; offset += 1) {
            const cell = (offset * 17 + index * 11) % (columns * rows);
            const column = cell % columns;
            const row = Math.floor(cell / columns);
            grass.x = legal.xMin + (legal.xMax - legal.xMin) * column / (columns - 1);
            grass.y = legal.yMin + (legal.yMax - legal.yMin) * row / (rows - 1);
            if (this.isGrassPositionLegal(grass, false)) {
              this.activateGrass(grass);
              return true;
            }
          }
          return false;
        }
        grassPlacementBounds(grass, layout = this.layout) {
          const bounds = layout.playable;
          const edgeMargin = Math.min(layout.width, layout.height) * 0.05;
          const xPadding = Math.max(grass.width, edgeMargin);
          const topPadding = Math.max(grass.height, edgeMargin);
          const bottomPadding = Math.max(grass.height * 0.4, edgeMargin);
          return {
            xMin: bounds.left + xPadding,
            xMax: bounds.right - xPadding,
            yMin: bounds.top + topPadding,
            yMax: bounds.bottom - bottomPadding
          };
        }
        placeGrass(grass, preferForward) {
          if (!grass.inUse) {
            const acquired = this.grassPool.acquire(resetGrass);
            if (!acquired) return false;
            grass = acquired;
            grass.spawnSeq = ++this.spawnSeq;
          }
          const legal = this.grassPlacementBounds(grass);
          const baseAngle = preferForward ? Math.atan2(this.player.vy || 0, this.player.vx || this.player.facing) : this.gameplayRng.range(0, Math.PI * 2);
          for (let attempt = 0; attempt < GAME_CONFIG.grass.placementAttempts; attempt += 1) {
            const fan = attempt < 5 ? this.gameplayRng.range(-Math.PI / 3, Math.PI / 3) : this.gameplayRng.range(-Math.PI, Math.PI);
            const distance = this.player.width * this.gameplayRng.range(1.5, 3);
            grass.x = clamp(this.player.x + Math.cos(baseAngle + fan) * distance, legal.xMin, legal.xMax);
            grass.y = clamp(this.player.y + Math.sin(baseAngle + fan) * distance, legal.yMin, legal.yMax);
            if (this.isGrassPositionLegal(grass, false)) {
              this.activateGrass(grass);
              return true;
            }
          }
          if (grass.inUse && !grass.active) grass.respawnRemaining = GAME_CONFIG.grass.retryDelay;
          return false;
        }
        activateGrass(grass) {
          if (!Number.isInteger(grass.visualId) || grass.visualId < 0) grass.visualId = grass.spawnSeq % 3;
          grass.active = true;
          grass.growRemaining = GAME_CONFIG.grass.growTime;
          grass.respawnRemaining = 0;
          grass.swayPhase = this.fxRng.range(0, Math.PI * 2);
        }
        isGrassPositionLegal(candidate, allowNearPlayer) {
          const legal = this.grassPlacementBounds(candidate);
          if (candidate.x < legal.xMin || candidate.x > legal.xMax || candidate.y < legal.yMin || candidate.y > legal.yMax) return false;
          const dx = candidate.x - this.player.x;
          const dy = candidate.y - this.player.y;
          if (!allowNearPlayer && Math.sqrt(dx * dx + dy * dy) < this.player.width) return false;
          for (const grass of this.grassPool.items) {
            if (!grass.inUse || !grass.active || grass === candidate) continue;
            const gx = grass.x - candidate.x;
            const gy = grass.y - candidate.y;
            if (Math.sqrt(gx * gx + gy * gy) < Math.max(grass.width, candidate.width) * 1.5) return false;
          }
          return true;
        }
        relayoutActiveGrass() {
          const activeGrass = this.grassPool.items.filter((grass) => grass.inUse && grass.active).sort((a, b) => a.spawnSeq - b.spawnSeq || a.poolIndex - b.poolIndex);
          const placed = [];
          const positionIsLegal = (grass, x, y) => {
            const legal = this.grassPlacementBounds(grass);
            if (x < legal.xMin || x > legal.xMax || y < legal.yMin || y > legal.yMax) return false;
            if (Math.hypot(x - this.player.x, y - this.player.y) < this.player.width) return false;
            return placed.every((other) => Math.hypot(x - other.x, y - other.y) >= Math.max(grass.width, other.width) * 1.5);
          };
          for (const grass of activeGrass) {
            const mappedX = grass.x;
            const mappedY = grass.y;
            if (!positionIsLegal(grass, mappedX, mappedY)) {
              const legal = this.grassPlacementBounds(grass);
              const columns = 25;
              const rows = 15;
              const candidates = [];
              for (let row = 0; row < rows; row += 1) {
                for (let column = 0; column < columns; column += 1) {
                  const x = legal.xMin + (legal.xMax - legal.xMin) * column / (columns - 1);
                  const y = legal.yMin + (legal.yMax - legal.yMin) * row / (rows - 1);
                  candidates.push({ x, y, order: row * columns + column, distance: (x - mappedX) ** 2 + (y - mappedY) ** 2 });
                }
              }
              candidates.sort((a, b) => a.distance - b.distance || a.order - b.order);
              const replacement = candidates.find((candidate) => positionIsLegal(grass, candidate.x, candidate.y));
              if (replacement) {
                grass.x = replacement.x;
                grass.y = replacement.y;
              }
            }
            placed.push(grass);
          }
        }
        consumeFish(fish) {
          const growth = growthForFish(fish.level);
          this.stats.comboCount = this.stats.comboTimer > 0 || this.comboEligibleThisFrame ? this.stats.comboCount + 1 : 1;
          this.stats.comboTimer = GAME_CONFIG.score.comboWindow;
          this.stats.highestCombo = Math.max(this.stats.highestCombo, this.stats.comboCount);
          const multiplier = Math.min(GAME_CONFIG.score.comboMax, 1 + GAME_CONFIG.score.comboStep * (this.stats.comboCount - 1));
          const points = Math.round(growth * 100 * multiplier);
          this.player.xp += growth;
          this.stats.score += points;
          this.stats.fishEaten += 1;
          const event = {
            id: fish.spawnSeq,
            fishLevel: fish.level,
            points,
            growth,
            combo: this.stats.comboCount,
            multiplier,
            x: fish.x,
            y: fish.y,
            width: fish.width,
            height: fish.height,
            direction: fish.direction,
            visualId: fish.visualId
          };
          this.releaseFish(fish);
          if (this.tutorial.enabled && !this.tutorial.ateFish) {
            this.tutorial.ateFish = true;
            this.tutorial.enabled = false;
            this.saveManager.setTutorialCompleted(true);
          }
          this.emit("fish_eaten", event);
        }
        consumeGrass(grass) {
          this.player.xp += 1;
          this.stats.score += 10;
          this.stats.grassEaten += 1;
          grass.active = false;
          grass.respawnRemaining = this.gameplayRng.range(GAME_CONFIG.grass.respawnMin, GAME_CONFIG.grass.respawnMax);
          grass.growRemaining = 0;
          if (this.tutorial.enabled) this.tutorial.ateGrass = true;
          this.emit("grass_eaten", { id: grass.spawnSeq, points: 10, growth: 1, x: grass.x, y: grass.y });
        }
        applyLevelUp() {
          const previous = this.player.level;
          const need = upgradeNeed(previous);
          if (this.player.xp < need || previous >= 10) return false;
          this.player.xp -= need;
          this.player.level += 1;
          this.levelUpRemaining = GAME_CONFIG.timing.levelUpVisual;
          this.invincibleRemaining = GAME_CONFIG.timing.invincible;
          this.pPlus2Protection = GAME_CONFIG.spawn.levelUpPPlus2Protection;
          this.updatePlayerDimensions();
          this.clampPlayerToBounds();
          this.enforceGrassPopulationCap();
          this.emit("level_up", { previous, level: this.player.level, overflowXp: this.player.xp, runTimeMs: Math.round(this.runClock * 1e3) });
          if (this.player.level >= 10) this.lockWin();
          return true;
        }
        lockDeath(fish) {
          if (this.resultLocked) return;
          this.resultLocked = true;
          this.screenState = "DEAD";
          this.cinematicClock = 0;
          this.input.clear(true);
          this.player.vx = 0;
          this.player.vy = 0;
          this.result = this.makeResult(false, fish.level);
          this.emit("player_dead", { fishId: fish.spawnSeq, fishLevel: fish.level, level: this.player.level, score: this.stats.score });
        }
        lockWin() {
          if (this.resultLocked) return;
          this.resultLocked = true;
          this.screenState = "WIN";
          this.cinematicClock = 0;
          this.input.clear(true);
          this.result = this.makeResult(true, null);
          this.emit("game_win", { score: this.stats.score, durationMs: this.result.durationMs, highestCombo: this.stats.highestCombo });
        }
        makeResult(won, killerLevel) {
          return { won, killerLevel, score: this.stats.score, level: this.player.level, fishEaten: this.stats.fishEaten, grassEaten: this.stats.grassEaten, highestCombo: this.stats.highestCombo, durationMs: this.runClock * 1e3, saved: null };
        }
        enterResult() {
          if (!this.resultLocked || this.resultCommitted) return;
          this.resultCommitted = true;
          this.screenState = "RESULT";
          this.result.saved = this.saveManager.commitResult(this.result);
          this.emit("game_result", { ...this.result });
        }
        pause(reason = "user") {
          if (this.screenState !== "RUNNING") return false;
          this.pausedFrom = "RUNNING";
          this.screenState = "PAUSED";
          this.input.clear(true);
          this.player.vx = 0;
          this.player.vy = 0;
          this.emit("game_paused", { reason });
          return true;
        }
        resume() {
          if (this.screenState !== "PAUSED" || this.orientationBlocked) return false;
          this.screenState = "RUNNING";
          this.pausedFrom = null;
          this.input.clear(true);
          this.emit("game_resumed", {});
          return true;
        }
        quitRun() {
          if (!["RUNNING", "PAUSED"].includes(this.screenState)) return false;
          this.releaseAllEntities();
          this.screenState = "HOME";
          this.resultLocked = false;
          this.resultCommitted = false;
          this.result = null;
          this.input.clear(true);
          this.emit("game_quit", { runId: this.runId });
          return true;
        }
        handleAction(action) {
          this.emit("ui_action", { action });
          if (action === "start" && this.screenState === "HOME") this.startRun();
          else if (action === "pause" && this.screenState === "RUNNING") this.pause("user");
          else if (action === "resume" && this.screenState === "PAUSED") this.resume();
          else if (action === "quit" && this.screenState === "PAUSED") this.quitRun();
          else if (action === "retry" && this.screenState === "RESULT") this.startRun();
          else if (action === "home" && this.screenState === "RESULT") {
            this.releaseAllEntities();
            this.screenState = "HOME";
            this.result = null;
            this.resultLocked = false;
            this.resultCommitted = false;
          } else if (action === "sound") {
            const enabled = !this.saveManager.data.soundEnabled;
            this.saveManager.setSoundEnabled(enabled);
            this.emit("setting_changed", { key: "soundEnabled", value: enabled });
          } else if (action === "haptic") {
            const enabled = !this.saveManager.data.hapticEnabled;
            this.saveManager.setHapticEnabled(enabled);
            this.emit("setting_changed", { key: "hapticEnabled", value: enabled });
          }
        }
        handlePointer(type, pointer) {
          return this.input.handle(type, pointer, this.layout, this.screenState);
        }
        onHide() {
          this.hidden = true;
          if (this.screenState === "RUNNING") this.pause("background");
          else if (this.screenState === "PAUSED") this.input.clear(true);
        }
        onShow() {
          this.hidden = false;
          if (this.screenState === "DEAD" || this.screenState === "WIN") this.enterResult();
        }
        resize(viewport) {
          const old = this.layout;
          const next = computeLayout(viewport);
          const normalizedPoint = (entity) => {
            const nx = (entity.x - old.playable.left) / Math.max(1, old.playable.right - old.playable.left);
            const ny = (entity.y - old.playable.top) / Math.max(1, old.playable.bottom - old.playable.top);
            return { nx, ny };
          };
          const mapPoint = (entity) => {
            const { nx, ny } = normalizedPoint(entity);
            entity.x = next.playable.left + clamp(nx, 0, 1) * (next.playable.right - next.playable.left);
            entity.y = next.playable.top + clamp(ny, 0, 1) * (next.playable.bottom - next.playable.top);
            if ("baseY" in entity) entity.baseY = entity.y;
          };
          mapPoint(this.player);
          for (const fish of this.fishPool.items) {
            if (!fish.inUse) continue;
            const { ny } = normalizedPoint(fish);
            const oldWidth = Math.max(1, fish.width);
            fish.width = Math.min(next.width * GAME_CONFIG.player.maxWidthRatio, next.width * GAME_CONFIG.player.baseWidthRatio * playerSizeScale(fish.level));
            fish.height = fish.width * GAME_CONFIG.player.bodyAspect;
            fish.vx *= fish.width / oldWidth;
            const mappedY = next.playable.top + clamp(ny, 0, 1) * (next.playable.bottom - next.playable.top);
            const visual = fishVisualMargins(fish);
            fish.y = clamp(mappedY, next.playable.top + visual.top, next.playable.bottom - visual.bottom);
            fish.baseY = fish.y;
            if (fish.pending || fish.entering) {
              fish.x = fish.side === "left" ? next.playable.left - visual.right - GAME_CONFIG.fish.offscreenPadding : next.playable.right + visual.left + GAME_CONFIG.fish.offscreenPadding;
            } else {
              const { nx } = normalizedPoint(fish);
              const mappedX = next.playable.left + clamp(nx, 0, 1) * (next.playable.right - next.playable.left);
              fish.x = clamp(mappedX, next.playable.left + visual.left, next.playable.right - visual.right);
            }
          }
          for (const grass of this.grassPool.items) {
            if (!grass.inUse) continue;
            mapPoint(grass);
            const legal = this.grassPlacementBounds(grass, next);
            grass.x = clamp(grass.x, legal.xMin, legal.xMax);
            grass.y = clamp(grass.y, legal.yMin, legal.yMax);
          }
          this.layout = next;
          this.orientationBlocked = !next.isLandscape;
          this.updatePlayerDimensions();
          this.clampPlayerToBounds();
          this.relayoutActiveGrass();
          const resizedPlayerBody = this.playerBody();
          for (const fish of this.fishPool.items) {
            if (fish.inUse && fish.active && relationFor(this.player.level, fish.level) === "LETHAL" && ellipsesOverlap(resizedPlayerBody, fishBody(fish))) fish.dangerSuppressed = true;
          }
          if (this.screenState === "RUNNING") this.pause(this.orientationBlocked ? "orientation" : "resize");
          this.emit("viewport_changed", { width: next.width, height: next.height, landscape: next.isLandscape });
        }
        isDangerSpawnSafe(candidate, activationCheck) {
          const horizonTicks = Math.ceil(GAME_CONFIG.fish.safeContactTime * GAME_CONFIG.tickRate);
          const dt = 1 / GAME_CONFIG.tickRate;
          const currentPath = this.simulateSafetyPath(candidate, this.player.vx, this.player.vy, horizonTicks, dt);
          if (!currentPath) return false;
          const maxSpeed = this.layout.width * GAME_CONFIG.player.baseSpeedRatio * playerSpeedScale(this.player.level);
          for (let index = 0; index < 8; index += 1) {
            const angle = index / 8 * Math.PI * 2;
            if (this.simulateSafetyPath(candidate, Math.cos(angle) * maxSpeed, Math.sin(angle) * maxSpeed, horizonTicks, dt, true)) return true;
          }
          if (activationCheck) this.emit("danger_activation_rejected", { id: candidate.spawnSeq });
          return false;
        }
        simulateSafetyPath(candidate, playerVx, playerVy, ticks, dt, requireClearance = false) {
          const bounds = this.layout.playable;
          let px = this.player.x;
          let py = this.player.y;
          const hazards = this.fishPool.items.filter((fish) => fish.inUse && fish !== candidate && relationFor(this.player.level, fish.level) === "LETHAL");
          if (ellipsesOverlap(this.playerBody(), this.predictedFishBody(candidate, 0))) return false;
          for (let step = 1; step <= ticks; step += 1) {
            px = clamp(px + playerVx * dt, bounds.left + this.player.width * 0.35, bounds.right - this.player.width * 0.35);
            py = clamp(py + playerVy * dt, bounds.top + this.player.height * 0.35, bounds.bottom - this.player.height * 0.35);
            const playerBody = { x: px, y: py, rx: this.player.width * 0.35, ry: this.player.height * 0.35 };
            const elapsed = dt * step;
            if (ellipsesOverlap(playerBody, this.predictedFishBody(candidate, elapsed))) return false;
            for (const hazard of hazards) {
              const wait = hazard.pending ? Math.max(0, hazard.warningRemaining) : 0;
              const moveTime = Math.max(0, elapsed - wait);
              if (ellipsesOverlap(playerBody, this.predictedFishBody(hazard, moveTime))) return false;
            }
          }
          if (requireClearance) {
            const clearance = this.player.width * 0.25;
            if (px - this.player.width * 0.35 < bounds.left + clearance || px + this.player.width * 0.35 > bounds.right - clearance) return false;
            if (py - this.player.height * 0.35 < bounds.top + clearance || py + this.player.height * 0.35 > bounds.bottom - clearance) return false;
          }
          return true;
        }
        predictedFishBody(fish, moveTime) {
          const bounds = this.layout.playable;
          const period = Number.isFinite(fish.period) && fish.period > 0 ? fish.period : 2;
          const age = Math.max(0, fish.age + moveTime);
          const baseY = Number.isFinite(fish.baseY) ? fish.baseY : fish.y;
          const amplitude = Number.isFinite(fish.amplitude) ? fish.amplitude : 0;
          const phase = Number.isFinite(fish.phase) ? fish.phase : 0;
          const y = moveTime <= 0 ? fish.y : clamp(baseY + Math.sin(phase + age * Math.PI * 2 / period) * amplitude, bounds.top + fish.height * 0.5, bounds.bottom - fish.height * 0.5);
          return { x: fish.x + fish.vx * moveTime, y, rx: fish.width * 0.35, ry: fish.height * 0.35 };
        }
        enforceGrassPopulationCap() {
          const maxGrass = this.player.level === 1 ? GAME_CONFIG.grass.maxAtLevelOne : GAME_CONFIG.grass.maxAfterLevelOne;
          const inUse = this.grassPool.items.filter((grass) => grass.inUse);
          if (inUse.length <= maxGrass) return;
          const byRetirementPriority = inUse.slice().sort((a, b) => {
            if (a.active !== b.active) return a.active ? 1 : -1;
            const distanceA = (a.x - this.player.x) ** 2 + (a.y - this.player.y) ** 2;
            const distanceB = (b.x - this.player.x) ** 2 + (b.y - this.player.y) ** 2;
            if (distanceA !== distanceB) return distanceB - distanceA;
            return b.spawnSeq - a.spawnSeq;
          });
          const retireCount = inUse.length - maxGrass;
          for (let index = 0; index < retireCount; index += 1) {
            const grass = byRetirementPriority[index];
            const data = { id: grass.spawnSeq, active: grass.active, level: this.player.level };
            this.grassPool.release(grass, resetGrass);
            this.emit("grass_retired", data);
          }
        }
        emit(type, data = {}) {
          const event = { type, tick: this.tick, runTime: this.runClock, data };
          this.events.push(event);
          this.eventLog.push(event);
          if (this.eventLog.length > 2048) this.eventLog.shift();
        }
        drainEvents() {
          const events = this.events;
          this.events = [];
          return events;
        }
        releaseAllEntities() {
          this.fishPool.releaseAll(resetFish);
          this.grassPool.releaseAll(resetGrass);
        }
        snapshot() {
          return {
            version: GAME_CONFIG.version,
            screenState: this.screenState,
            orientationBlocked: this.orientationBlocked,
            layout: this.layout,
            tick: this.tick,
            seed: this.masterSeed,
            runClock: this.runClock,
            cinematicClock: this.cinematicClock,
            player: this.player,
            stats: this.stats,
            tutorial: this.tutorial,
            levelUpRemaining: this.levelUpRemaining,
            invincibleRemaining: this.invincibleRemaining,
            pPlus2Protection: this.pPlus2Protection,
            fish: this.fishPool.items,
            grass: this.grassPool.items,
            spawnCounts: this.spawnManager.counts(),
            lastSpawnDecision: this.spawnManager.lastDecision,
            save: this.saveManager.data,
            result: this.result,
            resultLocked: this.resultLocked,
            resultCommitted: this.resultCommitted,
            input: this.input.snapshot(),
            debug: this.debug
          };
        }
      };
      module.exports = { GameCore };
    }
  });

  // src/render/canvas-renderer.js
  var require_canvas_renderer = __commonJS({
    "src/render/canvas-renderer.js"(exports, module) {
      "use strict";
      var { GAME_CONFIG, upgradeNeed, playerSizeScale } = require_game_config();
      var { clamp, relationFor } = require_math();
      var { fishBody, grassBody } = require_entities();
      var { uiRects } = require_layout();
      var COLORS = {
        ink: "#eaffff",
        muted: "#9bd5df",
        panel: "rgba(3,27,46,.86)",
        panelLine: "rgba(145,229,238,.34)",
        edible: "#55e68a",
        equal: "#ffd35a",
        lethal: "#ff6174",
        accent: "#59e4ef"
      };
      var CanvasRenderer = class {
        constructor(canvas) {
          this.canvas = canvas;
          this.ctx = canvas.getContext("2d");
          this.effects = [];
          this.elapsed = 0;
          this.playerPulse = 0;
          this.scorePulse = 0;
          this.playerLevelTransition = null;
          this.lastLayoutKey = "";
        }
        resize(layout) {
          const key = `${layout.width}x${layout.height}@${layout.dpr}`;
          if (key === this.lastLayoutKey) return;
          this.lastLayoutKey = key;
          this.canvas.width = Math.round(layout.width * layout.dpr);
          this.canvas.height = Math.round(layout.height * layout.dpr);
        }
        consumeEvents(events, snapshot) {
          var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
          for (const event of events) {
            const data = event.data || {};
            if (event.type === "game_start" || event.type === "game_quit") {
              this.resetRunEffects();
            } else if (event.type === "fish_eaten" || event.type === "grass_eaten") {
              this.addEffect({ kind: "score", x: (_a2 = data.x) != null ? _a2 : snapshot.player.x, y: (_b = data.y) != null ? _b : snapshot.player.y, text: `+${data.points}`, color: event.type === "fish_eaten" ? "#fff1a8" : "#9fffd2", age: 0, life: 0.6 });
              for (let index = 0; index < 7; index += 1) this.addEffect({ kind: "bubble", x: (_c = data.x) != null ? _c : snapshot.player.x, y: (_d = data.y) != null ? _d : snapshot.player.y, dx: (index - 3) * 12, age: 0, life: 0.65 + index * 0.03 });
              this.playerPulse = 0.16;
              this.scorePulse = 0.15;
              if (event.type === "fish_eaten") {
                this.addEffect({
                  kind: "suction",
                  x: (_e = data.x) != null ? _e : snapshot.player.x,
                  y: (_f = data.y) != null ? _f : snapshot.player.y,
                  width: (_g = data.width) != null ? _g : snapshot.player.width * 0.7,
                  height: (_h = data.height) != null ? _h : snapshot.player.height * 0.7,
                  direction: data.direction || 1,
                  visualId: data.visualId || 0,
                  age: 0,
                  life: 0.28
                });
                const combo = Math.max(1, Math.floor(Number(data.combo) || 1));
                if (combo >= 3) {
                  const trailCount = Math.min(12, combo * 2);
                  for (let index = 0; index < trailCount; index += 1) {
                    const angle = index / trailCount * Math.PI * 2;
                    this.addEffect({
                      kind: "comboTrail",
                      x: (_i = data.x) != null ? _i : snapshot.player.x,
                      y: (_j = data.y) != null ? _j : snapshot.player.y,
                      dx: Math.cos(angle) * (22 + index % 3 * 8),
                      dy: Math.sin(angle) * (18 + index % 2 * 7),
                      color: index % 2 ? "#ffe879" : "#8cfff1",
                      age: 0,
                      life: 0.45 + index % 3 * 0.04
                    });
                  }
                }
              }
            } else if (event.type === "level_up") {
              for (let index = 0; index < 18; index += 1) this.addEffect({ kind: "spark", x: snapshot.player.x, y: snapshot.player.y, angle: index / 18 * Math.PI * 2, age: 0, life: 0.8 });
              this.addEffect({ kind: "upgradeRing", x: snapshot.player.x, y: snapshot.player.y, age: 0, life: 0.8 });
              this.addEffect({ kind: "levelText", text: `\u5347\u7EA7\uFF01Lv.${(_k = data.level) != null ? _k : snapshot.player.level}`, age: 0, life: 0.8 });
              const previousLevel = Math.max(1, Math.floor(Number(data.previous) || Math.max(1, snapshot.player.level - 1)));
              const previousWidth = Math.min(
                snapshot.layout.width * GAME_CONFIG.player.maxWidthRatio,
                snapshot.layout.width * GAME_CONFIG.player.baseWidthRatio * playerSizeScale(previousLevel)
              );
              this.playerLevelTransition = {
                fromWidth: previousWidth,
                toWidth: snapshot.player.width,
                toLevel: (_l = data.level) != null ? _l : snapshot.player.level,
                life: GAME_CONFIG.timing.levelUpVisual
              };
            } else if (event.type === "equal_bounce") {
              this.addEffect({ kind: "ring", x: snapshot.player.x, y: snapshot.player.y, age: 0, life: 0.35 });
            } else if (event.type === "game_win") {
              const colors = ["#ffe879", "#8cfff1", "#ff9fca", "#a7ff8a"];
              for (let index = 0; index < 24; index += 1) {
                this.addEffect({
                  kind: "celebration",
                  x: snapshot.layout.width * ((index + 0.5) / 24),
                  y: snapshot.layout.height * (0.08 + index % 4 * 0.035),
                  dx: (index % 7 - 3) * 8,
                  dy: snapshot.layout.height * (0.22 + index % 5 * 0.025),
                  angle: index % 6 * 0.45,
                  spin: (index % 2 ? -1 : 1) * (4 + index % 3),
                  color: colors[index % colors.length],
                  age: 0,
                  life: GAME_CONFIG.timing.win
                });
              }
            }
          }
        }
        resetRunEffects() {
          this.effects.length = 0;
          this.playerPulse = 0;
          this.scorePulse = 0;
          this.playerLevelTransition = null;
        }
        addEffect(effect) {
          if (this.effects.length >= GAME_CONFIG.pools.effects) this.effects.shift();
          this.effects.push(effect);
        }
        update(dt) {
          this.elapsed += dt;
          this.playerPulse = Math.max(0, this.playerPulse - dt);
          this.scorePulse = Math.max(0, this.scorePulse - dt);
          for (const effect of this.effects) effect.age += dt;
          this.effects = this.effects.filter((effect) => effect.age < effect.life);
        }
        render(snapshot) {
          const { ctx } = this;
          const layout = snapshot.layout;
          this.resize(layout);
          ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
          ctx.clearRect(0, 0, layout.width, layout.height);
          this.drawOcean(layout);
          if (snapshot.screenState === "HOME") this.drawHome(snapshot);
          else if (snapshot.screenState === "RESULT") this.drawResult(snapshot);
          else {
            ctx.save();
            if (snapshot.screenState === "DEAD" && snapshot.cinematicClock < GAME_CONFIG.timing.deadSlowMotion) {
              const strength = (1 - snapshot.cinematicClock / GAME_CONFIG.timing.deadSlowMotion) * Math.max(2, layout.width * 6e-3);
              ctx.translate(Math.sin(this.elapsed * 57) * strength, Math.cos(this.elapsed * 43) * strength * 0.55);
            }
            this.drawRun(snapshot);
            ctx.restore();
          }
          if (snapshot.orientationBlocked) this.drawOrientationBlock(snapshot);
          if (snapshot.debug.enabled) this.drawDebug(snapshot);
        }
        drawOcean(layout) {
          const { ctx } = this;
          const gradient = ctx.createLinearGradient(0, 0, 0, layout.height);
          gradient.addColorStop(0, "#087c9b");
          gradient.addColorStop(0.45, "#07516f");
          gradient.addColorStop(1, "#03263f");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, layout.width, layout.height);
          ctx.save();
          ctx.globalAlpha = 0.13;
          ctx.fillStyle = "#b9ffff";
          for (let ray = 0; ray < 6; ray += 1) {
            const x = layout.width * (0.02 + ray * 0.19);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + layout.width * 0.16, 0);
            ctx.lineTo(x + layout.width * 0.28, layout.height);
            ctx.lineTo(x + layout.width * 0.18, layout.height);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 0.2;
          ctx.strokeStyle = "#9effff";
          ctx.lineWidth = 1.5;
          for (let index = 0; index < 18; index += 1) {
            const x = (index * 97 + this.elapsed * (9 + index % 4)) % (layout.width + 30) - 15;
            const y = layout.height - (index * 61 + this.elapsed * (18 + index % 5)) % (layout.height * 0.82);
            ctx.beginPath();
            ctx.arc(x, y, 2 + index % 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          ctx.fillStyle = "#03213a";
          ctx.beginPath();
          ctx.moveTo(0, layout.height);
          for (let x = 0; x <= layout.width; x += 40) ctx.lineTo(x, layout.height - 12 - Math.sin(x * 0.03) * 6);
          ctx.lineTo(layout.width, layout.height);
          ctx.fill();
        }
        drawHome(snapshot) {
          const { ctx } = this;
          const { width, height } = snapshot.layout;
          ctx.textAlign = "center";
          ctx.fillStyle = "#dfffff";
          ctx.font = `800 ${Math.max(34, height * 0.105)}px sans-serif`;
          ctx.fillText("\u5927\u9C7C\u5403\u5C0F\u9C7C", width * 0.5, height * 0.24);
          ctx.fillStyle = "#a5eef4";
          ctx.font = `600 ${Math.max(14, height * 0.035)}px sans-serif`;
          ctx.fillText("\u5403\u6C34\u8349\u8D77\u6B65 \xB7 \u5403\u5C0F\u9C7C\u6210\u957F \xB7 \u8EB2\u907F\u5927\u9C7C", width * 0.5, height * 0.31);
          this.drawFishShape({ x: width * 0.5, y: height * 0.42, width: width * 0.13, height: width * 0.067, direction: 1, visualId: 4, level: 6, player: true }, snapshot);
          const save = snapshot.save;
          ctx.font = `500 ${Math.max(13, height * 0.03)}px sans-serif`;
          ctx.fillStyle = "#b8e6ea";
          const fastest = save.fastestWinMs === null ? "--" : this.formatTime(save.fastestWinMs);
          ctx.fillText(`\u6700\u9AD8\u5206 ${save.highestScore}   \xB7   \u6700\u9AD8 Lv.${save.highestLevel}   \xB7   \u6700\u5FEB ${fastest}`, width * 0.5, height * 0.51);
          const rects = uiRects(snapshot.layout, "HOME");
          this.drawButton(rects.start, "\u5F00\u59CB\u6E38\u620F", true);
          this.drawSettingButtons(snapshot, rects);
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(215,249,251,.65)";
          ctx.font = `400 ${Math.max(11, height * 0.023)}px sans-serif`;
          ctx.fillText(`V${snapshot.version} \xB7 \u539F\u521B\u7A0B\u5E8F\u5316 Canvas \u7F8E\u672F`, width * 0.5, height * 0.94);
        }
        drawRun(snapshot) {
          const { ctx } = this;
          for (const grass of snapshot.grass) if (grass.inUse && grass.active) this.drawGrass(grass);
          for (const fish of snapshot.fish) if (fish.inUse && fish.active) this.drawFishShape(fish, snapshot);
          for (const fish of snapshot.fish) if (fish.inUse && fish.pending) this.drawWarning(fish, snapshot.layout);
          this.drawTutorialTarget(snapshot);
          this.drawPlayer(snapshot);
          this.drawEffects(snapshot);
          this.drawHud(snapshot);
          if (snapshot.screenState === "RUNNING") this.drawTutorial(snapshot);
          if (snapshot.screenState === "PAUSED") this.drawPause(snapshot);
          if (snapshot.screenState === "DEAD") this.drawCinematicLabel(snapshot, "\u88AB\u5927\u9C7C\u5403\u6389\u4E86", "#ff9aa7");
          if (snapshot.screenState === "WIN") this.drawCinematicLabel(snapshot, "\u79F0\u9738\u6D77\u57DF\uFF01", "#ffe879");
        }
        drawGrass(grass) {
          const { ctx } = this;
          const grow = clamp(1 - grass.growRemaining / GAME_CONFIG.grass.growTime, 0.05, 1);
          const sway = Math.sin(this.elapsed * 2 + grass.swayPhase) * grass.width * 0.14;
          const visualId = ((Number(grass.visualId) || 0) % 3 + 3) % 3;
          ctx.save();
          ctx.translate(grass.x, grass.y);
          ctx.scale(grow, grow);
          ctx.lineCap = "round";
          if (visualId === 0) {
            for (let blade = -2; blade <= 2; blade += 1) {
              const offset = blade * grass.width * 0.15;
              ctx.strokeStyle = blade % 2 ? "#35c993" : "#62e0a7";
              ctx.lineWidth = Math.max(2, grass.width * 0.09);
              ctx.beginPath();
              ctx.moveTo(offset, grass.height * 0.35);
              ctx.bezierCurveTo(offset - sway * 0.3, 0, offset + sway, -grass.height * (0.48 + Math.abs(blade) * 0.04), offset + sway * 0.6, -grass.height * 0.67);
              ctx.stroke();
            }
          } else if (visualId === 1) {
            for (let frond = -1; frond <= 1; frond += 1) {
              const offset = frond * grass.width * 0.2;
              const tipX = offset + sway * (0.45 + frond * 0.08);
              const tipY = -grass.height * (0.54 + Math.abs(frond) * 0.08);
              ctx.strokeStyle = frond === 0 ? "#86e38b" : "#3dbb78";
              ctx.lineWidth = Math.max(2.5, grass.width * 0.11);
              ctx.beginPath();
              ctx.moveTo(offset, grass.height * 0.35);
              ctx.quadraticCurveTo(offset - sway * 0.4, -grass.height * 0.12, tipX, tipY);
              ctx.stroke();
              ctx.fillStyle = frond === 0 ? "#a2ef9c" : "#59ce86";
              ctx.beginPath();
              ctx.ellipse(tipX - grass.width * 0.08, tipY + grass.height * 0.08, grass.width * 0.16, grass.height * 0.08, -0.55, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            for (let fan = 0; fan < 4; fan += 1) {
              const direction = fan < 2 ? -1 : 1;
              const spread = (fan % 2 + 1) * grass.width * 0.18 * direction;
              ctx.fillStyle = fan % 2 ? "#45c6a8" : "#76e0bd";
              ctx.beginPath();
              ctx.moveTo(direction * grass.width * 0.05, grass.height * 0.33);
              ctx.quadraticCurveTo(spread + sway * 0.2, -grass.height * 0.08, spread + sway * 0.45, -grass.height * (0.43 + fan * 0.045));
              ctx.quadraticCurveTo(spread * 0.4, -grass.height * 0.2, direction * grass.width * 0.05, grass.height * 0.33);
              ctx.fill();
            }
          }
          ctx.fillStyle = "#125a54";
          ctx.beginPath();
          ctx.ellipse(0, grass.height * 0.34, grass.width * 0.48, grass.height * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        drawPlayer(snapshot) {
          const { ctx } = this;
          const player = snapshot.player;
          const deadFlip = snapshot.screenState === "DEAD" ? Math.min(1, snapshot.cinematicClock / 0.4) * Math.PI : 0;
          const pulse = this.playerPulse > 0 ? 1 + Math.sin(this.playerPulse / 0.16 * Math.PI) * 0.08 : 1;
          let levelScale = 1;
          const transitionActive = this.playerLevelTransition && this.playerLevelTransition.toWidth > 0 && this.playerLevelTransition.toLevel === player.level;
          if (transitionActive && (snapshot.levelUpRemaining > 0 || snapshot.screenState === "WIN")) {
            const progress = snapshot.screenState === "WIN" ? clamp(snapshot.cinematicClock / this.playerLevelTransition.life, 0, 1) : clamp(1 - snapshot.levelUpRemaining / this.playerLevelTransition.life, 0, 1);
            const startScale = this.playerLevelTransition.fromWidth / this.playerLevelTransition.toWidth;
            if (progress < 0.65) {
              const phase = progress / 0.65;
              const eased = phase * phase * (3 - 2 * phase);
              levelScale = startScale + (1.05 - startScale) * eased;
            } else {
              const phase = (progress - 0.65) / 0.35;
              const eased = phase * phase * (3 - 2 * phase);
              levelScale = 1.05 + (1 - 1.05) * eased;
            }
          }
          const nominalSpeed = Math.max(1, snapshot.layout.width * GAME_CONFIG.player.baseSpeedRatio);
          const swimRatio = snapshot.screenState === "DEAD" ? 0 : clamp(Math.hypot(player.vx, player.vy) / nominalSpeed, 0, 1);
          const swimKick = swimRatio > 0.02 ? swimRatio * (0.035 + Math.sin(this.elapsed * 12) * 0.025) : Math.sin(this.elapsed * 2.4) * 8e-3;
          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.rotate(deadFlip);
          ctx.scale(pulse * levelScale * (1 + swimKick), pulse * levelScale * (1 - swimKick * 0.35));
          if (snapshot.invincibleRemaining > 0) {
            ctx.globalAlpha = 0.5 + Math.sin(this.elapsed * 20) * 0.25;
            ctx.strokeStyle = "#bfffff";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(0, 0, player.width * 0.48, player.height * 0.65, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          this.drawFishShape({ ...player, direction: player.facing, visualId: 4, player: true }, snapshot, true);
          ctx.restore();
        }
        drawFishShape(fish, snapshot, alreadyTranslated = false) {
          const { ctx } = this;
          const direction = fish.direction || 1;
          const palette = [
            ["#69dbe5", "#257aa1"],
            ["#f7b86b", "#d35c68"],
            ["#b995ef", "#5b57a6"],
            ["#7fd58e", "#258f74"],
            ["#ffe379", "#17a9b2"]
          ][fish.visualId % 5];
          ctx.save();
          if (!alreadyTranslated) ctx.translate(fish.x, fish.y);
          ctx.scale(direction, 1);
          const w = fish.width;
          const h = fish.height;
          ctx.fillStyle = palette[1];
          ctx.beginPath();
          ctx.moveTo(-w * 0.36, 0);
          ctx.quadraticCurveTo(-w * 0.65, -h * 0.48, -w * 0.56, 0);
          ctx.quadraticCurveTo(-w * 0.65, h * 0.48, -w * 0.36, 0);
          ctx.fill();
          const gradient = ctx.createLinearGradient(-w * 0.35, -h * 0.4, w * 0.42, h * 0.32);
          gradient.addColorStop(0, palette[0]);
          gradient.addColorStop(1, palette[1]);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.ellipse(0, 0, w * 0.42, h * 0.48, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.28)";
          if (fish.visualId % 5 === 0) {
            for (let stripe = -1; stripe <= 1; stripe += 1) ctx.fillRect(-w * 0.12 + stripe * w * 0.1, -h * 0.35, w * 0.035, h * 0.7);
          } else if (fish.visualId % 5 === 1) {
            ctx.beginPath();
            ctx.arc(-w * 0.06, -h * 0.05, h * 0.1, 0, Math.PI * 2);
            ctx.arc(w * 0.08, h * 0.12, h * 0.08, 0, Math.PI * 2);
            ctx.fill();
          } else if (fish.visualId % 5 === 2) {
            ctx.beginPath();
            ctx.moveTo(-w * 0.12, 0);
            ctx.lineTo(0, -h * 0.3);
            ctx.lineTo(w * 0.12, 0);
            ctx.lineTo(0, h * 0.3);
            ctx.closePath();
            ctx.fill();
          } else if (fish.visualId % 5 === 3) {
            ctx.beginPath();
            ctx.ellipse(-w * 0.03, 0, w * 0.18, h * 0.12, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(-w * 0.18, -h * 0.28);
            ctx.quadraticCurveTo(0, h * 0.15, w * 0.18, -h * 0.28);
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255,255,255,.35)";
            ctx.stroke();
          }
          ctx.fillStyle = "rgba(255,255,255,.3)";
          ctx.beginPath();
          ctx.moveTo(-w * 0.08, h * 0.22);
          ctx.quadraticCurveTo(0, h * 0.55, w * 0.14, h * 0.18);
          ctx.fill();
          ctx.fillStyle = "#f8ffff";
          ctx.beginPath();
          ctx.arc(w * 0.26, -h * 0.1, Math.max(2.5, h * 0.09), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#082737";
          ctx.beginPath();
          ctx.arc(w * 0.28, -h * 0.1, Math.max(1.3, h * 0.045), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(2,31,48,.75)";
          ctx.lineWidth = Math.max(1.5, h * 0.035);
          ctx.beginPath();
          ctx.arc(w * 0.34, h * 0.07, w * 0.08, 0.18, 1.3);
          ctx.stroke();
          ctx.restore();
          if (!fish.player && (snapshot == null ? void 0 : snapshot.player)) this.drawRelationBadge(fish, snapshot);
        }
        drawRelationBadge(fish, snapshot) {
          const { ctx } = this;
          const relation = relationFor(snapshot.player.level, fish.level);
          const color = relation === "EDIBLE" ? COLORS.edible : relation === "EQUAL" ? COLORS.equal : COLORS.lethal;
          const glyph = relation === "EDIBLE" ? "\u2713" : relation === "EQUAL" ? "=" : "!";
          const label = relation === "EDIBLE" ? "\u53EF\u5403" : relation === "EQUAL" ? "\u540C\u7EA7" : "\u5371\u9669";
          const y = fish.y - fish.height * 0.72;
          const width = Math.max(76, snapshot.layout.height * 0.18);
          const height = Math.max(20, snapshot.layout.height * 0.047);
          ctx.save();
          ctx.fillStyle = "rgba(2,22,35,.82)";
          this.roundedRect(fish.x - width / 2, y - height / 2, width, height, height / 2);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `800 ${Math.max(12, height * 0.62)}px sans-serif`;
          ctx.fillText(`${glyph} ${label} Lv.${fish.level}`, fish.x, y + 0.5);
          ctx.restore();
        }
        drawWarning(fish, layout) {
          const { ctx } = this;
          const x = fish.side === "left" ? layout.playable.left + 16 : layout.playable.right - 16;
          const pulse = 0.75 + Math.sin(this.elapsed * 18) * 0.25;
          ctx.save();
          ctx.translate(x, fish.y);
          ctx.scale(fish.side === "left" ? 1 : -1, 1);
          ctx.globalAlpha = pulse;
          ctx.fillStyle = COLORS.lethal;
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(-10, -14);
          ctx.lineTo(-10, 14);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#ffd2d8";
          ctx.lineWidth = 2;
          for (let ring = 0; ring < 2; ring += 1) {
            ctx.beginPath();
            ctx.arc(-3, 0, 20 + ring * 9, -0.8, 0.8);
            ctx.stroke();
          }
          ctx.restore();
        }
        drawEffects(snapshot) {
          const { ctx } = this;
          for (const effect of this.effects) {
            const progress = effect.age / effect.life;
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            if (effect.kind === "score") {
              ctx.fillStyle = effect.color;
              ctx.textAlign = "center";
              ctx.font = `800 ${Math.max(16, snapshot.layout.height * 0.04)}px sans-serif`;
              ctx.fillText(effect.text, effect.x, effect.y - progress * 42);
            } else if (effect.kind === "bubble") {
              ctx.strokeStyle = "#c9ffff";
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(effect.x + effect.dx * progress, effect.y - progress * 48, 2 + progress * 5, 0, Math.PI * 2);
              ctx.stroke();
            } else if (effect.kind === "comboTrail") {
              const eased = 1 - Math.pow(1 - progress, 2);
              ctx.fillStyle = effect.color;
              ctx.beginPath();
              ctx.arc(effect.x + effect.dx * eased, effect.y + effect.dy * eased - progress * 20, Math.max(1, 4 * (1 - progress)), 0, Math.PI * 2);
              ctx.fill();
            } else if (effect.kind === "spark") {
              ctx.strokeStyle = "#fff29b";
              ctx.lineWidth = 3;
              const distance = progress * snapshot.player.width;
              ctx.beginPath();
              ctx.moveTo(effect.x + Math.cos(effect.angle) * distance * 0.5, effect.y + Math.sin(effect.angle) * distance * 0.5);
              ctx.lineTo(effect.x + Math.cos(effect.angle) * distance, effect.y + Math.sin(effect.angle) * distance);
              ctx.stroke();
            } else if (effect.kind === "upgradeRing") {
              ctx.strokeStyle = "#fff29b";
              ctx.lineWidth = Math.max(2, snapshot.player.width * 0.045 * (1 - progress * 0.6));
              ctx.beginPath();
              ctx.arc(effect.x, effect.y, snapshot.player.width * (0.42 + progress * 0.9), 0, Math.PI * 2);
              ctx.stroke();
            } else if (effect.kind === "ring") {
              ctx.strokeStyle = "#d8ffff";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(effect.x, effect.y, 10 + progress * snapshot.player.width * 0.6, 0, Math.PI * 2);
              ctx.stroke();
            } else if (effect.kind === "levelText") {
              const lift = Math.sin(Math.min(1, progress) * Math.PI) * snapshot.layout.height * 0.025;
              ctx.fillStyle = "#fff29b";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.font = `900 ${Math.max(28, snapshot.layout.height * 0.075)}px sans-serif`;
              ctx.fillText(effect.text, snapshot.layout.width * 0.5, snapshot.layout.height * 0.42 - lift);
            } else if (effect.kind === "suction") {
              const eased = 1 - Math.pow(1 - progress, 2);
              const x = effect.x + (snapshot.player.x - effect.x) * eased;
              const y = effect.y + (snapshot.player.y - effect.y) * eased;
              const scale = Math.max(0.04, 1 - eased);
              ctx.translate(x, y);
              ctx.scale(scale, scale);
              this.drawFishShape({ x: 0, y: 0, width: effect.width, height: effect.height, direction: effect.direction, visualId: effect.visualId, player: true }, snapshot, true);
            } else if (effect.kind === "celebration") {
              const fall = progress * progress;
              ctx.fillStyle = effect.color;
              ctx.translate(effect.x + effect.dx * progress, effect.y + effect.dy * fall);
              ctx.rotate(effect.angle + effect.spin * progress);
              const size = Math.max(3, snapshot.layout.height * 0.014);
              ctx.fillRect(-size * 0.55, -size * 0.22, size * 1.1, size * 0.44);
            }
            ctx.restore();
          }
        }
        drawHud(snapshot) {
          const { ctx } = this;
          const { layout, player, stats } = snapshot;
          ctx.fillStyle = "rgba(2,25,42,.72)";
          ctx.fillRect(0, 0, layout.width, layout.hudHeight);
          ctx.fillStyle = COLORS.ink;
          ctx.textBaseline = "middle";
          ctx.font = `700 ${Math.max(13, layout.height * 0.032)}px sans-serif`;
          ctx.textAlign = "left";
          const scoreX = layout.playable.left + 14;
          const scoreY = layout.hudHeight * 0.5;
          const scoreScale = this.scorePulse > 0 ? 1 + 0.18 * (this.scorePulse / 0.15) : 1;
          ctx.save();
          ctx.translate(scoreX, scoreY);
          ctx.scale(scoreScale, scoreScale);
          ctx.fillText(`\u5206\u6570 ${stats.score}`, 0, 0);
          ctx.restore();
          const centerX = layout.width * 0.5;
          const need = upgradeNeed(player.level);
          const barW = Math.min(layout.width * 0.27, 260);
          const barH = Math.max(8, layout.height * 0.021);
          ctx.textAlign = "center";
          ctx.fillText(`Lv.${player.level}`, centerX - barW * 0.63, layout.hudHeight * 0.5);
          ctx.fillStyle = "rgba(255,255,255,.16)";
          this.roundedRect(centerX - barW * 0.4, layout.hudHeight * 0.5 - barH / 2, barW, barH, barH / 2);
          ctx.fill();
          const ratio = player.level >= 10 ? 1 : clamp(player.xp / need, 0, 1);
          ctx.fillStyle = "#64e5e6";
          this.roundedRect(centerX - barW * 0.4, layout.hudHeight * 0.5 - barH / 2, barW * ratio, barH, barH / 2);
          ctx.fill();
          ctx.fillStyle = COLORS.ink;
          ctx.font = `700 ${Math.max(10, layout.height * 0.022)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(player.level >= 10 ? "MAX" : `${player.xp} / ${need}`, centerX + barW * 0.1, layout.hudHeight * 0.5);
          if (stats.comboCount >= 2 && stats.comboTimer > 0) {
            ctx.fillStyle = "#ffe984";
            ctx.font = `800 ${Math.max(14, layout.height * 0.034)}px sans-serif`;
            ctx.fillText(`${stats.comboCount} \u8FDE\u5403  \xD7${Math.min(2, 1 + (stats.comboCount - 1) * 0.1).toFixed(1)}`, centerX, layout.hudHeight + 22);
          }
          const pause = uiRects(layout, "RUNNING").pause;
          this.drawIconButton(pause, "\u2161", true);
        }
        drawTutorial(snapshot) {
          if (!snapshot.tutorial.enabled) return;
          const { ctx } = this;
          const leadVisible = snapshot.tutorial.elapsed <= GAME_CONFIG.timing.tutorialLead;
          let text = "";
          if (leadVisible && !snapshot.tutorial.ateGrass) text = "\u4EFB\u610F\u4F4D\u7F6E\u62D6\u52A8\u5C0F\u9C7C \xB7 \u5148\u5403\u6C34\u8349\u6210\u957F";
          else if (snapshot.player.level >= 2 && !snapshot.tutorial.ateFish) text = "\u5403\u7EFF\u8272 \u2713 \u7684\u4F4E\u7B49\u7EA7\u9C7C\uFF0C\u907F\u5F00\u7EA2\u8272 ! \u5927\u9C7C";
          if (!text) return;
          const width = Math.min(snapshot.layout.width * 0.7, 560);
          const x = (snapshot.layout.width - width) / 2;
          const y = snapshot.layout.height * 0.82;
          ctx.fillStyle = "rgba(2,24,40,.8)";
          this.roundedRect(x, y, width, 38, 19);
          ctx.fill();
          ctx.fillStyle = "#e9ffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `600 ${Math.max(13, snapshot.layout.height * 0.03)}px sans-serif`;
          ctx.fillText(text, snapshot.layout.width / 2, y + 19);
        }
        drawTutorialTarget(snapshot) {
          if (!snapshot.tutorial.enabled || snapshot.tutorial.ateFish || snapshot.player.level < 2 || snapshot.screenState !== "RUNNING") return;
          const fish = snapshot.fish.find((candidate) => candidate.inUse && candidate.active && candidate.level < snapshot.player.level);
          if (!fish) return;
          const { ctx } = this;
          const pulse = 1 + Math.sin(this.elapsed * 7) * 0.08;
          ctx.save();
          ctx.strokeStyle = "#a5ffba";
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.72 + Math.sin(this.elapsed * 7) * 0.18;
          ctx.beginPath();
          ctx.ellipse(fish.x, fish.y, fish.width * 0.58 * pulse, fish.height * 0.78 * pulse, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#d9ffe2";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.font = `800 ${Math.max(12, snapshot.layout.height * 0.027)}px sans-serif`;
          ctx.fillText("\u53EF\u5403", fish.x, fish.y - fish.height * 0.92);
          ctx.restore();
        }
        drawPause(snapshot) {
          const { ctx } = this;
          ctx.fillStyle = "rgba(1,16,29,.72)";
          ctx.fillRect(0, 0, snapshot.layout.width, snapshot.layout.height);
          ctx.fillStyle = COLORS.ink;
          ctx.textAlign = "center";
          ctx.font = `800 ${Math.max(30, snapshot.layout.height * 0.075)}px sans-serif`;
          ctx.fillText("\u5DF2\u6682\u505C", snapshot.layout.width / 2, snapshot.layout.height * 0.31);
          const rects = uiRects(snapshot.layout, "PAUSED");
          this.drawButton(rects.resume, "\u7EE7\u7EED\u6E38\u620F", true);
          this.drawButton(rects.quit, "\u9000\u51FA\u672C\u5C40", false);
        }
        drawCinematicLabel(snapshot, text, color) {
          const { ctx } = this;
          ctx.fillStyle = "rgba(1,16,29,.28)";
          ctx.fillRect(0, 0, snapshot.layout.width, snapshot.layout.height);
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.font = `900 ${Math.max(34, snapshot.layout.height * 0.1)}px sans-serif`;
          ctx.fillText(text, snapshot.layout.width / 2, snapshot.layout.height * 0.44);
        }
        drawResult(snapshot) {
          const { ctx } = this;
          const result = snapshot.result || { won: false, score: 0, level: 1, fishEaten: 0, grassEaten: 0, highestCombo: 0, durationMs: 0 };
          const width = Math.min(snapshot.layout.width * 0.72, 620);
          const height = snapshot.layout.height * 0.54;
          const x = (snapshot.layout.width - width) / 2;
          const y = snapshot.layout.height * 0.08;
          ctx.fillStyle = COLORS.panel;
          this.roundedRect(x, y, width, height, 24);
          ctx.fill();
          ctx.strokeStyle = COLORS.panelLine;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.textAlign = "center";
          ctx.fillStyle = result.won ? "#ffe879" : "#ff9fad";
          ctx.font = `900 ${Math.max(28, snapshot.layout.height * 0.075)}px sans-serif`;
          ctx.fillText(result.won ? "\u79F0\u9738\u6D77\u57DF" : `\u88AB Lv.${result.killerLevel || "?"} \u9C7C\u5403\u6389`, snapshot.layout.width / 2, y + height * 0.18);
          ctx.fillStyle = COLORS.ink;
          ctx.font = `800 ${Math.max(20, snapshot.layout.height * 0.052)}px sans-serif`;
          ctx.fillText(`\u603B\u5206 ${result.score}   \xB7   Lv.${result.level}`, snapshot.layout.width / 2, y + height * 0.36);
          ctx.fillStyle = COLORS.muted;
          ctx.font = `500 ${Math.max(13, snapshot.layout.height * 0.03)}px sans-serif`;
          ctx.fillText(`\u5403\u9C7C ${result.fishEaten}   \u6C34\u8349 ${result.grassEaten}   \u6700\u9AD8\u8FDE\u5403 ${result.highestCombo}`, snapshot.layout.width / 2, y + height * 0.52);
          ctx.fillText(`\u751F\u5B58\u65F6\u95F4 ${this.formatTime(result.durationMs)}`, snapshot.layout.width / 2, y + height * 0.65);
          if (result.saved === false) {
            ctx.fillStyle = "#ffbc8d";
            ctx.fillText("\u8BB0\u5F55\u672A\u4FDD\u5B58\uFF08\u4E0D\u5F71\u54CD\u672C\u5C40\u7ED3\u679C\uFF09", snapshot.layout.width / 2, y + height * 0.79);
          }
          const rects = uiRects(snapshot.layout, "RESULT");
          this.drawButton(rects.retry, "\u518D\u6765\u4E00\u5C40", true);
          this.drawButton(rects.home, "\u8FD4\u56DE\u9996\u9875", false);
          this.drawSettingButtons(snapshot, rects);
        }
        drawSettingButtons(snapshot, rects) {
          this.drawIconButton(rects.sound, snapshot.save.soundEnabled ? "\u266A" : "\xD7\u266A", snapshot.save.soundEnabled);
          this.drawIconButton(rects.haptic, snapshot.save.hapticEnabled ? "\u2248" : "\xD7\u2248", snapshot.save.hapticEnabled);
        }
        drawButton(rect, label, primary) {
          if (!rect) return;
          const { ctx } = this;
          ctx.fillStyle = primary ? "#43d4d7" : "rgba(8,49,70,.88)";
          this.roundedRect(rect.x, rect.y, rect.width, rect.height, rect.height * 0.42);
          ctx.fill();
          ctx.strokeStyle = primary ? "#bfffff" : "rgba(169,230,235,.45)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = primary ? "#032838" : "#dcf9fa";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `800 ${Math.max(15, rect.height * 0.38)}px sans-serif`;
          ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
        }
        drawIconButton(rect, label, enabled) {
          if (!rect) return;
          const { ctx } = this;
          ctx.fillStyle = enabled ? "rgba(88,222,224,.24)" : "rgba(5,31,48,.5)";
          this.roundedRect(rect.x, rect.y, rect.width, rect.height, 12);
          ctx.fill();
          ctx.strokeStyle = enabled ? "#89f3ef" : "#799ca3";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = enabled ? "#e8ffff" : "#9db7bb";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `800 ${Math.max(13, rect.height * 0.45)}px sans-serif`;
          ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
        }
        drawOrientationBlock(snapshot) {
          const { ctx } = this;
          ctx.fillStyle = "rgba(1,17,29,.94)";
          ctx.fillRect(0, 0, snapshot.layout.width, snapshot.layout.height);
          ctx.fillStyle = "#e9ffff";
          ctx.textAlign = "center";
          ctx.font = `800 ${Math.max(22, snapshot.layout.height * 0.06)}px sans-serif`;
          ctx.fillText("\u8BF7\u65CB\u8F6C\u8BBE\u5907\u81F3\u6A2A\u5C4F", snapshot.layout.width / 2, snapshot.layout.height * 0.46);
          ctx.fillStyle = COLORS.muted;
          ctx.font = `500 ${Math.max(13, snapshot.layout.height * 0.03)}px sans-serif`;
          ctx.fillText("\u56DE\u5230\u6A2A\u5C4F\u540E\u70B9\u51FB\u7EE7\u7EED", snapshot.layout.width / 2, snapshot.layout.height * 0.55);
        }
        drawDebug(snapshot) {
          const { ctx } = this;
          if (snapshot.debug.showCollision && snapshot.screenState !== "HOME" && snapshot.screenState !== "RESULT") {
            ctx.save();
            ctx.strokeStyle = "#f2ff7a";
            ctx.lineWidth = 1;
            const player = snapshot.player;
            ctx.beginPath();
            ctx.ellipse(player.x, player.y, player.width * 0.35, player.height * 0.35, 0, 0, Math.PI * 2);
            ctx.stroke();
            for (const fish of snapshot.fish) if (fish.inUse && fish.active) {
              const body = fishBody(fish);
              ctx.beginPath();
              ctx.ellipse(body.x, body.y, body.rx, body.ry, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            for (const grass of snapshot.grass) if (grass.inUse && grass.active) {
              const body = grassBody(grass);
              ctx.beginPath();
              ctx.ellipse(body.x, body.y, body.rx, body.ry, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
          }
          const lines = [
            `tick ${snapshot.tick}  seed ${snapshot.seed}`,
            `fish ${snapshot.spawnCounts.active}+${snapshot.spawnCounts.pending}  eat ${snapshot.spawnCounts.edibleActive}  danger ${snapshot.spawnCounts.lethalReserved}`,
            `pool F ${snapshot.spawnCounts.totalReserved}/${GAME_CONFIG.fish.capacity}  dropped ${snapshot.debug.droppedTicks}`,
            snapshot.lastSpawnDecision ? `spawn ${snapshot.lastSpawnDecision.result || "-"}` : "spawn -"
          ];
          ctx.fillStyle = "rgba(0,0,0,.68)";
          ctx.fillRect(snapshot.layout.width - 260, snapshot.layout.hudHeight + 8, 250, 76);
          ctx.fillStyle = "#baff95";
          ctx.font = "12px monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          lines.forEach((line, index) => ctx.fillText(line, snapshot.layout.width - 252, snapshot.layout.hudHeight + 14 + index * 15));
        }
        roundedRect(x, y, width, height, radius) {
          const { ctx } = this;
          const r = Math.max(0, Math.min(radius, width / 2, height / 2));
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + width - r, y);
          ctx.quadraticCurveTo(x + width, y, x + width, y + r);
          ctx.lineTo(x + width, y + height - r);
          ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
          ctx.lineTo(x + r, y + height);
          ctx.quadraticCurveTo(x, y + height, x, y + height - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
        }
        formatTime(ms) {
          const totalSeconds = Math.max(0, Math.floor(ms / 1e3));
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          return `${minutes}:${String(seconds).padStart(2, "0")}`;
        }
      };
      module.exports = { CanvasRenderer };
    }
  });

  // src/audio/audio-manager.js
  var require_audio_manager = __commonJS({
    "src/audio/audio-manager.js"(exports, module) {
      "use strict";
      var TONES = Object.freeze({
        grass_eaten: [440, 0.08, 0.025],
        fish_eaten: [620, 0.11, 0.035],
        equal_bounce: [180, 0.08, 0.025],
        danger_warning: [120, 0.16, 0.03],
        level_up: [880, 0.24, 0.04],
        dead: [90, 0.35, 0.05],
        win: [1040, 0.42, 0.045],
        click: [520, 0.05, 0.02]
      });
      var AudioManager = class {
        constructor(platform2, settings) {
          this.platform = platform2;
          this.settings = settings;
          this.context = null;
          this.unlocked = false;
          this.ambient = null;
          this.voices = [];
          this.maxVoices = 6;
        }
        unlock() {
          var _a2, _b;
          try {
            if (!this.context) this.context = this.platform.createAudioContext();
            this.unlocked = !!this.context;
            const operation = (_b = (_a2 = this.context) == null ? void 0 : _a2.resume) == null ? void 0 : _b.call(_a2);
            this.observeOperation(operation, () => {
              this.unlocked = false;
              this.stopAmbient();
              this.stopVoices();
            });
          } catch (e) {
            this.unlocked = false;
            this.stopAmbient();
            this.stopVoices();
          }
          return this.unlocked;
        }
        observeOperation(operation, onRejected = () => {
        }) {
          if (!operation || typeof operation.then !== "function") return;
          try {
            operation.then(void 0, () => {
              try {
                onRejected();
              } catch (e) {
              }
            });
          } catch (e) {
            try {
              onRejected();
            } catch (e2) {
            }
          }
        }
        play(name, combo = 1) {
          if (!this.settings.soundEnabled || !this.unlocked || !this.context || !TONES[name]) return false;
          const [baseFrequency, duration, volume] = TONES[name];
          try {
            const now = Number.isFinite(this.context.currentTime) ? this.context.currentTime : 0;
            this.pruneVoices(now);
            const priority = this.voicePriority(name);
            if (this.voices.length >= this.maxVoices) {
              let victim = null;
              for (const voice2 of this.voices) {
                if (voice2.priority >= priority) continue;
                if (!victim || voice2.priority < victim.priority || voice2.priority === victim.priority && voice2.startedAt < victim.startedAt) victim = voice2;
              }
              if (!victim) return false;
              this.stopVoice(victim);
            }
            const oscillator = this.context.createOscillator();
            const gain = this.context.createGain();
            const voice = { oscillator, gain, name, priority, startedAt: now, endAt: now + duration + 0.02 };
            oscillator.onended = () => {
              const index = this.voices.indexOf(voice);
              if (index >= 0) this.voices.splice(index, 1);
            };
            oscillator.type = name === "danger_warning" || name === "dead" ? "sawtooth" : "sine";
            oscillator.frequency.setValueAtTime(baseFrequency * Math.min(1.5, 1 + (combo - 1) * 0.04), now);
            gain.gain.setValueAtTime(1e-4, now);
            gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(1e-4, now + duration);
            oscillator.connect(gain);
            gain.connect(this.context.destination);
            oscillator.start(now);
            oscillator.stop(voice.endAt);
            this.voices.push(voice);
            return true;
          } catch (e) {
            return false;
          }
        }
        pruneVoices(now) {
          this.voices = this.voices.filter((voice) => voice.endAt > now);
        }
        voicePriority(name) {
          if (name === "dead" || name === "win") return 4;
          if (name === "level_up") return 3;
          if (name === "danger_warning") return 2;
          return 1;
        }
        stopVoice(voice) {
          const index = this.voices.indexOf(voice);
          if (index >= 0) this.voices.splice(index, 1);
          try {
            voice.oscillator.stop();
          } catch (e) {
          }
        }
        stopVoices() {
          for (const voice of this.voices.slice()) this.stopVoice(voice);
        }
        startAmbient() {
          if (!this.settings.soundEnabled || !this.unlocked || !this.context || this.ambient) return;
          try {
            const oscillator = this.context.createOscillator();
            const gain = this.context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = 56;
            gain.gain.value = 8e-3;
            oscillator.connect(gain);
            gain.connect(this.context.destination);
            oscillator.start();
            this.ambient = { oscillator, gain };
          } catch (e) {
            this.ambient = null;
          }
        }
        stopAmbient() {
          var _a2, _b;
          try {
            (_b = (_a2 = this.ambient) == null ? void 0 : _a2.oscillator) == null ? void 0 : _b.stop();
          } catch (e) {
          }
          this.ambient = null;
        }
        setEnabled(enabled) {
          if (!enabled) {
            this.stopAmbient();
            this.stopVoices();
          }
        }
        suspend() {
          var _a2, _b;
          try {
            this.observeOperation((_b = (_a2 = this.context) == null ? void 0 : _a2.suspend) == null ? void 0 : _b.call(_a2));
          } catch (e) {
          }
        }
        resumePaused() {
          var _a2, _b;
          try {
            this.observeOperation((_b = (_a2 = this.context) == null ? void 0 : _a2.resume) == null ? void 0 : _b.call(_a2), () => {
              this.unlocked = false;
              this.stopAmbient();
              this.stopVoices();
            });
          } catch (e) {
            this.unlocked = false;
            this.stopAmbient();
            this.stopVoices();
          }
        }
        haptic(kind) {
          if (this.settings.hapticEnabled) this.platform.vibrate(kind);
        }
      };
      module.exports = { AudioManager, TONES };
    }
  });

  // src/debug/test-harness.js
  var require_test_harness = __commonJS({
    "src/debug/test-harness.js"(exports, module) {
      "use strict";
      var { GAME_CONFIG } = require_game_config();
      function configHash() {
        const source = JSON.stringify(GAME_CONFIG);
        let hash = 2166136261 >>> 0;
        for (let index = 0; index < source.length; index += 1) {
          hash ^= source.charCodeAt(index);
          hash = Math.imul(hash, 16777619) >>> 0;
        }
        return hash.toString(16).padStart(8, "0");
      }
      var TestHarness = class {
        constructor(core, app2 = null) {
          this.core = core;
          this.app = app2;
        }
        startRun(seed = 20260731) {
          this.core.startRun(seed);
          return this.snapshot();
        }
        setSeed(seed) {
          this.core.setSeed(seed);
          return this.rng();
        }
        resetSeed() {
          this.core.setSeed(this.core.masterSeed);
          return this.rng();
        }
        rng() {
          return { seed: this.core.masterSeed, gameplay: this.core.gameplayRng.snapshot(), appearance: this.core.appearanceRng.snapshot(), fx: this.core.fxRng.snapshot() };
        }
        pauseClock() {
          if (this.app) this.app.manualClock = true;
        }
        resumeClock() {
          if (this.app) this.app.manualClock = false;
        }
        stepTicks(count = 1) {
          const events = [];
          for (let index = 0; index < count; index += 1) {
            if (this.app) events.push(...this.app.stepCore(1 / GAME_CONFIG.tickRate));
            else {
              this.core.update(1 / GAME_CONFIG.tickRate);
              events.push(...this.core.drainEvents());
            }
          }
          return events;
        }
        stepDt(seconds) {
          const ticks = Math.max(0, Math.round(seconds * GAME_CONFIG.tickRate));
          return this.stepTicks(ticks);
        }
        setPlayer(patch) {
          Object.assign(this.core.player, patch);
          this.core.player.level = Math.max(1, Math.min(10, Math.floor(this.core.player.level)));
          this.core.updatePlayerDimensions();
          this.core.clampPlayerToBounds();
          return { ...this.core.player };
        }
        setStats(patch) {
          Object.assign(this.core.stats, patch);
          return { ...this.core.stats };
        }
        setInvincible(seconds = GAME_CONFIG.timing.invincible) {
          this.core.invincibleRemaining = Math.max(0, Number(seconds) || 0);
          return this.core.invincibleRemaining;
        }
        setProtection(seconds = GAME_CONFIG.spawn.levelUpPPlus2Protection) {
          this.core.pPlus2Protection = Math.max(0, Number(seconds) || 0);
          return this.core.pPlus2Protection;
        }
        setTutorial(patch) {
          Object.assign(this.core.tutorial, patch);
          return { ...this.core.tutorial };
        }
        setState(state) {
          const allowed = ["HOME", "RUNNING", "PAUSED", "DEAD", "WIN", "RESULT"];
          if (!allowed.includes(state)) throw new Error(`Invalid state: ${state}`);
          this.core.screenState = state;
          return state;
        }
        spawnFish(options = {}) {
          var _a2, _b, _c, _d;
          const fish = this.core.acquireFish(options.level || 1, options.side || "left", options.randomize !== false);
          if (!fish) throw new Error("Fish pool exhausted");
          fish.x = (_a2 = options.x) != null ? _a2 : this.core.player.x;
          fish.y = (_b = options.y) != null ? _b : this.core.player.y;
          fish.baseY = fish.y;
          fish.vx = (_c = options.vx) != null ? _c : 0;
          fish.pending = !!options.pending;
          fish.active = fish.pending ? false : options.active !== false;
          fish.warningRemaining = (_d = options.warningRemaining) != null ? _d : fish.pending ? GAME_CONFIG.fish.warningTime : 0;
          fish.entering = !!options.entering;
          return fish;
        }
        spawnGrass(options = {}) {
          const grass = this.core.grassPool.acquire((item) => {
            var _a2, _b;
            item.active = true;
            item.x = (_a2 = options.x) != null ? _a2 : this.core.player.x;
            item.y = (_b = options.y) != null ? _b : this.core.player.y;
            item.width = options.width || 24;
            item.height = options.height || 42;
            item.growRemaining = options.mature === false ? GAME_CONFIG.grass.growTime : 0;
            item.respawnRemaining = 0;
          });
          if (!grass) throw new Error("Grass pool exhausted");
          grass.spawnSeq = ++this.core.spawnSeq;
          return grass;
        }
        injectCollisionSet(entries) {
          const events = entries.map((entry) => {
            if (entry.entity) return entry;
            const pool = entry.kind === "grass" ? this.core.grassPool.items : this.core.fishPool.items;
            const entity = pool.find((item) => item.inUse && (entry.id === void 0 || item.spawnSeq === entry.id));
            if (!entity) throw new Error(`Collision entity not found: ${JSON.stringify(entry)}`);
            return { type: entry.type, entity };
          });
          this.core.collisionSystem.inject(events);
        }
        counts() {
          return this.core.spawnManager.counts();
        }
        config() {
          return { version: GAME_CONFIG.version, hash: configHash(), values: JSON.parse(JSON.stringify(GAME_CONFIG)) };
        }
        spawnTrace() {
          return this.core.spawnManager.trace.slice();
        }
        poolStats() {
          return { fish: this.core.fishPool.stats(), grass: this.core.grassPool.stats() };
        }
        performance() {
          return this.app ? this.app.performanceSnapshot() : null;
        }
        freezeAI(value = true) {
          this.core.debug.freezeAI = !!value;
        }
        showCollision(value = true) {
          this.core.debug.showCollision = !!value;
          this.core.debug.enabled = true;
        }
        toggleDebug(value = !this.core.debug.enabled) {
          this.core.debug.enabled = !!value;
        }
        clearStorage() {
          return this.core.saveManager.clear();
        }
        exportStorage() {
          return this.core.saveManager.export();
        }
        importStorage(data) {
          return this.core.saveManager.import(data);
        }
        eventLog() {
          return this.core.eventLog.slice();
        }
        resultState() {
          return { locked: this.core.resultLocked, committed: this.core.resultCommitted, result: this.core.result ? { ...this.core.result } : null };
        }
        snapshot() {
          return this.core.snapshot();
        }
      };
      module.exports = { TestHarness, configHash };
    }
  });

  // src/app/game-app.js
  var require_game_app = __commonJS({
    "src/app/game-app.js"(exports, module) {
      "use strict";
      var { GAME_CONFIG } = require_game_config();
      var { GameCore } = require_game_core();
      var { CanvasRenderer } = require_canvas_renderer();
      var { AudioManager } = require_audio_manager();
      var GameApp2 = class {
        constructor(platform2, options = {}) {
          this.platform = platform2;
          this.canvas = platform2.createCanvas();
          this.core = new GameCore(platform2, { viewport: platform2.getViewport(), seed: options.seed });
          this.renderer = new CanvasRenderer(this.canvas);
          this.audio = new AudioManager(platform2, this.core.saveManager.data);
          this.harness = null;
          if (true) {
            const { TestHarness } = require_test_harness();
            this.harness = new TestHarness(this.core, this);
          }
          this.running = false;
          this.manualClock = false;
          this.frameId = null;
          this.lastTime = null;
          this.accumulator = 0;
          this.fixedDt = 1 / GAME_CONFIG.tickRate;
          this.unsubscribers = [];
          this.metrics = { frameIntervals: [], longFrames: 0, ticks: 0, startedAt: platform2.now() };
          this.loop = this.loop.bind(this);
        }
        start() {
          if (this.running) return this;
          this.running = true;
          this.unsubscribers.push(this.platform.onPointer((type, pointer) => {
            if (type === "start") this.audio.unlock();
            this.core.handlePointer(type, pointer);
          }));
          this.unsubscribers.push(this.platform.onHide(() => {
            this.core.onHide();
            this.audio.stopAmbient();
            this.audio.suspend();
            this.resetFrameClock();
          }));
          this.unsubscribers.push(this.platform.onShow(() => {
            this.core.onShow();
            this.resetFrameClock();
          }));
          this.unsubscribers.push(this.platform.onResize(() => this.core.resize(this.platform.getViewport())));
          this.renderer.render(this.core.snapshot());
          this.frameId = this.platform.requestFrame(this.loop);
          return this;
        }
        stop() {
          this.running = false;
          if (this.frameId !== null) this.platform.cancelFrame(this.frameId);
          for (const unsubscribe of this.unsubscribers) unsubscribe == null ? void 0 : unsubscribe();
          this.unsubscribers.length = 0;
          this.audio.stopAmbient();
          this.audio.stopVoices();
        }
        loop(time) {
          if (!this.running) return;
          const clockReset = this.lastTime === null;
          if (clockReset) this.lastTime = time;
          let frameDelta = clockReset ? 0 : Math.max(0, (time - this.lastTime) / 1e3);
          this.lastTime = time;
          if (this.core.hidden) {
            this.frameId = this.platform.requestFrame(this.loop);
            return;
          }
          if (!clockReset) this.recordFrame(frameDelta);
          frameDelta = Math.min(GAME_CONFIG.maxFrameDelta, frameDelta);
          if (!this.manualClock) {
            this.accumulator += frameDelta;
            let steps = 0;
            while (this.accumulator + 1e-9 >= this.fixedDt && steps < GAME_CONFIG.maxCatchUpTicks) {
              this.stepCore(this.fixedDt);
              this.accumulator -= this.fixedDt;
              steps += 1;
            }
            if (this.accumulator >= this.fixedDt) {
              const dropped = Math.floor(this.accumulator / this.fixedDt);
              this.core.debug.droppedTicks += dropped;
              this.accumulator %= this.fixedDt;
            }
          }
          if (this.core.screenState !== "PAUSED") this.renderer.update(frameDelta);
          this.renderer.render(this.core.snapshot());
          this.frameId = this.platform.requestFrame(this.loop);
        }
        stepCore(dt = this.fixedDt) {
          this.core.update(dt);
          this.metrics.ticks += 1;
          const snapshot = this.core.snapshot();
          const events = this.core.drainEvents();
          this.renderer.consumeEvents(events, snapshot);
          this.processEvents(events);
          return events;
        }
        processEvents(events) {
          for (const event of events) {
            const data = event.data || {};
            if (event.type === "game_start") {
              this.audio.stopVoices();
              this.audio.startAmbient();
            } else if (event.type === "game_quit") {
              this.audio.stopAmbient();
              this.audio.stopVoices();
            } else if (event.type === "game_paused" || event.type === "game_result") this.audio.stopAmbient();
            else if (event.type === "game_resumed") {
              this.audio.unlock();
              this.audio.startAmbient();
            } else if (event.type === "grass_eaten") this.audio.play("grass_eaten");
            else if (event.type === "fish_eaten") {
              this.audio.play("fish_eaten", data.combo);
              this.audio.haptic("light");
            } else if (event.type === "equal_bounce") this.audio.play("equal_bounce");
            else if (event.type === "danger_warning") this.audio.play("danger_warning");
            else if (event.type === "level_up") {
              this.audio.play("level_up");
              this.audio.haptic("medium");
            } else if (event.type === "player_dead") {
              this.audio.play("dead");
              this.audio.haptic("heavy");
              this.audio.stopAmbient();
            } else if (event.type === "game_win") {
              this.audio.play("win");
              this.audio.haptic("medium");
              this.audio.stopAmbient();
            } else if (event.type === "ui_action") this.audio.play("click");
            else if (event.type === "setting_changed") {
              this.audio.settings = this.core.saveManager.data;
              if (data.key === "soundEnabled") {
                this.audio.setEnabled(data.value);
                if (data.value && this.core.screenState === "RUNNING") {
                  this.audio.unlock();
                  this.audio.startAmbient();
                }
              }
            }
          }
        }
        recordFrame(delta) {
          if (this.core.hidden || this.core.screenState !== "RUNNING") return;
          const ms = delta * 1e3;
          this.metrics.frameIntervals.push(ms);
          const sampleCapacity = GAME_CONFIG.tickRate * 60;
          if (this.metrics.frameIntervals.length > sampleCapacity) this.metrics.frameIntervals.shift();
        }
        resetFrameClock() {
          this.lastTime = null;
          this.accumulator = 0;
        }
        performanceSnapshot() {
          const sorted = this.metrics.frameIntervals.slice().sort((a, b) => a - b);
          const average = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0;
          const p95Index = sorted.length ? Math.max(0, Math.ceil(sorted.length * 0.95) - 1) : 0;
          const p95 = sorted.length ? sorted[p95Index] : 0;
          const longFrames = sorted.reduce((count, value) => count + (value > 200 ? 1 : 0), 0);
          return { samples: sorted.length, averageFrameMs: average, averageFps: average > 0 ? 1e3 / average : 0, p95FrameMs: p95, longFrames, ticks: this.metrics.ticks };
        }
      };
      module.exports = { GameApp: GameApp2 };
    }
  });

  // src/entry/wechat.js
  var { WechatPlatform } = require_wechat_platform();
  var { GameApp } = require_game_app();
  if (typeof wx === "undefined") throw new Error("\u5FAE\u4FE1\u5C0F\u6E38\u620F wx API \u4E0D\u53EF\u7528");
  var _a;
  try {
    (_a = wx.setPreferredFramesPerSecond) == null ? void 0 : _a.call(wx, 60);
  } catch (e) {
  }
  var platform = new WechatPlatform(wx);
  var app = new GameApp(platform).start();
  var root = typeof GameGlobal !== "undefined" ? GameGlobal : globalThis;
  if (true) {
    root.growFishApp = app;
    root.__growFishDebug = app.harness;
  }
})();
//# sourceMappingURL=game.js.map
