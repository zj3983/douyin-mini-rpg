import test from 'node:test'
import assert from 'node:assert/strict'

import {
  profileAuthHintText,
  profileAuthTitleText,
  profileBusyText,
  profileGuestBusyText,
  profileSubmitText,
} from '../src/profileFeedback.ts'

test('profile auth copy gives formal entry labels for login and register', () => {
  assert.equal(profileAuthTitleText('login'), '账号登录')
  assert.equal(profileSubmitText('login'), '登录进入')
  assert.equal(profileSubmitText('login', true), '登录中...')
  assert.match(profileAuthHintText('login'), /云端存档/)
  assert.match(profileAuthHintText('login'), /游客试玩/)

  assert.equal(profileAuthTitleText('register'), '创建账号')
  assert.equal(profileSubmitText('register'), '创建并进入')
  assert.equal(profileSubmitText('register', true), '创建中...')
  assert.match(profileAuthHintText('register'), /正式账号/)
  assert.match(profileAuthHintText('register'), /本机保存/)
})

test('profile busy copy tells the player what the login screen is doing', () => {
  assert.equal(profileBusyText('login'), '正在验证账号并读取存档...')
  assert.equal(profileBusyText('register'), '正在创建账号和初始档案...')
  assert.equal(profileGuestBusyText(), '正在进入游客试玩...')
})
