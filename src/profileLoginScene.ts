export const profileLoginHeroAsset = 'assets/login/login-bg-xianxia.png'

type ImportMetaWithOptionalEnv = ImportMeta & { env?: { BASE_URL?: string } }

function currentBaseUrl() {
  return (import.meta as ImportMetaWithOptionalEnv).env?.BASE_URL ?? '/'
}

export function profileLoginAssetUrl(baseUrl = currentBaseUrl()) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}${profileLoginHeroAsset.replace(/^\/+/, '')}`
}

export function profileLoginSceneMarkup(baseUrl?: string) {
  return `
        <div class="profile-login-scene profile-auth-only" aria-hidden="true">
          <img class="profile-login-bg" src="${profileLoginAssetUrl(baseUrl)}" alt="">
          <div class="profile-login-cloud profile-login-cloud--far"></div>
          <div class="profile-login-cloud profile-login-cloud--near"></div>
          <div class="profile-login-cloud profile-login-cloud--front"></div>
          <div class="profile-login-robe-flow"></div>
          <div class="profile-login-sword-glow"></div>
        </div>`
}
