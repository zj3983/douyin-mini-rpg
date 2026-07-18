import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const retiredPrefixes = [
  'Assets/Generated/Atlases/',
  'Assets/Combat/',
]

test('production catalogs and scripts do not reference retired atlas pipelines', () => {
  const roots = [
    resolve('assets/Data'),
    resolve('assets/resources/Data'),
    resolve('assets/Scenes'),
    resolve('assets/Scripts'),
  ]
  const productionText = roots.flatMap((root) => textFiles(root))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n')

  for (const prefix of retiredPrefixes) {
    assert.equal(productionText.includes(prefix), false, `${prefix} is still referenced by production content`)
  }
})

test('retired source atlases are absent from the remote resources bundle', () => {
  for (const prefix of retiredPrefixes) {
    assert.equal(
      existsSync(resolve('assets/resources', prefix)),
      false,
      `${prefix} should be removed after canonical ActorAtlases are verified`,
    )
  }
})

function textFiles(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return textFiles(path)
    return ['.json', '.scene', '.ts'].includes(extname(entry.name)) ? [path] : []
  })
}
