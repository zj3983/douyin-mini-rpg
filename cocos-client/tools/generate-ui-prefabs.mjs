import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tokens = JSON.parse(await readFile(path.join(projectDir, 'assets/UI/Theme/ui-tokens.json'), 'utf8'))
const spriteDir = path.join(projectDir, 'assets/UI/Common/Sprites')
const frameBorder = tokens.skin.borderPixels
const frameAssetUuid = '6f06f458-77c5-4dd4-aea3-0e9531d17031'
const fillAssetUuid = 'd8876554-8a80-4e76-aba1-ab7c20349be2'
const frameUuid = `${frameAssetUuid}@f9941`
const fillUuid = `${fillAssetUuid}@f9941`
const uiLayer = 33554432

const definitions = [
  { name: 'PrimaryButton', folder: 'Atoms', uuid: 'be923624-563a-49ed-b5d0-0e6422deec1a', component: 'primaryButton', label: '继续破境', button: true },
  { name: 'PanelFrame', folder: 'Atoms', uuid: '7c8e0a1c-1d13-4520-adfb-0b2a6c459df5', component: 'panelFrame' },
  { name: 'TitleBar', folder: 'Atoms', uuid: 'f3bedb60-7757-4199-9985-e1f66e3d3c3f', component: 'titleBar', label: '青岚剑宗' },
  { name: 'ResourceChip', folder: 'Atoms', uuid: 'c4888eba-5079-4572-855b-97402797e3b9', component: 'resourceChip', label: '灵石  2,685' },
  { name: 'ProgressBar', folder: 'Atoms', uuid: 'e7a2bb45-8c5f-4af4-9b05-5b6349f98634', component: 'progressBar', progress: 0.68 },
  { name: 'NavItem', folder: 'Molecules', uuid: '9d32a585-852d-4447-a7b8-272813544b07', component: 'navItem', icon: '剑', label: '战斗' },
  { name: 'QualityFrame', folder: 'Atoms', uuid: '7c79efb6-9f00-473c-b4be-49f121791b96', component: 'qualityFrame', label: '天品' },
]

function colorValue(tokenName) {
  const hex = tokens.color[tokenName] ?? tokenName
  const value = hex.replace('#', '')
  return [0, 2, 4, 6].map((offset) => Number.parseInt(value.slice(offset, offset + 2) || 'ff', 16))
}

function componentStyle(definition) {
  const style = tokens.component[definition.component]
  return {
    ...definition,
    ...style,
    width: style.width,
    height: style.height,
    fill: style.track ? colorValue(style.track) : (style.fill ? colorValue(style.fill) : (style.activeFill ? colorValue(style.activeFill) : null)),
    border: style.border ? colorValue(style.border) : (style.activeBorder ? colorValue(style.activeBorder) : null),
    textColor: style.text ? colorValue(style.text) : (style.activeText ? colorValue(style.activeText) : null),
    fontSize: typeof style.fontSize === 'string' ? tokens.typeSize[style.fontSize] : style.fontSize,
    hoverColor: style.hover ? colorValue(style.hover) : null,
    pressedColor: style.pressed ? colorValue(style.pressed) : null,
    disabledColor: style.disabled ? colorValue(style.disabled) : null,
    trackColor: style.track ? colorValue(style.track) : null,
    progressColor: style.fill && definition.progress !== undefined ? colorValue(style.fill) : null,
    progress: definition.progress,
  }
}

function surfaceColor(rgb) {
  return { r: rgb[0], g: rgb[1], b: rgb[2], a: rgb[3] ?? 255 }
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
  return Buffer.concat([length, typeBytes, data, checksum])
}

