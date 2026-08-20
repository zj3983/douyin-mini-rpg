import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(
  TEST_DIR,
  '..',
  'assets',
  'Data',
  'vertical-slice-animation-sources.json',
);

const LEGACY_HAND_SEAL_ORDER = [0, 0, 1, 1, 7, 7, 7, 9, 9, 9];
const LEGACY_WOLF_DEATH_ORDER = [0, 1, 2, 3, 3, 3, 3, 3];
const PROTECTED_BASELINE_SHA256 =
  'be67508211bb100545829346825ad98d5d91201eb7180cdc6fb1fcf2402161df';

const EXPECTED_QINGLAN_ACTIONS = {
  idle: {
    frames: 8,
    fps: 6,
    loop: true,
    source: 'qinglan/idle',
    sourceMode: 'pose-video',
  },
  sword_ride: {
    frames: 10,
    fps: 8,
    loop: true,
    source: 'qinglan/sword_ride',
    sourceMode: 'pose-video',
  },
  hand_seal: {
    frames: 10,
    fps: 10,
    loop: false,
    source: 'qinglan/hand_seal',
    sourceMode: 'pose-video',
    events: [{ name: 'seal-formed', time: 0.6 }],
  },
  cast: {
    frames: 12,
    fps: 12,
    loop: false,
    source: 'qinglan/cast',
    sourceMode: 'layered-keyframes',
    order: [0, 0, 1, 1, 5, 5, 6, 6, 9, 9, 10, 11],
    quality: { maxScaleDrift: 0.17 },
    events: [{ name: 'sword-release', time: 0.42 }],
  },
  hurt: {
    frames: 6,
    fps: 10,
    loop: false,
    source: 'qinglan/hurt',
    sourceMode: 'pose-video',
  },
  death: {
    frames: 10,
    fps: 8,
    loop: false,
    source: 'qinglan/death',
    sourceMode: 'layered-keyframes',
  },
};

const EXPECTED_WOLF_ACTIONS = {
  idle: {
    frames: 6,
    fps: 6,
    loop: true,
    source: 'moss-wolf/idle',
    sourceMode: 'pose-video',
  },
  move: {
    frames: 8,
    fps: 10,
    loop: true,
    source: 'moss-wolf/move',
    sourceMode: 'pose-video',
  },
  telegraph: {
    frames: 4,
    fps: 8,
    loop: false,
    source: 'moss-wolf/telegraph',
    sourceMode: 'pose-video',
  },
  attack: {
    frames: 8,
    fps: 12,
    loop: false,
    source: 'moss-wolf/attack',
    sourceMode: 'pose-video',
    quality: { maxScaleDrift: 0.2 },
    events: [{ name: 'bite-contact', time: 0.55 }],
  },
  hurt: {
    frames: 4,
    fps: 10,
    loop: false,
    source: 'moss-wolf/hurt',
    sourceMode: 'pose-video',
    quality: { maxScaleDrift: 0.14 },
  },
  death: {
    frames: 8,
    fps: 8,
    loop: false,
    source: 'moss-wolf/death',
    sourceMode: 'pose-video',
    quality: { maxCenterDrift: 0.14, maxScaleDrift: 0.29 },
  },
};

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

function restoreLegacyAllowedFields(manifest) {
  const restored = clone(manifest);
  const qinglan = restored.actors['qinglan-sword-cultivator'].actions;
  const wolf = restored.actors['moss-wolf'].actions;

  qinglan.idle.sourceMode = 'layered-keyframes';
  qinglan.sword_ride.sourceMode = 'layered-keyframes';
  qinglan.hand_seal.sourceMode = 'layered-keyframes';
  qinglan.hand_seal.order = LEGACY_HAND_SEAL_ORDER;
  qinglan.hurt.sourceMode = 'layered-keyframes';

  delete wolf.attack.events;
  wolf.hurt.sourceMode = 'frame-sequence';
  delete wolf.hurt.quality;
  delete wolf.death.quality.maxScaleDrift;
  wolf.death.sourceMode = 'frame-sequence';
  wolf.death.order = LEGACY_WOLF_DEATH_ORDER;
  return restored;
}

function collectDiffPaths(before, after, prefix = '') {
  if (isDeepStrictEqual(before, after)) return [];
  if (
    before === null ||
    after === null ||
    typeof before !== 'object' ||
    typeof after !== 'object' ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    return [prefix];
  }

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) =>
    collectDiffPaths(before[key], after[key], prefix ? `${prefix}.${key}` : key),
  );
}

test('H3 runtime actions exactly match the approved source contract', () => {
  const manifest = readManifest();
  assert.deepEqual(
    manifest.actors['qinglan-sword-cultivator'].actions,
    EXPECTED_QINGLAN_ACTIONS,
  );
  assert.deepEqual(manifest.actors['moss-wolf'].actions, EXPECTED_WOLF_ACTIONS);
});

test('only the approved Qinglan and Moss Wolf action fields differ from baseline', () => {
  const manifest = readManifest();
  const baseline = restoreLegacyAllowedFields(manifest);

  assert.equal(
    sha256(baseline),
    PROTECTED_BASELINE_SHA256,
    'top-level settings, protected actors, and immutable action fields changed',
  );
  assert.deepEqual(collectDiffPaths(baseline, manifest), [
    'actors.moss-wolf.actions.attack.events',
    'actors.moss-wolf.actions.death.order',
    'actors.moss-wolf.actions.death.quality.maxScaleDrift',
    'actors.moss-wolf.actions.death.sourceMode',
    'actors.moss-wolf.actions.hurt.quality',
    'actors.moss-wolf.actions.hurt.sourceMode',
    'actors.qinglan-sword-cultivator.actions.hand_seal.order',
    'actors.qinglan-sword-cultivator.actions.hand_seal.sourceMode',
    'actors.qinglan-sword-cultivator.actions.hurt.sourceMode',
    'actors.qinglan-sword-cultivator.actions.idle.sourceMode',
    'actors.qinglan-sword-cultivator.actions.sword_ride.sourceMode',
  ]);
});

test('H3 chronological actions use natural order while cast keeps authored order', () => {
  const manifest = readManifest();
  const qinglan = manifest.actors['qinglan-sword-cultivator'].actions;
  const wolf = manifest.actors['moss-wolf'].actions;

  assert.equal(Object.hasOwn(qinglan.hand_seal, 'order'), false);
  assert.equal(Object.hasOwn(wolf.death, 'order'), false);
  assert.deepEqual(qinglan.cast.order, [0, 0, 1, 1, 5, 5, 6, 6, 9, 9, 10, 11]);
  assert.deepEqual(wolf.attack.events, [{ name: 'bite-contact', time: 0.55 }]);
});
