export type ProfileCenterTabId = 'slots' | 'cloud' | 'security'

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

export function profileAccountBadge(cloudAccount: boolean, guest: boolean) {
  if (cloudAccount) return { title: '云端账号', detail: '资料会同步到服务器。' }
  if (guest) return { title: '游客试玩', detail: '当前只保存在本机，后续可注册正式账号。' }
  return { title: '本机档案', detail: '当前资料保存在这台设备。' }
}

export function profileCloseVisible({ signedIn, blocking, accountCenter }: { signedIn: boolean; blocking: boolean; accountCenter: boolean }) {
  if (!signedIn) return false
  if (accountCenter) return true
  return !blocking
}
