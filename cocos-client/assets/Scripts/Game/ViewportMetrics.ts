export interface ViewportMetrics {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly topInsetPx: number
  readonly bottomInsetPx: number
  readonly source: 'douyin' | 'browser' | 'cocos'
}

interface EventTargetLike {
  addEventListener?: (type: string, listener: () => void) => void
  removeEventListener?: (type: string, listener: () => void) => void
}

interface VisualViewportLike extends EventTargetLike {
  width: number
  height: number
  offsetTop: number
}

interface BrowserWindowLike extends EventTargetLike {
  innerWidth: number
  innerHeight: number
  visualViewport?: VisualViewportLike | null
}

interface DouyinSystemInfo {
  windowWidth?: number
  windowHeight?: number
  safeArea?: { top?: number; bottom?: number } | null
}

interface DouyinApiLike {
  getSystemInfoSync?: () => DouyinSystemInfo
  onWindowResize?: (listener: () => void) => void
  offWindowResize?: (listener: () => void) => void
}

export interface ViewportMetricsEnvironment {
  readonly tt?: DouyinApiLike | null
  readonly browserWindow?: BrowserWindowLike | null
  readonly probeBrowserSafeArea?: () => { top: number; bottom: number }
  readonly getFrameSize: () => { width: number; height: number }
}

export interface ViewportMetricsProvider {
  read(): Readonly<ViewportMetrics>
  subscribe(listener: (metrics: Readonly<ViewportMetrics>) => void): () => void
  destroy(): void
}

const MAX_VIEWPORT_DIMENSION = 1_000_000

