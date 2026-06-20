export type ProfileCenterTabId = 'slots' | 'cloud' | 'security'
export type ProfileServerState = 'checking' | 'online' | 'offline'
export type ProfileBadgeTone = 'info' | 'success' | 'error'

export interface ProfileCenterTab {
  id: ProfileCenterTabId
  label: string
  hint: string
}

export const profileCenterTabs: ProfileCenterTab[] = [
  { id: 'slots', label: '角色档案', hint: '创建、切换和查看三个角色进度。' },
  { id: 'cloud', label: '云端同步', hint: '查看同步状态，手动同步或退出账号。' },
  { id: 'security', label: '账号安全', hint: '云端账号可修改密码；游客和本机档案可先绑定账号。' },
]

export function profileCenterSections(signedIn: boolean, tab: ProfileCenterTabId, cloudAccount: boolean) {
  return {
    auth: !signedIn,
    centerTabs: signedIn,
    slots: signedIn && tab === 'slots',
    cloud: signedIn && tab === 'cloud',
    security: signedIn && tab === 'security' && cloudAccount,
    localSecurity: signedIn && tab === 'security' && !cloudAccount,
  }
}

export function profileServerBadge(state: ProfileServerState): { title: string; detail: string; tone: ProfileBadgeTone } {
  if (state === 'online') {
    return { title: '服务器在线', detail: '登录后可读取云端存档。', tone: 'success' }
  }
  if (state === 'offline') {
    return { title: '服务器离线', detail: '可以使用本机档案或游客试玩。', tone: 'error' }
  }
  return { title: '服务器检测中', detail: '正在确认云端登录服务。', tone: 'info' }
}

export function profileAccountBadge(cloudAccount: boolean, guest: boolean) {
  if (cloudAccount) return { title: '云端账号', detail: '资料会同步到服务器。' }
  if (guest) return { title: '游客试玩', detail: '当前只保存在本机，后续可注册正式账号。' }
  return { title: '本机档案', detail: '当前资料保存在这台设备。' }
}
