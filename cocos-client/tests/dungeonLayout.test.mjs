import test from 'node:test'
import assert from 'node:assert/strict'
import { computeDungeonLayout } from '../assets/Scripts/Game/DungeonLayout.ts'

const viewports = [
  { name: 'design', cssWidth: 750, cssHeight: 1334, topInsetPx: 0, bottomInsetPx: 0, leftInsetPx: 0, rightInsetPx: 0 },
  { name: 'iphone', cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34, leftInsetPx: 0, rightInsetPx: 0 },
  { name: 'android', cssWidth: 412, cssHeight: 915, topInsetPx: 32, bottomInsetPx: 24, leftInsetPx: 0, rightInsetPx: 0 },
  { name: 'landscape', cssWidth: 844, cssHeight: 390, topInsetPx: 0, bottomInsetPx: 20, leftInsetPx: 0, rightInsetPx: 0 },
]

function edges(rect) {
  return { left: rect.centerX - rect.width / 2, right: rect.centerX + rect.width / 2, bottom: rect.centerY - rect.height / 2, top: rect.centerY + rect.height / 2 }
}

function assertInside(inner, outer, label) {
  const child = edges(inner)
  const parent = edges(outer)
  assert.ok(child.left >= parent.left - 0.001, `${label}: left`)
  assert.ok(child.right <= parent.right + 0.001, `${label}: right`)
  assert.ok(child.bottom >= parent.bottom - 0.001, `${label}: bottom`)
  assert.ok(child.top <= parent.top + 0.001, `${label}: top`)
}

test('dungeon regions stay inside the physical safe area on portrait and landscape screens', () => {
  for (const viewport of viewports) {
    const layout = computeDungeonLayout(viewport)
    for (const key of ['hud', 'mapButton', 'interaction', 'settlement']) assertInside(layout[key], layout.safeRect, `${viewport.name}:${key}`)
    assert.ok(layout.settlement.height <= layout.safeRect.height * 0.7 + 0.001, `${viewport.name}: settlement height`)
    assert.ok(layout.mapButton.width * layout.physicalScale >= 44, `${viewport.name}: map width`)
    assert.ok(layout.mapButton.height * layout.physicalScale >= 44, `${viewport.name}: map height`)
    assert.ok(layout.interaction.height * layout.physicalScale >= 44, `${viewport.name}: interaction height`)
  }
})

test('font sizes are fixed design values and do not scale from viewport width', () => {
  const fontContracts = viewports.map((viewport) => computeDungeonLayout(viewport).fontSizes)
  for (const contract of fontContracts.slice(1)) assert.deepEqual(contract, fontContracts[0])
  assert.deepEqual(fontContracts[0], { hud: 24, hint: 26, settlementTitle: 34, settlementBody: 24 })
})

test('invalid metrics produce a frozen usable layout', () => {
  const layout = computeDungeonLayout({ cssWidth: Number.NaN, cssHeight: -1, topInsetPx: Infinity, bottomInsetPx: -1, leftInsetPx: 0, rightInsetPx: 0 })
  assert.equal(Object.isFrozen(layout), true)
  assert.equal(layout.width, 750)
  assert.equal(layout.height, 1334)
})
