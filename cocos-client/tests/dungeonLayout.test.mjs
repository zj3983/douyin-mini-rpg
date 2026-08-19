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
    for (const key of ['hud', 'mapButton', 'interaction', 'commandBar', 'settlement']) assertInside(layout[key], layout.safeRect, `${viewport.name}:${key}`)
    assert.ok(layout.settlement.height <= layout.safeRect.height * 0.7 + 0.001, `${viewport.name}: settlement height`)
    assert.ok(layout.mapButton.width * layout.physicalScale >= 44, `${viewport.name}: map width`)
    assert.ok(layout.mapButton.height * layout.physicalScale >= 44, `${viewport.name}: map height`)
    assert.ok(layout.interaction.height * layout.physicalScale >= 44, `${viewport.name}: interaction height`)
    assert.ok(layout.commandBar.height * layout.physicalScale >= 44, `${viewport.name}: command bar height`)
  }
})

test('landscape uses show-all scale and exposes the full physical viewport to dungeon UI', () => {
  const layout = computeDungeonLayout(viewports.at(-1))
  assert.ok(Math.abs(layout.physicalScale - 390 / 1334) < 0.000001)
  assert.ok(Math.abs(layout.width * layout.physicalScale - 844) < 0.001)
  assert.ok(Math.abs(layout.height * layout.physicalScale - 390) < 0.001)
  assert.ok(layout.width > 750)
  assert.ok(layout.fontSizes.hint * layout.physicalScale >= 12)
})

test('font sizes retain their design minimum and remain physically readable', () => {
  const fontContracts = viewports.map((viewport) => computeDungeonLayout(viewport))
  for (const layout of fontContracts) {
    assert.ok(layout.fontSizes.hud >= 24)
    assert.ok(layout.fontSizes.hint >= 26)
    assert.ok(layout.fontSizes.settlementTitle >= 34)
    assert.ok(layout.fontSizes.settlementBody >= 24)
    assert.ok(layout.fontSizes.hud * layout.physicalScale >= 12)
  }
})

test('invalid metrics produce a frozen usable layout', () => {
  const layout = computeDungeonLayout({ cssWidth: Number.NaN, cssHeight: -1, topInsetPx: Infinity, bottomInsetPx: -1, leftInsetPx: 0, rightInsetPx: 0 })
  assert.equal(Object.isFrozen(layout), true)
  assert.equal(layout.width, 750)
  assert.equal(layout.height, 1334)
})
