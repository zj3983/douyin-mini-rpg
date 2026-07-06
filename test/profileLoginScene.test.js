import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  profileLoginAssetUrl,
  profileLoginHeroAsset,
  profileLoginLayerAssets,
  profileLoginSceneMarkup,
} from '../src/profileLoginScene.ts'

test('formal login scene resolves the project xianxia cover asset against the Vite base path', () => {
  assert.equal(profileLoginHeroAsset, 'assets/login/login-bg-xianxia.png')
  assert.equal(profileLoginAssetUrl('/'), '/assets/login/login-bg-xianxia.png')
  assert.equal(
    profileLoginAssetUrl('/game/douyin-mini-rpg/'),
    '/game/douyin-mini-rpg/assets/login/login-bg-xianxia.png',
  )
})

test('formal login scene renders professional separated layers without fake canvas warping', () => {
  const html = profileLoginSceneMarkup('/game/douyin-mini-rpg/')

  assert.match(html, /profile-login-scene/)
  assert.match(html, /data-animation-method="layered-assets"/)
  assert.match(html, /data-layer-id="background"/)
  assert.match(html, /data-layer-id="hero-body"/)
  assert.match(html, /data-layer-id="hero-flow"/)
  assert.match(html, /src="\/game\/douyin-mini-rpg\/assets\/login\/login-layer-bg-v2\.png"/)
  assert.match(html, /src="\/game\/douyin-mini-rpg\/assets\/login\/login-layer-hero-body-v2\.png"/)
  assert.match(html, /src="\/game\/douyin-mini-rpg\/assets\/login\/login-layer-hero-flow-v2\.png"/)
  assert.doesNotMatch(html, /profile-login-motion-canvas/)
  assert.doesNotMatch(html, /single-source-warp/)
  assert.doesNotMatch(html, /data-layer-clouds/)
  assert.doesNotMatch(html, /assets\/login\/login-layer-(clouds|left-sleeve|right-sleeve|robe-skirt|hair-ribbons)/)
  assert.doesNotMatch(html, /data-robe-flow=/)
  assert.doesNotMatch(html, /assets\/login\/login-cloud-/)
  assert.doesNotMatch(html, /profile-login-native-layer/)
  assert.doesNotMatch(html, /profile-login-filters/)
  assert.doesNotMatch(html, /profile-login-sword-glow/)
  assert.match(html, /aria-hidden="true"/)
})

test('formal login separated layer assets exist', () => {
  assert.equal(profileLoginLayerAssets.background, 'assets/login/login-layer-bg-v2.png')
  assert.equal(profileLoginLayerAssets.heroBody, 'assets/login/login-layer-hero-body-v2.png')
  assert.equal(profileLoginLayerAssets.heroFlow, 'assets/login/login-layer-hero-flow-v2.png')
  assert.equal(existsSync(resolve('public', profileLoginHeroAsset)), true)
  for (const asset of Object.values(profileLoginLayerAssets)) {
    assert.equal(existsSync(resolve('public', asset)), true, `${asset} should exist`)
  }
  const html = profileLoginSceneMarkup('/game/douyin-mini-rpg/')
  assert.equal((html.match(/assets\/login\//g) ?? []).length, 3)
})
