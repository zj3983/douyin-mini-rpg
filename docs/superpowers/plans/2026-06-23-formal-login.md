# Formal Login Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current mixed account modal with a production-style xianxia mobile login entry that has moving cloud layers, subtle robe motion, clear login/register/guest feedback, and an isolated signed-in account center.

**Architecture:** Keep the existing account/save logic and DOM ids intact, but split login visuals into a small pure helper and CSS-only motion layers. The generated cover image becomes a project asset, while TypeScript markup, feedback copy, and CSS define the login entry behavior without touching combat or save data models.

**Tech Stack:** Vite, TypeScript, CSS animations, Node `node:test`, existing Playwright-powered `npm run agent:test`.

---

## File Structure

- Create `src/profileLoginScene.ts`: returns the formal login scene markup and exposes the project-local hero asset path.
- Create `test/profileLoginScene.test.js`: verifies the login scene uses the committed asset path and contains the animation hook elements.
- Create `public/assets/login/login-bg-xianxia.png`: copied from the approved generated image at `C:\Users\Administrator\.codex\generated_images\019e2be4-62b5-7920-9e4c-e6b6f8628941\ig_0ab719af79371cf2016a3a8fa029f8819184a76a4d4051dccb.png`.
- Modify `src/profileFeedback.ts`: update login/register/guest wording to a more formal game-entry tone.
- Modify `test/profileFeedback.test.js`: lock the formal copy and busy feedback.
- Modify `src/main.ts`: import the login scene markup, insert it into `#profile-form`, and revise static auth copy while preserving all existing ids.
- Modify `src/style.css`: redesign auth-simple mode as a portrait game login entry, add moving clouds, robe shimmer, sword glow, and keep signed-in account center behavior.

## Task 1: Add Login Scene Helper

**Files:**
- Create: `src/profileLoginScene.ts`
- Create: `test/profileLoginScene.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/profileLoginScene.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- test/profileLoginScene.test.js
```

Expected: FAIL because `src/profileLoginScene.ts` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `src/profileLoginScene.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test -- test/profileLoginScene.test.js
```

Expected: PASS for both `profileLoginScene` tests.

- [ ] **Step 5: Commit**

```powershell
git add src/profileLoginScene.ts test/profileLoginScene.test.js
git commit -m "Add formal login scene helper"
```

## Task 2: Add Approved Login Cover Asset

**Files:**
- Create: `public/assets/login/login-bg-xianxia.png`

- [ ] **Step 1: Copy the approved generated image into project assets**

Run:

```powershell
New-Item -ItemType Directory -Force -Path public/assets/login | Out-Null
Copy-Item -LiteralPath 'C:\Users\Administrator\.codex\generated_images\019e2be4-62b5-7920-9e4c-e6b6f8628941\ig_0ab719af79371cf2016a3a8fa029f8819184a76a4d4051dccb.png' -Destination 'public/assets/login/login-bg-xianxia.png' -Force
```

- [ ] **Step 2: Verify the asset exists and is non-empty**

Run:

```powershell
Get-Item public/assets/login/login-bg-xianxia.png | Select-Object FullName,Length
```

Expected: `Length` is greater than `100000`.

- [ ] **Step 3: Commit**

```powershell
git add public/assets/login/login-bg-xianxia.png
git commit -m "Add xianxia login cover asset"
```

## Task 3: Formalize Login Feedback Copy

**Files:**
- Modify: `src/profileFeedback.ts`
- Modify: `test/profileFeedback.test.js`

- [ ] **Step 1: Update the failing copy tests**

Replace `test/profileFeedback.test.js` with:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- test/profileFeedback.test.js
```

Expected: FAIL because current copy still uses the old entry wording.

- [ ] **Step 3: Update `src/profileFeedback.ts`**

Replace the exported functions in `src/profileFeedback.ts` with:

```ts
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

export function profileAuthHintText(mode: ProfileAuthMode) {
  return mode === 'login'
    ? '输入账号和密码读取云端存档；也可以选择游客试玩，本机进度不会同步到云端。'
    : '创建正式账号后可保存角色资料；服务器不可用时会先保存到本机。'
}

export function profileBusyText(mode: ProfileAuthMode) {
  return mode === 'login'
    ? '正在验证账号并读取存档...'
    : '正在创建账号和初始档案...'
}

