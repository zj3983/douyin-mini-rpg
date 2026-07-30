import test from 'node:test'
import assert from 'node:assert/strict'
import { computeBattleLayout } from '../assets/Scripts/Combat/BattleLayout.ts'
import { computeWorldStageSelectLayout } from '../assets/Scripts/Game/WorldStageSelectLayout.ts'

const viewports = [
  { name: '360x780', cssWidth: 360, cssHeight: 780 },
  { name: '390x844', cssWidth: 390, cssHeight: 844 },
  { name: '430x932', cssWidth: 430, cssHeight: 932 },
  { name: '844x390 landscape', cssWidth: 844, cssHeight: 390 },
]

function edges(rect) {
  return {
    left: rect.centerX - rect.width / 2,
    right: rect.centerX + rect.width / 2,
    bottom: rect.centerY - rect.height / 2,
    top: rect.centerY + rect.height / 2,
  }
}

function overlaps(a, b) {
  const first = edges(a)
  const second = edges(b)
  return first.left < second.right
    && first.right > second.left
    && first.bottom < second.top
    && first.top > second.bottom
}

test('world stage page uses a fixed two-column scan layout across supported viewports', () => {
  for (const viewport of viewports) {
    const battle = computeBattleLayout({ designWidth: 750, ...viewport, topInsetPx: 0, bottomInsetPx: 0 })
    const layout = computeWorldStageSelectLayout(750, battle.visibleHeight)

    assert.equal(layout.columns, 2, viewport.name)
    assert.equal(layout.items.length, 10, viewport.name)
    assert.equal(layout.items.every((item) => item.height === 132), true, viewport.name)
    assert.equal(layout.itemCornerRadius <= 8, true, viewport.name)
    assert.equal(layout.itemTitleWidth >= 190, true, viewport.name)
    assert.equal(layout.badgeWidth >= 76, true, viewport.name)

    const root = { centerX: 0, centerY: 0, width: layout.width, height: layout.height }
    for (const rect of [layout.header, layout.grid, layout.closeButton, layout.status, ...layout.items]) {
      const outer = edges(root)
      const inner = edges(rect)
      assert.ok(inner.left >= outer.left && inner.right <= outer.right, `${viewport.name}: horizontal bounds`)
      assert.ok(inner.bottom >= outer.bottom && inner.top <= outer.top, `${viewport.name}: vertical bounds`)
    }
    for (let first = 0; first < layout.items.length; first += 1) {
      for (let second = first + 1; second < layout.items.length; second += 1) {
        assert.equal(overlaps(layout.items[first], layout.items[second]), false, `${viewport.name}: items ${first + 1}/${second + 1}`)
      }
    }
    assert.equal(overlaps(layout.header, layout.grid), false, `${viewport.name}: header/grid`)
    assert.equal(overlaps(layout.grid, layout.status), false, `${viewport.name}: grid/status`)
  }
})

test('world stage layout canonicalizes invalid dimensions without escaping the page', () => {
  const layout = computeWorldStageSelectLayout(Number.NaN, -1)
  assert.equal(layout.width, 750)
  assert.equal(layout.height, 1334)
  assert.equal(Object.isFrozen(layout), true)
  assert.equal(Object.isFrozen(layout.items), true)
})
