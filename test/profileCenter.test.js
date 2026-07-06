import test from 'node:test'
import assert from 'node:assert/strict'

import {
  profileAccountBadge,
  profileCenterSections,
  profileCenterTabs,
  profileCloseVisible,
} from '../src/profileCenter.ts'

test('profile center keeps login entry and signed-in account center separate', () => {
  assert.deepEqual(profileCenterSections(false, 'slots', false), {
    auth: true,
    centerTabs: false,
    slots: false,
    cloud: false,
    security: false,
    localSecurity: false,
  })

  assert.deepEqual(profileCenterSections(true, 'slots', false), {
    auth: false,
    centerTabs: true,
    slots: true,
    cloud: false,
    security: false,
    localSecurity: false,
  })
})

test('profile center exposes cloud and security as separate tabs', () => {
  assert.deepEqual(profileCenterTabs.map((tab) => tab.id), ['slots', 'cloud', 'security'])
  assert.equal(profileCenterSections(true, 'cloud', true).cloud, true)
  assert.equal(profileCenterSections(true, 'security', true).security, true)
  assert.equal(profileCenterSections(true, 'security', false).localSecurity, true)
  assert.equal(profileCenterSections(true, 'security', false).security, false)
})

test('profile center badges explain server and account state', () => {
  assert.deepEqual(profileAccountBadge(true, false), {
    title: '云端账号',
    detail: '资料会同步到服务器。',
  })
  assert.deepEqual(profileAccountBadge(false, true), {
    title: '游客试玩',
    detail: '当前只保存在本机，后续可注册正式账号。',
  })
})

test('profile close button stays visible in signed-in account center even after blocking entry flow', () => {
  assert.equal(profileCloseVisible({ signedIn: false, blocking: true, accountCenter: false }), false)
  assert.equal(profileCloseVisible({ signedIn: true, blocking: true, accountCenter: false }), false)
  assert.equal(profileCloseVisible({ signedIn: true, blocking: true, accountCenter: true }), true)
  assert.equal(profileCloseVisible({ signedIn: true, blocking: false, accountCenter: true }), true)
})
