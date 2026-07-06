export type ProfileAuthMode = 'login' | 'register'
export type ProfileFeedbackTone = 'error' | 'info' | 'success'
export type ProfileBusyKind = ProfileAuthMode | 'guest' | 'sync' | 'password' | 'logout' | 'slot'

export function profileAuthTitleText(mode: ProfileAuthMode) {
  return mode === 'login' ? '账号登录' : '创建账号'
}

export function profileSubmitText(mode: ProfileAuthMode, busy = false) {
  if (busy) return mode === 'login' ? '登录中...' : '创建中...'
  return mode === 'login' ? '登录进入' : '创建并进入'
}

export function profileBusyText(mode: ProfileAuthMode) {
  return mode === 'login'
    ? '正在验证账号并读取存档...'
    : '正在创建账号和初始档案...'
}

export function profileGuestBusyText() {
  return '正在进入游客试玩...'
}
