import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

const passwordIterations = 120_000
const passwordKeyLength = 32
const passwordDigest = 'sha256'

export function createAuthService({ store, tokenTtlMs = 1000 * 60 * 60 * 24 * 7 }) {
  return {
    async register({ username, password }) {
      const clean = cleanUsername(username)
      validatePassword(password)
      const user = {
        id: randomId(),
        username: clean,
        usernameKey: usernameKey(clean),
        passwordHash: hashPassword(password),
        createdAt: Date.now(),
      }
      const created = await store.createUser(user)
      if (!created) throw authError(409, 'USER_EXISTS', '账号已存在。')
      return createSessionResult(store, created, tokenTtlMs)
    },

    async login({ username, password }) {
      const clean = cleanUsername(username)
      const user = await store.findUserByUsername(clean)
      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw authError(401, 'INVALID_CREDENTIALS', '账号或密码不正确。')
      }
      return createSessionResult(store, user, tokenTtlMs)
    },

    async getUserByToken(token) {
      const session = await requireSession(store, token)
      const user = await store.findUserById(session.userId)
      if (!user) throw authError(401, 'INVALID_SESSION', '登录已失效。')
      return publicUser(user)
    },

    async writeSave(token, data) {
      const session = await requireSession(store, token)
      await store.writeSave(session.userId, data)
      return { ok: true }
    },

    async readSave(token) {
      const session = await requireSession(store, token)
      return await store.readSave(session.userId)
    },
  }
}

function cleanUsername(username) {
  const clean = String(username ?? '').trim().replace(/\s+/g, ' ').slice(0, 18)
  if (!clean) throw authError(400, 'INVALID_USERNAME', '请输入账号名。')
  return clean
}

function validatePassword(password) {
  if (String(password ?? '').length < 4) {
    throw authError(400, 'INVALID_PASSWORD', '密码至少 4 位。')
  }
}

function usernameKey(username) {
  return username.trim().toLowerCase()
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = pbkdf2Sync(String(password), salt, passwordIterations, passwordKeyLength, passwordDigest).toString('hex')
  return `pbkdf2:${passwordIterations}:${salt}:${key}`
}

function verifyPassword(password, passwordHash) {
  const [kind, iterationsText, salt, expected] = String(passwordHash).split(':')
  if (kind !== 'pbkdf2' || !iterationsText || !salt || !expected) return false
  const actual = pbkdf2Sync(String(password), salt, Number(iterationsText), passwordKeyLength, passwordDigest)
  const expectedBuffer = Buffer.from(expected, 'hex')
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
}

async function createSessionResult(store, user, tokenTtlMs) {
  const token = randomId(32)
  await store.createSession({
    token,
    userId: user.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + tokenTtlMs,
  })
  return { user: publicUser(user), token }
}

async function requireSession(store, token) {
  if (!token) throw authError(401, 'NO_SESSION', '请先登录。')
  const session = await store.findSession(token)
  if (!session || session.expiresAt <= Date.now()) {
    if (session) await store.deleteSession(token)
    throw authError(401, 'INVALID_SESSION', '登录已失效。')
  }
  return session
}

function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt }
}

function randomId(bytes = 16) {
  return randomBytes(bytes).toString('hex')
}

function authError(status, code, message) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}
