import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiServer } from './api-server.js'
import { createAuthService } from './auth-service.js'
import { createMemoryAuthStore } from './auth-store.js'

async function withServer(fn) {
  const service = createAuthService({ store: createMemoryAuthStore(), tokenTtlMs: 60_000 })
  const server = createApiServer({ service })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    await fn(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  return {
    response,
    body: text ? JSON.parse(text) : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
  }
}

test('health endpoint returns ok', async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, '/api/health')

    assert.equal(response.status, 200)
    assert.deepEqual(body, { ok: true })
  })
})

test('register sets a session cookie and me returns the user', async () => {
  await withServer(async (baseUrl) => {
    const registered = await request(baseUrl, '/api/register', {
      method: 'POST',
      body: JSON.stringify({ username: '青岚', password: 'secret123' }),
    })

    assert.equal(registered.response.status, 201)
    assert.ok(registered.cookie.startsWith('vt_session='))

    const me = await request(baseUrl, '/api/me', {
      headers: { cookie: registered.cookie },
    })

    assert.equal(me.response.status, 200)
    assert.equal(me.body.user.username, '青岚')
  })
})

test('login rejects bad credentials with JSON error', async () => {
  await withServer(async (baseUrl) => {
    await request(baseUrl, '/api/register', {
      method: 'POST',
      body: JSON.stringify({ username: '青岚', password: 'secret123' }),
    })

    const failed = await request(baseUrl, '/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: '青岚', password: 'bad-password' }),
    })

    assert.equal(failed.response.status, 401)
    assert.equal(failed.body.error.code, 'INVALID_CREDENTIALS')
  })
})

test('save endpoints persist save data for the logged in user', async () => {
  await withServer(async (baseUrl) => {
    const registered = await request(baseUrl, '/api/register', {
      method: 'POST',
      body: JSON.stringify({ username: '青岚', password: 'secret123' }),
    })
    const save = { hero: { level: 20 }, tickets: 9 }

    const put = await request(baseUrl, '/api/save', {
      method: 'PUT',
      headers: { cookie: registered.cookie },
      body: JSON.stringify({ save }),
    })
    const get = await request(baseUrl, '/api/save', {
      headers: { cookie: registered.cookie },
    })

    assert.equal(put.response.status, 200)
    assert.deepEqual(get.body.save, save)
  })
})
