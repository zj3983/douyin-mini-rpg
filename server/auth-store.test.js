import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { createFileAuthStore } from './auth-store.js'

test('file store persists users, sessions, and saves across reloads', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'douyin-auth-store-'))
  const file = join(dir, 'auth.json')
  try {
    const first = await createFileAuthStore(file)
    const user = {
      id: 'u1',
      username: '青岚',
      usernameKey: '青岚',
      passwordHash: 'hash',
      createdAt: 1,
    }
    await first.createUser(user)
    await first.createSession({ token: 'token-1', userId: 'u1', createdAt: 2, expiresAt: Date.now() + 60_000 })
    await first.writeSave('u1', { hero: { level: 8 }, tickets: 3 })
    await first.updateUserPassword('u1', 'new-hash')

    const second = await createFileAuthStore(file)

    assert.equal((await second.findUserByUsername('青岚')).id, 'u1')
    assert.equal((await second.findUserById('u1')).passwordHash, 'new-hash')
    assert.equal((await second.findSession('token-1')).userId, 'u1')
    assert.deepEqual(await second.readSave('u1'), { hero: { level: 8 }, tickets: 3 })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
