import { migratePlayerSave, type PlayerSaveV4 } from './PlayerSave.ts'

export interface SaveRepository {
  load(): PlayerSaveV4 | null
  save(value: PlayerSaveV4): void
}

export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function createMemorySaveRepository(initial?: unknown): SaveRepository {
  let stored = initial === undefined || initial === null ? null : migratePlayerSave(initial)

  return {
    load() {
      return stored === null ? null : migratePlayerSave(stored)
    },
    save(value) {
      stored = migratePlayerSave(value)
    },
  }
}

export function createJsonSaveRepository(storage: StoragePort, key: string): SaveRepository {
  return {
    load() {
      const serialized = storage.getItem(key)
      if (serialized === null) return null

      try {
        return migratePlayerSave(JSON.parse(serialized))
      } catch {
        return null
      }
    },
    save(value) {
      storage.setItem(key, JSON.stringify(value))
    },
  }
}
