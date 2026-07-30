import test from 'node:test'
import assert from 'node:assert/strict'
import { computeWorldStageSelectLayout } from '../assets/Scripts/Game/WorldStageSelectLayout.ts'

const viewports = [
  { name: '360x780', cssWidth: 360, cssHeight: 780, topInsetPx: 0, bottomInsetPx: 0, leftInsetPx: 0, rightInsetPx: 0, columns: 2 },
  { name: '390x844 safe', cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34, leftInsetPx: 0, rightInsetPx: 0, columns: 2 },
  { name: '430x932 safe', cssWidth: 430, cssHeight: 932, topInsetPx: 59, bottomInsetPx: 34, leftInsetPx: 0, rightInsetPx: 0, columns: 2 },
  { name: '844x390 landscape safe', cssWidth: 844, cssHeight: 390, topInsetPx: 0, bottomInsetPx: 21, leftInsetPx: 44, rightInsetPx: 44, columns: 3 },
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

function physical(value, layout) {
  return value * layout.physicalScale
}

test('world stage page maps to the full physical viewport and respects all safe-area edges', () => {
  for (const viewport of viewports) {
    const layout = computeWorldStageSelectLayout(viewport)
    const safe = edges(layout.safeRect)
    const header = edges(layout.header)
    const close = edges(layout.closeButton)
    const status = edges(layout.status)
    const rootLeft = -layout.width / 2
    const rootBottom = -layout.height / 2

    assert.equal(layout.columns, viewport.columns, viewport.name)
    assert.equal(layout.items.length, 10, viewport.name)
    assert.ok(Math.abs(physical(layout.width, layout) - viewport.cssWidth) < 0.001, `${viewport.name}: full physical width`)
    assert.ok(Math.abs(physical(layout.height, layout) - viewport.cssHeight) < 0.001, `${viewport.name}: full physical height`)
    assert.ok(physical(safe.left - rootLeft, layout) >= viewport.leftInsetPx - 0.001, `${viewport.name}: left inset`)
    assert.ok(physical(layout.width / 2 - safe.right, layout) >= viewport.rightInsetPx - 0.001, `${viewport.name}: right inset`)
    assert.ok(physical(layout.height / 2 - header.top, layout) >= viewport.topInsetPx - 0.001, `${viewport.name}: header top inset`)
    assert.ok(physical(layout.height / 2 - close.top, layout) >= viewport.topInsetPx - 0.001, `${viewport.name}: close top inset`)
    assert.ok(physical(status.bottom - rootBottom, layout) >= viewport.bottomInsetPx - 0.001, `${viewport.name}: bottom inset`)
    assert.ok(physical(layout.closeButton.width, layout) >= 44, `${viewport.name}: close physical width`)
    assert.ok(physical(layout.closeButton.height, layout) >= 44, `${viewport.name}: close physical height`)
    assert.ok(physical(layout.itemTitleWidth, layout) >= 86, `${viewport.name}: title text budget`)
    assert.ok(physical(layout.badgeWidth, layout) >= 44, `${viewport.name}: badge text budget`)
  }
})

test('world stage scroll content reaches every item without overlap or clipping', () => {
  for (const viewport of viewports) {
    const layout = computeWorldStageSelectLayout(viewport)
    const content = { left: -layout.content.width / 2, right: layout.content.width / 2, top: 0, bottom: -layout.content.height }

    assert.ok(layout.viewport.height > 0, `${viewport.name}: viewport height`)
    assert.ok(layout.content.height >= layout.viewport.height || layout.scrollRange === 0, `${viewport.name}: content/viewport`)
    assert.ok(Math.abs(layout.scrollRange - Math.max(0, layout.content.height - layout.viewport.height)) < 0.001, `${viewport.name}: scroll range`)
    assert.ok(physical(layout.itemHeight, layout) >= 64, `${viewport.name}: item physical height`)
    assert.ok(physical(layout.itemCornerRadius, layout) <= 8, `${viewport.name}: item corner radius`)

    for (const item of layout.items) {
      const itemEdges = edges(item)
      assert.ok(itemEdges.left >= content.left && itemEdges.right <= content.right, `${viewport.name}: item horizontal bounds`)
      assert.ok(itemEdges.bottom >= content.bottom && itemEdges.top <= content.top, `${viewport.name}: item vertical bounds`)
    }
    for (let first = 0; first < layout.items.length; first += 1) {
      for (let second = first + 1; second < layout.items.length; second += 1) {
        assert.equal(overlaps(layout.items[first], layout.items[second]), false, `${viewport.name}: items ${first + 1}/${second + 1}`)
      }
    }
  }

  const landscape = computeWorldStageSelectLayout(viewports[3])
  assert.ok(physical(landscape.scrollRange, landscape) > 0, 'landscape content must have a real scroll range')
})

test('world stage layout canonicalizes invalid metrics into a frozen usable page', () => {
  const layout = computeWorldStageSelectLayout({
    cssWidth: Number.NaN,
    cssHeight: -1,
    topInsetPx: Number.NaN,
    bottomInsetPx: -1,
    leftInsetPx: Infinity,
    rightInsetPx: -20,
  })
  assert.equal(layout.width, 750)
  assert.equal(layout.height, 1334)
  assert.equal(Object.isFrozen(layout), true)
  assert.equal(Object.isFrozen(layout.items), true)
})
