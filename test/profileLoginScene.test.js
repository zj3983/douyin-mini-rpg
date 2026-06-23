import test from 'node:test'
import assert from 'node:assert/strict'

import { profileLoginAssetUrl, profileLoginHeroAsset, profileLoginSceneMarkup } from '../src/profileLoginScene.ts'

test('formal login scene resolves the project xianxia cover asset against the Vite base path', () => {
  assert.equal(profileLoginHeroAsset, 'assets/login/login-bg-xianxia.png')
  assert.equal(profileLoginAssetUrl('/'), '/assets/login/login-bg-xianxia.png')
  assert.equal(
    profileLoginAssetUrl('/game/douyin-mini-rpg/'),
    '/game/douyin-mini-rpg/assets/login/login-bg-xianxia.png',
  )
})

test('formal login scene includes motion hooks for clouds, robe, and sword glow', () => {
  const html = profileLoginSceneMarkup('/game/douyin-mini-rpg/')

  assert.match(html, /profile-login-scene/)
  assert.match(html, /src="\/game\/douyin-mini-rpg\/assets\/login\/login-bg-xianxia\.png"/)
  assert.match(html, /profile-login-cloud--far/)
  assert.match(html, /profile-login-cloud--near/)
  assert.match(html, /profile-login-robe-flow/)
  assert.match(html, /profile-login-sword-glow/)
  assert.match(html, /aria-hidden="true"/)
})