function roundedContains(x, y, left, top, right, bottom, radius) {
  if (x < left || x >= right || y < top || y >= bottom) return false
  const cx = Math.max(left + radius, Math.min(x, right - radius))
  const cy = Math.max(top + radius, Math.min(y, bottom - radius))
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function roundedSurfacePng(hollow) {
  const width = tokens.skin.surfacePixels
  const height = tokens.skin.surfacePixels
  const samples = 4
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    rows[rowStart] = 0
    for (let x = 0; x < width; x++) {
      let covered = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples
          const py = y + (sy + 0.5) / samples
          const inside = roundedContains(px, py, 0, 0, width, height, tokens.skin.cornerRadiusPixels)
          const inHole = hollow && roundedContains(px, py, frameBorder, frameBorder, width - frameBorder, height - frameBorder, tokens.skin.innerCornerRadiusPixels)
          if (inside && !inHole) covered++
        }
      }
      const alpha = Math.round(255 * covered / (samples * samples))
      const pixel = rowStart + 1 + x * 4
      rows[pixel] = 255
      rows[pixel + 1] = 255
      rows[pixel + 2] = 255
      rows[pixel + 3] = alpha
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function uuidFrom(seed) {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function compressUuid(uuid) {
  const hex = uuid.replaceAll('-', '')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bits = hex.slice(5).split('').map((char) => Number.parseInt(char, 16).toString(2).padStart(4, '0')).join('')
  let output = hex.slice(0, 5)
  for (let offset = 0; offset < bits.length; offset += 6) output += alphabet[Number.parseInt(bits.slice(offset, offset + 6).padEnd(6, '0'), 2)]
  return output
}

function makeImageMeta(assetUuid, displayName) {
  const width = tokens.skin.surfacePixels
  const height = tokens.skin.surfacePixels
  const half = width / 2
  const rawPosition = [-half, -half, 0, half, -half, 0, -half, half, 0, half, half, 0]
  return {
    ver: '1.0.27', importer: 'image', imported: true, uuid: assetUuid, files: ['.json', '.png'],
    subMetas: {
      '6c48a': {
        importer: 'texture', uuid: `${assetUuid}@6c48a`, displayName, id: '6c48a', name: 'texture',
        userData: { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', imageUuidOrDatabaseUri: assetUuid, isUuid: true, visible: false, minfilter: 'linear', magfilter: 'linear', mipfilter: 'none', anisotropy: 0 },
        ver: '1.0.22', imported: true, files: ['.json'], subMetas: {},
      },
      f9941: {
        importer: 'sprite-frame', uuid: `${assetUuid}@f9941`, displayName, id: 'f9941', name: 'spriteFrame',
        userData: {
          trimThreshold: 1, rotated: false, offsetX: 0, offsetY: 0, trimX: 0, trimY: 0,
          width, height, rawWidth: width, rawHeight: height,
          borderTop: frameBorder, borderBottom: frameBorder, borderLeft: frameBorder, borderRight: frameBorder,
          packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
          vertices: { rawPosition, indexes: [0, 1, 2, 2, 1, 3], uv: [0, 64, 64, 64, 0, 0, 64, 0], nuv: [0, 0, 1, 0, 0, 1, 1, 1], minPos: [-half, -half, 0], maxPos: [half, half, 0] },
          isUuid: true, imageUuidOrDatabaseUri: `${assetUuid}@6c48a`, atlasUuid: '', trimType: 'auto',
        },
        ver: '1.0.12', imported: true, files: ['.json'], subMetas: {},
      },
    },
    userData: { type: 'sprite-frame', fixAlphaTransparencyArtifacts: false, hasAlpha: true, redirect: `${assetUuid}@6c48a` },
  }
}

async function generateSurface(fileName, assetUuid, hollow) {
  const pngPath = path.join(spriteDir, fileName)
  await writeFile(pngPath, roundedSurfacePng(hollow))
  await writeFile(`${pngPath}.meta`, `${JSON.stringify(makeImageMeta(assetUuid, path.basename(fileName, '.png')), null, 2)}\n`)
}

function color(rgb) { return { __type__: 'cc.Color', r: rgb[0], g: rgb[1], b: rgb[2], a: rgb[3] } }
function ref(id) { return { __id__: id } }

async function generatePrefab(definition) {
  definition = componentStyle(definition)
  const objects = [{ __type__: 'cc.Prefab', _name: definition.name, _objFlags: 0, _native: '', data: ref(1), optimizationPolicy: 0, persistent: false, asyncLoadAssets: false }]
  const rootId = 1

  function addNode(name, parentId, x, y, width, height, root = false, nodeOptions = {}) {
    const nodeId = objects.length
    const node = {
      __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {},
      _parent: parentId === null ? null : ref(parentId), _children: [], _active: true, _components: [], _prefab: null,
      _lpos: { __type__: 'cc.Vec3', x, y, z: 0 }, _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
      _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 }, _layer: uiLayer,
      _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 }, _id: '',
    }
    objects.push(node)
    if (parentId !== null) objects[parentId]._children.push(ref(nodeId))

    function addComponent(type, properties = {}) {
      const compId = objects.length
      const infoId = compId + 1
      const component = { __type__: type, _name: '', _objFlags: 0, node: ref(nodeId), _enabled: true, __prefab: ref(infoId), ...properties, _id: '' }
      objects.push(component)
      objects.push({ __type__: 'cc.CompPrefabInfo', fileId: compressUuid(uuidFrom(`${definition.uuid}:${compId}`)) })
      node._components.push(ref(compId))
      return compId
    }

    addComponent('cc.UITransform', {
      _contentSize: { __type__: 'cc.Size', width, height },
      _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    })

    function addSprite(assetFrameUuid, tint, size = [width, height], nodeOptions = {}) {
      const spriteId = addComponent('cc.Sprite', {
        _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint),
        _spriteFrame: { __uuid__: assetFrameUuid, __expectedType__: 'cc.SpriteFrame' },
        _type: 1, _fillType: 0, _sizeMode: 0, _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 },
        _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null,
      })
      return spriteId
    }

    if (nodeOptions.background) addSprite(fillUuid, nodeOptions.background)
    if (nodeOptions.border) {
      const frameNodeId = addNode('Frame', nodeId, 0, 0, width, height)
      const frameNode = objects[frameNodeId]
      const compId = objects.length
      const infoId = compId + 1
      objects.push({
        __type__: 'cc.Sprite', _name: '', _objFlags: 0, node: ref(frameNodeId), _enabled: true, __prefab: ref(infoId),
        _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(nodeOptions.border),
        _spriteFrame: { __uuid__: frameUuid, __expectedType__: 'cc.SpriteFrame' },
        _type: 1, _fillType: 0, _sizeMode: 0, _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 },
        _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null, _id: '',
      })
      objects.push({ __type__: 'cc.CompPrefabInfo', fileId: compressUuid(uuidFrom(`${definition.uuid}:frame:${compId}`)) })
      frameNode._components.push(ref(compId))
    }
    if (nodeOptions.button) {
      addComponent('cc.Button', {
        clickEvents: [], _interactable: true, _transition: 1,
        _normalColor: color(colorValue(tokens.prefab.buttonNormal)), _hoverColor: color(nodeOptions.hoverColor),
        _pressedColor: color(nodeOptions.pressedColor), _disabledColor: color(nodeOptions.disabledColor),
        _normalSprite: { __uuid__: fillUuid, __expectedType__: 'cc.SpriteFrame' },
        _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: tokens.prefab.buttonTransitionSeconds, _zoomScale: tokens.prefab.buttonZoomScale, _target: null,
      })
    }
    if (nodeOptions.labelText) addLabel(nodeId, 'Title', nodeOptions.labelText, width - tokens.prefab.labelHorizontalInset, height - tokens.prefab.labelVerticalInset, nodeOptions.fontSize ?? tokens.typeSize.component, nodeOptions.textColor ?? colorValue('ink'), 0, 0)
    if (nodeOptions.progress) {
      const fillWidth = width - 4
      const fillNodeId = addNode('ProgressFill', nodeId, -width / 2 + fillWidth / 2, 0, fillWidth, height - 4, false)
      const fillCompId = objects.length
      const fillInfoId = fillCompId + 1
      objects.push({
        __type__: 'cc.Sprite', _name: '', _objFlags: 0, node: ref(fillNodeId), _enabled: true, __prefab: ref(fillInfoId),
        _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(nodeOptions.progressColor),
        _spriteFrame: { __uuid__: fillUuid, __expectedType__: 'cc.SpriteFrame' },
        _type: 1, _fillType: 0, _sizeMode: 0, _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 },
        _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null, _id: '',
      })
      objects.push({ __type__: 'cc.CompPrefabInfo', fileId: compressUuid(uuidFrom(`${definition.uuid}:progress-sprite`)) })
      objects[fillNodeId]._components.push(ref(fillCompId))
      addComponent('cc.ProgressBar', { _barSprite: ref(fillCompId), _mode: 0, _totalLength: fillWidth, _progress: definition.progress, _reverse: false })
    }
    if (nodeOptions.icon) addLabel(nodeId, 'Icon', nodeOptions.icon, tokens.prefab.iconWidth, tokens.prefab.iconHeight, tokens.component.navItem.iconFontSize, colorValue('jadePrimary'), tokens.prefab.iconX, tokens.prefab.iconY)
    if (nodeOptions.secondaryLabel) addLabel(nodeId, 'Subtitle', nodeOptions.secondaryLabel, width - tokens.space.xs, tokens.prefab.subtitleHeight, tokens.typeSize.caption, colorValue('muted'), 0, tokens.prefab.subtitleY)

    if (root) {
      objects[nodeId]._prefab = ref(objects.length)
      objects.push({ __type__: 'cc.PrefabInfo', root: ref(rootId), asset: ref(0), fileId: compressUuid(definition.uuid) })
    } else {
      objects[nodeId]._prefab = ref(objects.length)
      objects.push({ __type__: 'cc.PrefabInfo', root: ref(rootId), asset: ref(0), fileId: compressUuid(uuidFrom(`${definition.uuid}:${name}:${nodeId}`)) })
    }
    return nodeId
  }

  function addLabel(parentId, name, string, width, height, size, tint, x, y) {
    const nodeId = addNode(name, parentId, x, y, width, height)
    const uiId = objects[nodeId]._components[0].__id__
    const compInfoId = objects.length + 1
    const labelId = objects.length
    objects.push({
      __type__: 'cc.Label', _name: '', _objFlags: 0, node: ref(nodeId), _enabled: true, __prefab: ref(compInfoId),
      _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _string: string,
      _horizontalAlign: 1, _verticalAlign: 1, _actualFontSize: size, _fontSize: size, _fontFamily: 'Microsoft YaHei', _lineHeight: size + 8,
      _overflow: 1, _enableWrapText: false, _font: null, _isSystemFontUsed: true, _spacingX: 0, _isItalic: false,
      _isBold: name === 'Title' || name === 'Icon', _isUnderline: false, _underlineHeight: 2, _cacheMode: 0, _id: '',
    })
    objects.push({ __type__: 'cc.CompPrefabInfo', fileId: compressUuid(uuidFrom(`${definition.uuid}:label:${labelId}`)) })
    objects[nodeId]._components.push(ref(labelId))
    return { nodeId, labelId, uiId }
  }

  const rootOptions = {
    background: definition.fill,
    border: definition.border,
    button: definition.button,
    labelText: definition.label && !definition.icon ? definition.label : null,
    textColor: definition.textColor,
    hoverColor: definition.hoverColor,
    pressedColor: definition.pressedColor,
    disabledColor: definition.disabledColor,
    progressColor: definition.progressColor,
    progress: definition.progress !== undefined,
    icon: definition.icon,
    secondaryLabel: definition.icon ? definition.label : null,
  }
  const root = addNode(definition.name, null, 0, 0, definition.width, definition.height, true, rootOptions)
  objects[0].data = ref(root)

  const targetDir = path.join(projectDir, 'assets/UI/Prefabs', definition.folder)
  await mkdir(targetDir, { recursive: true })
  const prefabPath = path.join(targetDir, `${definition.name}.prefab`)
  const prefabMeta = {
    ver: '1.1.50', importer: 'prefab', imported: true, uuid: definition.uuid,
    files: ['.json'], subMetas: {}, userData: { syncNodeName: definition.name },
  }
  await writeFile(prefabPath, `${JSON.stringify(objects, null, 2)}\n`)
  await writeFile(`${prefabPath}.meta`, `${JSON.stringify(prefabMeta, null, 2)}\n`)
}

await mkdir(spriteDir, { recursive: true })
await generateSurface('ui-surface-fill.png', fillAssetUuid, false)
await generateSurface('ui-surface-frame.png', frameAssetUuid, true)

for (const definition of definitions) await generatePrefab(definition)
console.log(`Generated ${definitions.length} Cocos UI prefabs and their shared sliced surfaces.`)