function isDimension(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && value <= MAX_VIEWPORT_DIMENSION
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function freezeMetrics(
  cssWidth: number,
  cssHeight: number,
  topInsetPx: number,
  bottomInsetPx: number,
  source: ViewportMetrics['source'],
): Readonly<ViewportMetrics> {
  const top = clamp(finiteNonNegative(topInsetPx), 0, cssHeight)
  const bottom = clamp(finiteNonNegative(bottomInsetPx), 0, cssHeight - top)
  return Object.freeze({ cssWidth, cssHeight, topInsetPx: top, bottomInsetPx: bottom, source })
}

function readDouyinMetrics(tt: DouyinApiLike | null | undefined): Readonly<ViewportMetrics> | null {
  if (!tt?.getSystemInfoSync) return null
  let info: DouyinSystemInfo
  try {
    info = tt.getSystemInfoSync()
  } catch {
    return null
  }
  if (!isDimension(info?.windowWidth) || !isDimension(info?.windowHeight)) return null
  const top = finiteNonNegative(info.safeArea?.top)
  const safeBottom = info.safeArea?.bottom
  const bottom = typeof safeBottom === 'number' && Number.isFinite(safeBottom)
    ? info.windowHeight - safeBottom
    : 0
  return freezeMetrics(info.windowWidth, info.windowHeight, top, bottom, 'douyin')
}

function readBrowserMetrics(environment: ViewportMetricsEnvironment): Readonly<ViewportMetrics> | null {
  const browserWindow = environment.browserWindow
  if (!browserWindow) return null
  const viewport = browserWindow.visualViewport
  const cssWidth = isDimension(browserWindow.innerWidth) ? browserWindow.innerWidth : viewport?.width
  const cssHeight = isDimension(browserWindow.innerHeight) ? browserWindow.innerHeight : viewport?.height
  if (!isDimension(cssWidth) || !isDimension(cssHeight)) return null
  const probe = environment.probeBrowserSafeArea?.() ?? { top: 0, bottom: 0 }
  const offsetTop = finiteNonNegative(viewport?.offsetTop)
  const layoutHeight = isDimension(browserWindow.innerHeight) ? browserWindow.innerHeight : cssHeight + offsetTop
  const visualHeight = isDimension(viewport?.height) ? viewport.height : layoutHeight - offsetTop
  const occludedBottom = viewport ? Math.max(0, layoutHeight - offsetTop - visualHeight) : 0
  return freezeMetrics(
    cssWidth,
    cssHeight,
    finiteNonNegative(probe.top) + offsetTop,
    finiteNonNegative(probe.bottom) + occludedBottom,
    'browser',
  )
}

function readCocosMetrics(getFrameSize: ViewportMetricsEnvironment['getFrameSize']): Readonly<ViewportMetrics> {
  const frame = getFrameSize()
  const width = isDimension(frame?.width) ? frame.width : 750
  const height = isDimension(frame?.height) ? frame.height : 1334
  return freezeMetrics(width, height, 0, 0, 'cocos')
}

class RuntimeViewportMetricsProvider implements ViewportMetricsProvider {
  readonly #environment: ViewportMetricsEnvironment
  readonly #listeners = new Map<(metrics: Readonly<ViewportMetrics>) => void, number>()
  readonly #nativeListener = () => {
    const metrics = this.read()
    for (const listener of this.#listeners.keys()) listener(metrics)
  }
  #subscriptionCount = 0
  #listening = false

  constructor(environment: ViewportMetricsEnvironment) {
    this.#environment = environment
  }

  read(): Readonly<ViewportMetrics> {
    return readDouyinMetrics(this.#environment.tt)
      ?? readBrowserMetrics(this.#environment)
      ?? readCocosMetrics(this.#environment.getFrameSize)
  }

  subscribe(listener: (metrics: Readonly<ViewportMetrics>) => void): () => void {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function')
    this.#listeners.set(listener, (this.#listeners.get(listener) ?? 0) + 1)
    this.#subscriptionCount += 1
    if (!this.#listening) this.#attachNativeListeners()
    let active = true
    return () => {
      if (!active) return
      active = false
      const count = this.#listeners.get(listener) ?? 0
      if (count <= 1) this.#listeners.delete(listener)
      else this.#listeners.set(listener, count - 1)
      this.#subscriptionCount = Math.max(0, this.#subscriptionCount - 1)
      if (this.#subscriptionCount === 0) this.#detachNativeListeners()
    }
  }

  destroy(): void {
    this.#listeners.clear()
    this.#subscriptionCount = 0
    this.#detachNativeListeners()
  }

  #attachNativeListeners(): void {
    if (this.#listening) return
    this.#listening = true
    const browserWindow = this.#environment.browserWindow
    browserWindow?.addEventListener?.('resize', this.#nativeListener)
    browserWindow?.visualViewport?.addEventListener?.('resize', this.#nativeListener)
    browserWindow?.visualViewport?.addEventListener?.('scroll', this.#nativeListener)
    this.#environment.tt?.onWindowResize?.(this.#nativeListener)
  }

  #detachNativeListeners(): void {
    if (!this.#listening) return
    this.#listening = false
    const browserWindow = this.#environment.browserWindow
    browserWindow?.removeEventListener?.('resize', this.#nativeListener)
    browserWindow?.visualViewport?.removeEventListener?.('resize', this.#nativeListener)
    browserWindow?.visualViewport?.removeEventListener?.('scroll', this.#nativeListener)
    this.#environment.tt?.offWindowResize?.(this.#nativeListener)
  }
}

export function createViewportMetricsProvider(environment: ViewportMetricsEnvironment): ViewportMetricsProvider {
  if (!environment || typeof environment.getFrameSize !== 'function') {
    throw new TypeError('getFrameSize must be provided')
  }
  return new RuntimeViewportMetricsProvider(environment)
}

function probeCssSafeArea(): { top: number; bottom: number } {
  const globalObject = globalThis as typeof globalThis & {
    document?: {
      body?: { appendChild(node: unknown): void }
      documentElement?: { appendChild(node: unknown): void }
      createElement(tag: string): {
        style: { cssText: string }
        remove(): void
      }
    }
    getComputedStyle?: (node: unknown) => { paddingTop?: string; paddingBottom?: string }
  }
  const document = globalObject.document
  const parent = document?.body ?? document?.documentElement
  if (!document || !parent || typeof globalObject.getComputedStyle !== 'function') return { top: 0, bottom: 0 }
  let probe: ReturnType<typeof document.createElement> | null = null
  let failed = false
  let result = { top: 0, bottom: 0 }
  try {
    probe = document.createElement('div')
    probe.style.cssText = [
      'position:fixed',
      'visibility:hidden',
      'pointer-events:none',
      'padding-top:env(safe-area-inset-top)',
      'padding-bottom:env(safe-area-inset-bottom)',
    ].join(';')
    parent.appendChild(probe)
    const style = globalObject.getComputedStyle(probe)
    result = {
      top: finiteNonNegative(Number.parseFloat(style.paddingTop ?? '0')),
      bottom: finiteNonNegative(Number.parseFloat(style.paddingBottom ?? '0')),
    }
  } catch {
    failed = true
  } finally {
    try {
      probe?.remove()
    } catch {
      failed = true
    }
  }
  return failed ? { top: 0, bottom: 0 } : result
}

export function createDefaultViewportMetricsProvider(
  getFrameSize: ViewportMetricsEnvironment['getFrameSize'],
): ViewportMetricsProvider {
  const globalObject = globalThis as typeof globalThis & {
    tt?: DouyinApiLike
    window?: BrowserWindowLike
  }
  return createViewportMetricsProvider({
    tt: globalObject.tt ?? null,
    browserWindow: globalObject.window ?? null,
    probeBrowserSafeArea: probeCssSafeArea,
    getFrameSize,
  })
}
