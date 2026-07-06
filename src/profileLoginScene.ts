export const profileLoginHeroAsset = 'assets/login/login-bg-xianxia.png'
export const profileLoginLayerAssets = {
  background: 'assets/login/login-layer-bg-v2.png',
  heroBody: 'assets/login/login-layer-hero-body-v2.png',
  heroFlow: 'assets/login/login-layer-hero-flow-v2.png',
} as const

type ImportMetaWithOptionalEnv = ImportMeta & { env?: { BASE_URL?: string } }

function currentBaseUrl() {
  return (import.meta as ImportMetaWithOptionalEnv).env?.BASE_URL ?? '/'
}

function resolveProfileLoginAssetUrl(asset: string, baseUrl = currentBaseUrl()) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}${asset.replace(/^\/+/, '')}`
}

export function profileLoginAssetUrl(baseUrl = currentBaseUrl()) {
  return resolveProfileLoginAssetUrl(profileLoginHeroAsset, baseUrl)
}

function profileLoginLayerUrl(asset: string, baseUrl = currentBaseUrl()) {
  return resolveProfileLoginAssetUrl(asset, baseUrl)
}

export function profileLoginSceneMarkup(baseUrl?: string) {
  return `
        <div class="profile-login-scene profile-auth-only" data-animation-method="layered-assets" aria-hidden="true">
          <img class="profile-login-layer profile-login-bg" data-layer-id="background" src="${profileLoginLayerUrl(profileLoginLayerAssets.background, baseUrl)}" alt="">
          <img class="profile-login-layer profile-login-hero-body" data-layer-id="hero-body" src="${profileLoginLayerUrl(profileLoginLayerAssets.heroBody, baseUrl)}" alt="">
          <img class="profile-login-layer profile-login-hero-flow" data-layer-id="hero-flow" src="${profileLoginLayerUrl(profileLoginLayerAssets.heroFlow, baseUrl)}" alt="">
        </div>`
}
