import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(projectDir, 'assets/Scenes/MainBattle.scene')
const outputPath = path.join(projectDir, 'assets/Scenes/UIShowcase.scene')
const sceneUuid = 'f7ea9e05-8c72-417e-af97-fed2b99d53ea'
const showcaseScriptUuid = '17a48556-c5b1-4ba8-a036-13cf32cf0046'
const uiLayer = 33554432
const prefabUuids = {
  primaryButtonPrefab: 'be923624-563a-49ed-b5d0-0e6422deec1a',
  panelFramePrefab: '7c8e0a1c-1d13-4520-adfb-0b2a6c459df5',
  titleBarPrefab: 'f3bedb60-7757-4199-9985-e1f66e3d3c3f',
  resourceChipPrefab: 'c4888eba-5079-4572-855b-97402797e3b9',
  progressBarPrefab: 'e7a2bb45-8c5f-4af4-9b05-5b6349f98634',
  navItemPrefab: '9d32a585-852d-4447-a7b8-272813544b07',
  qualityFramePrefab: '7c79efb6-9f00-473c-b4be-49f121791b96',
}

function compressUuid(uuid) {
  const hex = uuid.replaceAll('-', '')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bits = hex.slice(5).split('').map((char) => Number.parseInt(char, 16).toString(2).padStart(4, '0')).join('')
  let output = hex.slice(0, 5)
  for (let offset = 0; offset < bits.length; offset += 6) {
    output += alphabet[Number.parseInt(bits.slice(offset, offset + 6).padEnd(6, '0'), 2)]
  }
  return output
}

function remapIds(value, idMap) {
  if (Array.isArray(value)) return value.map((item) => remapIds(item, idMap))
  if (!value || typeof value !== 'object') return value
  const result = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === '__id__') {
      result[key] = idMap[child] ?? null
    } else {
      result[key] = remapIds(child, idMap)
    }
  }
  return result
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'))
const selectedIds = [0, 1, 2, 3, 8, 9, 10, 11, 12]
const newIdByOldId = new Map(selectedIds.map((id, index) => [id, index]))
const idMap = Object.fromEntries(newIdByOldId)
const scene = selectedIds.map((id) => remapIds(source[id], idMap))

scene[0]._name = 'UIShowcase'
scene[0].scene = { __id__: 1 }
scene[0].asyncLoadAssets = false

Object.assign(scene[1], {
  _name: 'UIShowcase',
  _parent: null,
  _children: [{ __id__: 2 }, { __id__: 9 }],
  _components: [],
  _prefab: null,
  _globals: { __id__: 4 },
  _id: sceneUuid,
})

scene[2]._parent = { __id__: 1 }
scene[2]._children = []
scene[2]._components = [{ __id__: 3 }]
scene[2]._prefab = null
scene[3].node = { __id__: 2 }
scene[3].__prefab = null

scene.push(
  {
    __type__: 'cc.Node',
    _name: 'UIShowcaseRoot',
    _objFlags: 0,
    __editorExtras__: {},
    _parent: { __id__: 1 },
    _children: [],
    _active: true,
    _components: [{ __id__: 10 }, { __id__: 11 }],
    _prefab: null,
    _lpos: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _layer: uiLayer,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '',
  },
  {
    __type__: 'cc.UITransform',
    _name: '',
    _objFlags: 0,
    node: { __id__: 9 },
    _enabled: true,
    __prefab: null,
    _contentSize: { __type__: 'cc.Size', width: 750, height: 1334 },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _id: '',
  },
  {
    __type__: compressUuid(showcaseScriptUuid),
    _name: '',
    _objFlags: 0,
    node: { __id__: 9 },
    _enabled: true,
    __prefab: null,
    ...Object.fromEntries(Object.entries(prefabUuids).map(([name, uuid]) => [name, {
      __uuid__: uuid,
      __expectedType__: 'cc.Prefab',
    }])),
    _id: '',
  },
)

await writeFile(outputPath, `${JSON.stringify(scene, null, 2)}\n`, 'utf8')
console.log(`Generated ${path.relative(projectDir, outputPath)}`)
