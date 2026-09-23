import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tokenPath = path.join(projectDir, 'assets/UI/Theme/ui-tokens.json')
const outputPath = path.join(projectDir, 'assets/UI/Theme/ui-theme.generated.ts')
const outputMetaPath = `${outputPath}.meta`
const outputUuid = '679abc27-1422-4722-84ea-a0dc5f8c37a0'
const tokens = JSON.parse(await readFile(tokenPath, 'utf8'))

const source = `// Generated from ui-tokens.json. Edit the JSON source, then regenerate.\nexport const uiTokens = ${JSON.stringify(tokens, null, 2)} as const\n`
const meta = {
  ver: '4.0.24',
  importer: 'typescript',
  imported: true,
  uuid: outputUuid,
  files: [],
  subMetas: {},
  userData: {},
}

await writeFile(outputPath, source, 'utf8')
await writeFile(outputMetaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
console.log(`Generated ${path.relative(projectDir, outputPath)} from ${path.relative(projectDir, tokenPath)}`)
