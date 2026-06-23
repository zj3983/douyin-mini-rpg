export const profileLoginHeroAsset = '/assets/login/login-bg-xianxia.png'

export function profileLoginSceneMarkup() {
  return `
        <div class="profile-login-scene profile-auth-only" aria-hidden="true">
          <img class="profile-login-bg" src="${profileLoginHeroAsset}" alt="">
          <div class="profile-login-cloud profile-login-cloud--far"></div>
          <div class="profile-login-cloud profile-login-cloud--near"></div>
          <div class="profile-login-cloud profile-login-cloud--front"></div>
          <div class="profile-login-robe-flow"></div>
          <div class="profile-login-sword-glow"></div>
        </div>`
}
