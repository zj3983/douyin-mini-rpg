import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readJson = (file) => JSON.parse(readFileSync(resolve(file), 'utf8'))
const tokens = readJson('assets/UI/Theme/ui-tokens.json')

test('showcase scene uses Canvas as the 2D render root', () => {
  const scene = readJson('assets/Scenes/UIShowcase.scene')
  const nodeByName = new Map(scene.flatMap((node, id) => node.__type__ === 'cc.Node' ? [[node._name, { node, id }]] : []))
  const sceneNodeId = scene.findIndex((item) => item.__type__ === 'cc.Scene')
  const sceneNode = scene[sceneNodeId]
  const { node: canvasNode, id: canvasNodeId } = nodeByName.get('Canvas') ?? {}
  const { node: showcaseNode, id: showcaseNodeId } = nodeByName.get('UIShowcaseRoot') ?? {}

  assert.ok(sceneNode && canvasNode && showcaseNode, 'scene, Canvas, and showcase root nodes must exist')
  const componentAt = (reference) => scene[reference.__id__]
  const canvasComponents = canvasNode._components.map(componentAt)
  const sceneChildren = sceneNode._children.map((reference) => reference.__id__)

  assert.ok(sceneChildren.includes(canvasNodeId), 'Canvas must be a direct child of the scene root')
  assert.equal(canvasNode._parent.__id__, sceneNodeId)
  assert.ok(canvasComponents.some((component) => component.__type__ === 'cc.UITransform'))
  const canvas = canvasComponents.find((component) => component.__type__ === 'cc.Canvas')
  assert.ok(canvas, 'Canvas node must have cc.Canvas')
  assert.equal(canvas.node.__id__, canvasNodeId)
  assert.equal(canvas._alignCanvasWithScreen, true)
  assert.ok(canvasComponents.some((component) => component.__type__ === 'cc.Widget'))
  assert.ok(canvasNode._children.some((reference) => reference.__id__ === showcaseNodeId), 'showcase root must be under Canvas')
  assert.equal(showcaseNode._parent.__id__, canvasNodeId)
  assert.equal(scene[canvasNode._components[0].__id__]._contentSize.width, tokens.designResolution.width)
  assert.equal(scene[canvasNode._components[0].__id__]._contentSize.height, tokens.designResolution.height)
})

test('generated runtime token projection exactly matches the JSON source', () => {
  const expected = `// Generated from ui-tokens.json. Edit the JSON source, then regenerate.\nexport const uiTokens = ${JSON.stringify(tokens, null, 2)} as const\n`
  assert.equal(readFileSync(resolve('assets/UI/Theme/ui-theme.generated.ts'), 'utf8'), expected)
  assert.match(readFileSync(resolve('assets/UI/Scripts/CultivationUiFactory.ts'), 'utf8'), /from '\.\.\/Theme\/ui-theme\.generated'/)
})

test('primary button prefab state colors and dimensions are generated from tokens', () => {
  const prefab = readJson('assets/UI/Prefabs/Atoms/PrimaryButton.prefab')
  const button = prefab.find((item) => item.__type__ === 'cc.Button')
  const root = prefab.find((item) => item.__type__ === 'cc.Node' && item._name === 'PrimaryButton')
  const transform = prefab.find((item) => item.__type__ === 'cc.UITransform' && item.node.__id__ === prefab.indexOf(root))
  const rgba = (hex) => {
    const value = hex.slice(1)
    return [0, 2, 4, 6].map((offset) => Number.parseInt(value.slice(offset, offset + 2) || 'ff', 16))
  }

  assert.ok(button && root && transform)
  assert.deepEqual([transform._contentSize.width, transform._contentSize.height], [tokens.component.primaryButton.width, tokens.component.primaryButton.height])
  assert.deepEqual([button._normalColor.r, button._normalColor.g, button._normalColor.b, button._normalColor.a], rgba(tokens.color[tokens.prefab.buttonNormal]))
  assert.deepEqual([button._hoverColor.r, button._hoverColor.g, button._hoverColor.b, button._hoverColor.a], rgba(tokens.component.primaryButton.hover))
  assert.deepEqual([button._pressedColor.r, button._pressedColor.g, button._pressedColor.b, button._pressedColor.a], rgba(tokens.component.primaryButton.pressed))
  assert.deepEqual([button._disabledColor.r, button._disabledColor.g, button._disabledColor.b, button._disabledColor.a], rgba(tokens.component.primaryButton.disabled))
})

test('quality frame prefab retains a visible tokenized frame sprite and label', () => {
  const prefab = readJson('assets/UI/Prefabs/Atoms/QualityFrame.prefab')
  const root = prefab.find((item) => item.__type__ === 'cc.Node' && item._name === 'QualityFrame')
  const frame = prefab.find((item) => item.__type__ === 'cc.Node' && item._name === 'Frame')
  const frameSprite = prefab.find((item) => item.__type__ === 'cc.Sprite' && item.node.__id__ === prefab.indexOf(frame))
  const title = prefab.find((item) => item.__type__ === 'cc.Label' && item._string === '天品')

  assert.ok(root && frame && frameSprite && title)
  assert.ok(root._children.some((reference) => reference.__id__ === prefab.indexOf(frame)))
  const expectedColor = tokens.color[tokens.component.qualityFrame.border].slice(1)
  const expectedRgba = [0, 2, 4, 6].map((offset) => Number.parseInt(expectedColor.slice(offset, offset + 2) || 'ff', 16))
  assert.deepEqual([frameSprite._color.r, frameSprite._color.g, frameSprite._color.b, frameSprite._color.a], expectedRgba)
})