export function profileGuestBusyText() {
  return '正在进入游客试玩...'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test -- test/profileFeedback.test.js
```

Expected: PASS for both profile feedback tests.

- [ ] **Step 5: Commit**

```powershell
git add src/profileFeedback.ts test/profileFeedback.test.js
git commit -m "Polish formal login copy"
```

## Task 4: Insert Formal Login Scene into Main Template

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import the scene helper**

Add this import near the existing profile imports in `src/main.ts`:

```ts
import { profileLoginSceneMarkup } from './profileLoginScene'
```

- [ ] **Step 2: Insert the scene markup immediately inside `#profile-form`**

Change:

```html
      <form id="profile-form" class="profile-card">
        <div class="profile-brand">
```

to:

```html
      <form id="profile-form" class="profile-card">
        ${profileLoginSceneMarkup()}
        <div class="profile-brand">
```

- [ ] **Step 3: Update the static auth entry copy in the template**

In the same `#profile-panel` template block, set these initial labels:

```html
          <small>虚境试炼</small>
          <strong>进入虚境</strong>
          <span>登录保存进度，游客可本机试玩</span>
```

```html
            <small>玩家认证</small>
            <h2 id="profile-auth-title">账号登录</h2>
```

```html
        <p id="profile-mode-hint" class="profile-note profile-auth-only">输入账号和密码读取云端存档；也可以选择游客试玩，本机进度不会同步到云端。</p>
```

```html
          <button id="profile-guest" class="profile-secondary" type="button">游客试玩</button>
          <button id="profile-submit" class="profile-submit" type="submit">登录进入</button>
```

- [ ] **Step 4: Preserve all required ids**

Run:

```powershell
rg -n "profile-panel|profile-entry-status|profile-guest|profile-submit|profile-create-confirm|profile-btn|profile-center-tabs" src/main.ts
```

Expected: every id appears at least once.

- [ ] **Step 5: Type-check through build**

Run:

```powershell
npm run build -- --base=/game/douyin-mini-rpg/
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/main.ts
git commit -m "Mount formal login scene"
```

## Task 5: Redesign Auth-Simple CSS and Motion

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Add formal login scene CSS**

Add this block after the existing `.profile-panel[hidden]` rule:

```css
.profile-login-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 8px;
  pointer-events: none;
  background: #06111d;
}

.profile-login-bg {
  position: absolute;
  inset: -4% -10% -2% -18%;
  width: 128%;
  height: 108%;
  object-fit: cover;
  object-position: center top;
  transform: translate3d(0, 0, 0);
  animation: loginHeroFloat 7s ease-in-out infinite alternate;
}

.profile-login-scene::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(2, 6, 23, 0.1) 0%, rgba(2, 6, 23, 0.18) 44%, rgba(2, 6, 23, 0.88) 78%, rgba(2, 6, 23, 0.96) 100%),
    radial-gradient(circle at 18% 18%, rgba(250, 204, 21, 0.14), transparent 30%),
    radial-gradient(circle at 82% 50%, rgba(94, 234, 212, 0.08), transparent 32%);
}

.profile-login-cloud {
  position: absolute;
  left: -35%;
  right: -35%;
  height: 36%;
  background:
    radial-gradient(ellipse at 12% 60%, rgba(226, 246, 255, 0.18), transparent 46%),
    radial-gradient(ellipse at 42% 50%, rgba(186, 230, 253, 0.16), transparent 42%),
    radial-gradient(ellipse at 76% 66%, rgba(255, 255, 255, 0.13), transparent 48%);
  filter: blur(1px);
  opacity: 0.75;
  transform: translate3d(0, 0, 0);
}

.profile-login-cloud--far {
  top: 22%;
  animation: loginCloudFar 50s linear infinite;
}

.profile-login-cloud--near {
  top: 48%;
  height: 42%;
  opacity: 0.58;
  animation: loginCloudNear 34s linear infinite;
}

.profile-login-cloud--front {
  bottom: 18%;
  height: 26%;
  opacity: 0.46;
  animation: loginCloudFront 24s linear infinite;
}

.profile-login-robe-flow {
  position: absolute;
  right: 0;
  top: 34%;
  width: 58%;
  height: 44%;
  opacity: 0.32;
  mix-blend-mode: screen;
  background:
    linear-gradient(110deg, transparent 0%, rgba(224, 242, 254, 0.22) 34%, transparent 52%),
    radial-gradient(ellipse at 42% 62%, rgba(94, 234, 212, 0.24), transparent 48%);
  clip-path: polygon(20% 16%, 76% 12%, 100% 52%, 82% 100%, 18% 88%, 0% 44%);
  animation: loginRobeFlow 2.6s ease-in-out infinite alternate;
}

.profile-login-sword-glow {
  position: absolute;
  right: 5%;
  bottom: 20%;
  width: 64%;
  height: 9%;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.16), rgba(250, 204, 21, 0.12), transparent);
  filter: blur(8px);
  transform: rotate(-8deg);
  animation: loginSwordGlow 1.9s ease-in-out infinite alternate;
}

@keyframes loginHeroFloat {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(0, -4px, 0) scale(1.006); }
}

@keyframes loginCloudFar {
  from { transform: translate3d(-4%, 0, 0); }
  to { transform: translate3d(10%, 0, 0); }
}

@keyframes loginCloudNear {
  from { transform: translate3d(8%, 0, 0); }
  to { transform: translate3d(-8%, 0, 0); }
}

@keyframes loginCloudFront {
  from { transform: translate3d(-2%, 0, 0); }
  to { transform: translate3d(12%, 0, 0); }
}

@keyframes loginRobeFlow {
  from { transform: translate3d(-4px, 2px, 0) skewX(-1deg); opacity: 0.22; }
  to { transform: translate3d(5px, -3px, 0) skewX(1deg); opacity: 0.42; }
}

@keyframes loginSwordGlow {
  from { opacity: 0.28; transform: rotate(-8deg) translateX(-4px); }
  to { opacity: 0.58; transform: rotate(-8deg) translateX(7px); }
}
```

- [ ] **Step 2: Replace auth-simple card sizing**

Replace the existing `.profile-panel.auth-simple .profile-card` rule with:

```css
.profile-panel.auth-simple .profile-card {
  position: relative;
  width: min(100%, 430px);
  min-height: min(860px, calc(100vh - 20px));
  max-height: calc(100vh - 20px);
  align-content: end;
  gap: 10px;
  overflow: hidden;
  padding: 18px;
  border-color: rgba(94, 234, 212, 0.46);
  background: rgba(2, 6, 23, 0.98);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.56);
}
```

- [ ] **Step 3: Add auth-simple foreground layout rules**

Add this block after the auth-simple card rule:

```css
.profile-panel.auth-simple .profile-brand,
.profile-panel.auth-simple .profile-head,
.profile-panel.auth-simple .profile-tabs,
.profile-panel.auth-simple .profile-note,
.profile-panel.auth-simple .profile-entry-status,
.profile-panel.auth-simple .profile-recent,
.profile-panel.auth-simple .profile-field,
.profile-panel.auth-simple .profile-error,
.profile-panel.auth-simple .profile-actions {
  position: relative;
  z-index: 2;
}

.profile-panel.auth-simple .profile-brand {
  align-self: start;
  min-height: 0;
  margin: 42px 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
}

.profile-panel.auth-simple .profile-brand small {
  color: #bae6fd;
  font-size: 13px;
}

.profile-panel.auth-simple .profile-brand strong {
  color: #fef3c7;
  font-size: 42px;
  line-height: 1;
  text-shadow: 0 5px 24px rgba(2, 6, 23, 0.72);
}

.profile-panel.auth-simple .profile-brand span {
  color: #dffafe;
  font-size: 14px;
}

.profile-panel.auth-simple .profile-head {
  align-items: end;
  margin-top: auto;
  padding: 14px 14px 0;
  border-radius: 8px 8px 0 0;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(10px);
}

.profile-panel.auth-simple .profile-head h2 {
  color: #fef3c7;
  font-size: 22px;
}

.profile-panel.auth-simple .profile-tabs,
.profile-panel.auth-simple .profile-note,
.profile-panel.auth-simple .profile-entry-status,
.profile-panel.auth-simple .profile-recent,
.profile-panel.auth-simple .profile-field,
.profile-panel.auth-simple .profile-error,
.profile-panel.auth-simple .profile-actions {
  margin-inline: 14px;
}

.profile-panel.auth-simple .profile-tabs {
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(10px);
}

.profile-panel.auth-simple .profile-field input {
  min-height: 48px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.78);
}

.profile-panel.auth-simple .profile-actions {
  margin-bottom: 14px;
  grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.28fr);
}

.profile-panel.auth-simple .profile-submit,
.profile-panel.auth-simple .profile-secondary {
  min-height: 54px;
  border-radius: 10px;
}

.profile-panel.auth-simple .profile-submit {
  box-shadow: 0 16px 42px rgba(94, 234, 212, 0.22);
}
```

- [ ] **Step 4: Add reduced-motion protection**

Add near the animation block:

```css
@media (prefers-reduced-motion: reduce) {
  .profile-login-bg,
  .profile-login-cloud,
  .profile-login-robe-flow,
  .profile-login-sword-glow {
    animation: none !important;
  }
}
```

- [ ] **Step 5: Run build**

Run:

```powershell
npm run build -- --base=/game/douyin-mini-rpg/
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/style.css
git commit -m "Redesign formal login entry"
```

## Task 6: Verify Login Flow and Visual Motion

**Files:**
- Modify only if verification exposes a concrete issue in `src/main.ts`, `src/style.css`, `src/profileFeedback.ts`, or `src/profileLoginScene.ts`.

- [ ] **Step 1: Run full unit tests**

Run:

```powershell
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build -- --base=/game/douyin-mini-rpg/
```

Expected: build completes without TypeScript or Vite errors.

- [ ] **Step 3: Run the game agent**

Run:

```powershell
npm run agent:test
```

Expected: PASS, including login entry checks for `#profile-panel`, `#profile-entry-status`, `#profile-guest`, and `#profile-submit`.

- [ ] **Step 4: Capture a login screenshot for human review**

Run this from the repo root while no dev server is running on port `5179`:

```powershell
$env:GAME_AGENT_PLAYTEST_MS='8000'
$env:GAME_AGENT_RANDOM_MS='6000'
npm run agent:test
Remove-Item Env:\GAME_AGENT_PLAYTEST_MS -ErrorAction SilentlyContinue
Remove-Item Env:\GAME_AGENT_RANDOM_MS -ErrorAction SilentlyContinue
```

Expected: a fresh folder under `artifacts/game-agent/` contains an early screenshot where the formal login entry is visible.

- [ ] **Step 5: Manual visual checklist**

Open the local game and check:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Expected:

- The login page reads as xianxia, not a utility form.
- The cloud layers move slowly.
- The robe shimmer layer reads as cloth/light movement and does not make the whole character shake.
- The sword glow does not look like an aircraft, spaceship, or oval wing.
- Login, register, guest, recent profile, and account center still work.

- [ ] **Step 6: Commit verification fixes if needed**

If Step 1 through Step 5 required code fixes, commit them:

```powershell
git add src/main.ts src/style.css src/profileFeedback.ts src/profileLoginScene.ts test/profileFeedback.test.js test/profileLoginScene.test.js
git commit -m "Fix formal login verification issues"
```

If no files changed, do not create an empty commit.

## Task 7: Final Integration

**Files:**
- No required file edits.

- [ ] **Step 1: Confirm worktree only contains intended changes**

Run:

```powershell
git status --short
```

Expected: clean working tree.

- [ ] **Step 2: Push to remote**

Run:

```powershell
git -c http.version=HTTP/1.1 -c http.sslBackend=openssl push origin main
```

Expected: push succeeds.

- [ ] **Step 3: Watch deployment**

Run:

```powershell
gh run list --branch main --limit 5
```

Then watch the newest run:

```powershell
gh run watch <newest-run-id> --exit-status
```

Expected: deployment run succeeds.

## Self-Review

- Spec coverage: Task 2 covers the approved non-abstract xianxia cover. Task 5 covers moving clouds, robe motion, sword glow, portrait login layout, and reduced-motion safety. Task 3 covers formal login/register/guest feedback. Task 4 preserves the existing account ids and separates login visuals from signed-in account center. Task 6 covers tests, build, game agent, and human visual checks.
- Placeholder scan: no unfinished markers, open-ended implementation notes, or missing file paths remain.
- Type consistency: `profileLoginHeroAsset` and `profileLoginSceneMarkup()` are defined in Task 1 and imported by `src/main.ts` in Task 4. Required DOM ids remain in `src/main.ts` and are verified before build.
