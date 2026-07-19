import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'

test('same seed produces the same sequence', () => {
  const a = createSeededRandom(42)
  const b = createSeededRandom(42)
  assert.deepEqual([a.next(), a.next(), a.next()], [b.next(), b.next(), b.next()])
})

test('range, int and pick stay inside their domains', () => {
  const random = createSeededRandom(7)
  for (let index = 0; index < 200; index += 1) {
    const value = random.range(-2, 3)
    assert.equal(value >= -2 && value < 3, true)
    const rolled = random.int(1, 4)
    assert.equal(Number.isInteger(rolled) && rolled >= 1 && rolled <= 4, true)
    assert.equal(['a', 'b'].includes(random.pick(['a', 'b'])), true)
  }
})
