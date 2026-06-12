import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function createMemoryAuthStore(initial = {}) {
  const state = {
    users: new Map((initial.users ?? []).map((user) => [user.id, clone(user)])),
    usernameToId: new Map((initial.users ?? []).map((user) => [user.usernameKey, user.id])),
    sessions: new Map((initial.sessions ?? []).map((session) => [session.token, clone(session)])),
    saves: new Map((initial.saves ?? []).map((save) => [save.userId, clone(save.data)])),
  }

  return {
    async createUser(user) {
      if (state.usernameToId.has(user.usernameKey)) return null
      state.users.set(user.id, clone(user))
      state.usernameToId.set(user.usernameKey, user.id)
      return clone(user)
    },
    async findUserByUsername(username) {
      const id = state.usernameToId.get(username.trim().toLowerCase())
      return id ? clone(state.users.get(id)) : null
    },
    async findUserById(id) {
      return clone(state.users.get(id) ?? null)
    },
    async updateUserPassword(id, passwordHash) {
      const user = state.users.get(id)
      if (!user) return null
      user.passwordHash = passwordHash
      state.users.set(id, clone(user))
      return clone(user)
    },
    async createSession(session) {
      state.sessions.set(session.token, clone(session))
      return clone(session)
    },
    async findSession(token) {
      return clone(state.sessions.get(token) ?? null)
    },
    async deleteSession(token) {
      state.sessions.delete(token)
    },
    async writeSave(userId, data) {
      state.saves.set(userId, clone(data))
    },
    async readSave(userId) {
      return clone(state.saves.get(userId) ?? null)
    },
    snapshot() {
      return {
        users: [...state.users.values()].map(clone),
        sessions: [...state.sessions.values()].map(clone),
        saves: [...state.saves.entries()].map(([userId, data]) => ({ userId, data: clone(data) })),
      }
    },
  }
}

export async function createFileAuthStore(filePath) {
  const state = await readState(filePath)
  const memory = createMemoryAuthStore(state)

  async function persist() {
    await writeState(filePath, memory.snapshot())
  }

  return {
    ...memory,
    async createUser(user) {
      const created = await memory.createUser(user)
      if (!created) return null
      await persist()
      return created
    },
    async createSession(session) {
      const created = await memory.createSession(session)
      await persist()
      return created
    },
    async updateUserPassword(id, passwordHash) {
      const updated = await memory.updateUserPassword(id, passwordHash)
      if (!updated) return null
      await persist()
      return updated
    },
    async deleteSession(token) {
      await memory.deleteSession(token)
      await persist()
    },
    async writeSave(userId, data) {
      await memory.writeSave(userId, data)
      await persist()
    },
  }
}

async function readState(filePath) {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8'))
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      saves: Array.isArray(parsed.saves)
        ? parsed.saves.map((save) => ({ userId: save.userId, data: save.data }))
        : [],
    }
  } catch {
    return { users: [], sessions: [], saves: [] }
  }
}

async function writeState(filePath, state) {
  await mkdir(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(state, null, 2))
  await rename(tmp, filePath)
}
