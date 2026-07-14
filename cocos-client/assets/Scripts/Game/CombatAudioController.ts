import { _decorator, AudioClip, AudioSource, Component, JsonAsset, Node, resources } from 'cc'
import type { FeedbackRequest } from '../Combat/FeedbackTimeline.ts'

const { ccclass, property } = _decorator

interface AudioCatalogEntry {
  title: string
  description: string
  resource: string
  minDurationSeconds: number
  loop?: boolean
  volume?: number
}

interface AudioCatalog {
  bgm: Record<string, AudioCatalogEntry>
  cues: Record<string, AudioCatalogEntry>
}

interface FeedbackPayload {
  requests?: readonly FeedbackRequest[]
}

@ccclass('CombatAudioController')
export class CombatAudioController extends Component {
  @property(AudioSource)
  public musicSource: AudioSource | null = null

  @property(AudioSource)
  public sfxSource: AudioSource | null = null

  private catalog: AudioCatalog | null = null
  private clipCache = new Map<string, AudioClip>()
  private feedbackSources = new Set<Node>()
  private pendingBgmKey: string | null = null

  onLoad() {
    this.musicSource ??= this.node.addComponent(AudioSource)
    this.sfxSource ??= this.node.addComponent(AudioSource)
    this.loadCatalog()
    this.startBgm('mist-bamboo')
  }

  onDestroy() {
    for (const source of this.feedbackSources) source.off('combat-feedback-requested', this.onCombatFeedback, this)
    this.feedbackSources.clear()
  }

  bindFeedbackSource(source: Node | null) {
    if (!source || this.feedbackSources.has(source)) return
    this.feedbackSources.add(source)
    source.on('combat-feedback-requested', this.onCombatFeedback, this)
  }

  startBgm(key: string) {
    this.pendingBgmKey = key
    const entry = this.catalog?.bgm[key]
    if (!entry || !this.musicSource) return
    this.loadClip(entry, (clip) => {
      if (this.pendingBgmKey !== key || !this.musicSource || !clip) return
      this.musicSource.clip = clip
      this.musicSource.loop = true
      this.musicSource.volume = entry.volume ?? 0.4
      this.musicSource.play()
    })
  }

  private loadCatalog() {
    resources.load('Data/audio-catalog', JsonAsset, (error, asset) => {
      if (error || !asset || !this.node.isValid) return
      this.catalog = asset.json as AudioCatalog
      if (this.pendingBgmKey) this.startBgm(this.pendingBgmKey)
    })
  }

  private onCombatFeedback(payload: FeedbackPayload) {
    for (const request of payload.requests ?? []) {
      if (request.kind !== 'audio-cue' || !request.key) continue
      this.scheduleOnce(() => this.playCue(request.key ?? '', request.strength), request.atMs / 1000)
    }
  }

  private playCue(key: string, strength: number) {
    const entry = this.catalog?.cues[key]
    if (!entry || !this.sfxSource) return
    this.loadClip(entry, (clip) => {
      if (!clip || !this.sfxSource || !this.node.isValid) return
      const volume = Math.max(0, Math.min(1, (entry.volume ?? 0.75) * Math.max(0.2, strength)))
      this.sfxSource.playOneShot(clip, volume)
    })
  }

  private loadClip(entry: AudioCatalogEntry, done: (clip: AudioClip | null) => void) {
    const cached = this.clipCache.get(entry.resource)
    if (cached) {
      done(cached)
      return
    }
    resources.load(entry.resource, AudioClip, (error, clip) => {
      if (error || !clip || !this.node.isValid) {
        done(null)
        return
      }
      this.clipCache.set(entry.resource, clip)
      done(clip)
    })
  }
}
