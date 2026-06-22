import test from 'node:test'
import assert from 'node:assert/strict'

import { setElementHtml, setElementStyle, setElementText } from '../src/domUpdate.ts'

test('setElementText skips unchanged text writes', () => {
  const element = { textContent: '炼气一重' }

  assert.equal(setElementText(element, '炼气一重'), false)
  assert.equal(element.textContent, '炼气一重')
  assert.equal(setElementText(element, '炼气二重'), true)
  assert.equal(element.textContent, '炼气二重')
})

test('setElementHtml skips unchanged html writes', () => {
  const element = { innerHTML: '自动<br>推进' }

  assert.equal(setElementHtml(element, '自动<br>推进'), false)
  assert.equal(setElementHtml(element, '手动<br>目标'), true)
  assert.equal(element.innerHTML, '手动<br>目标')
})

test('setElementStyle skips unchanged style property writes', () => {
  const element = {
    style: {
      width: '50%',
      setProperty(name, value) {
        this[name] = value
      },
    },
  }

  assert.equal(setElementStyle(element, 'width', '50%'), false)
  assert.equal(setElementStyle(element, 'width', '76%'), true)
  assert.equal(element.style.width, '76%')
})

test('setElementStyle compares css custom properties through getPropertyValue', () => {
  let writes = 0
  const element = {
    style: {
      value: '#67e8f9',
      getPropertyValue() {
        return this.value
      },
      setProperty(_name, value) {
        writes += 1
        this.value = value
      },
    },
  }

  assert.equal(setElementStyle(element, '--skill-color', '#67e8f9'), false)
  assert.equal(writes, 0)
  assert.equal(setElementStyle(element, '--skill-color', '#facc15'), true)
  assert.equal(writes, 1)
})
