import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthService } from './auth-service.js'
import { createMemoryAuthStore } from './auth-store.js'

function makeService() {
  const store = createMemoryAuthStore()
  const service = createAuthService({ store, tokenTtlMs: 60_000 })
  return { service, store }
}

test('register creates a user, hashes password, and returns a session token', async () => {
  const { service, store } = makeService()

  const result = await service.register({ username: '青岚', password: 'secret123' })

  assert.equal(result.user.username, '青岚')
  assert.equal(typeof result.user.id, 'string')
  assert.equal(typeof result.token, 'string')
  const record = await store.findUserByUsername('青岚')
  assert.ok(record)
  assert.notEqual(record.passwordHash, 'secret123')
  assert.equal(record.passwordHash.includes('secret123'), false)
})

test('register rejects duplicate usernames', async () => {
  const { service } = makeService()
  await service.register({ username: '青岚', password: 'secret123' })

  await assert.rejects(
    () => service.register({ username: '青岚', password: 'secret456' }),
    { status: 409, code: 'USER_EXISTS' },
  )
})

test('login returns a new token for a valid password', async () => {
  const { service } = makeService()
  await service.register({ username: '青岚', password: 'secret123' })

  const result = await service.login({ username: '青岚', password: 'secret123' })

  assert.equal(result.user.username, '青岚')
  assert.equal(typeof result.token, 'string')
})

test('login rejects an invalid password', async () => {
  const { service } = makeService()
  await service.register({ username: '青岚', password: 'secret123' })

  await assert.rejects(
    () => service.login({ username: '青岚', password: 'wrong-password' }),
    { status: 401, code: 'INVALID_CREDENTIALS' },
  )
})

test('getUserByToken returns the logged in user', async () => {
  const { service } = makeService()
  const session = await service.register({ username: '青岚', password: 'secret123' })

  const user = await service.getUserByToken(session.token)

  assert.equal(user.username, '青岚')
  assert.equal(user.id, session.user.id)
})

test('cloud save can be written and read per account', async () => {
  const { service } = makeService()
  const session = await service.register({ username: '青岚', password: 'secret123' })
  const save = { hero: { level: 12 }, tickets: 5, bag: [{ name: '凝露灵草', count: 2 }] }

  await service.writeSave(session.token, save)
  const loaded = await service.readSave(session.token)

  assert.deepEqual(loaded, save)
})
