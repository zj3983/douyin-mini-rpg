import test from 'node:test'
import assert from 'node:assert/strict'

import { profileLoginHeroAsset, profileLoginSceneMarkup } from '../src/profileLoginScene.ts'

test('formal login scene points at the project xianxia cover asset', () => {
  assert.equal(profileLoginHeroAsset, '/assets/login/login-bg-xianxia.png')
})

test('formal login scene includes motion hooks for clouds, robe, and sword glow', () => {
  const html = profileLoginSceneMarkup()

  assert.match(html, /profile-login-scene/)
  assert.match(html, /profile-login-cloud--far/)
  assert.match(html, /profile-login-cloud--near/)
  assert.match(html, /profile-login-robe-flow/)
  assert.match(html, /profile-login-sword-glow/)
  assert.match(html, /aria-hidden="true"/)
})
