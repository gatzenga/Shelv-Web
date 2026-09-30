// Per station settings the Subsonic API has no place for, kept in
// <config>/azuracast.json: whether the now playing data comes from the
// AzuraCast API, where that API is and whether the song cover is shown.
// The stations themselves stay in Navidrome, the file only refers to their id.
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { logger } from './logger.ts'

export interface RadioSettings {
  // only there to make the file readable, the station lives in Navidrome
  name?: string
  useAzuraCastApi: boolean
  apiUrl: string
  showSongCover: boolean
}

export type RadioSettingsMap = Record<string, RadioSettings>

const maxUrlLength = 2000

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

// Anything that does not fit is dropped, the file can be edited by hand
export function parseRadioSettings(value: unknown): RadioSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const input = value as Record<string, unknown>
  const apiUrl = typeof input.apiUrl === 'string' ? input.apiUrl.trim() : ''

  if (apiUrl && (apiUrl.length > maxUrlLength || !isHttpUrl(apiUrl)))
    return null

  const name = typeof input.name === 'string' ? input.name.slice(0, 200) : ''

  return {
    ...(name ? { name } : {}),
    useAzuraCastApi: input.useAzuraCastApi === true,
    apiUrl,
    showSongCover: input.showSongCover !== false,
  }
}

export class RadioSettingsStore {
  private settings: RadioSettingsMap = {}
  private modifiedAt = -1
  private writing: Promise<void> = Promise.resolve()
  private file: string

  constructor(file: string) {
    this.file = file
  }

  // The file is read again when it changed on disk, so edits by hand apply
  // without a restart
  private async refresh() {
    try {
      const { mtimeMs } = await stat(this.file)
      if (mtimeMs === this.modifiedAt) return

      const parsed = JSON.parse(await readFile(this.file, 'utf-8')) as unknown
      const next: RadioSettingsMap = {}

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [id, value] of Object.entries(parsed)) {
          const settings = parseRadioSettings(value)
          if (settings) next[id] = settings
        }
      }

      this.settings = next
      this.modifiedAt = mtimeMs
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn(`could not read ${this.file}`, error)
      }
      this.settings = {}
      this.modifiedAt = -1
    }
  }

  async all() {
    await this.refresh()
    return this.settings
  }

  async get(id: string) {
    await this.refresh()
    return this.settings[id]
  }

  // null removes the station from the file
  set(id: string, settings: RadioSettings | null) {
    const run = async () => {
      await this.refresh()

      const next = { ...this.settings }
      if (settings) next[id] = settings
      else delete next[id]

      // Plain defaults, no chmod: the file gets the rights of the folder
      await mkdir(dirname(this.file), { recursive: true })
      const temporary = `${this.file}.tmp`
      await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf-8')
      await rename(temporary, this.file)

      this.settings = next
      this.modifiedAt = (await stat(this.file)).mtimeMs
    }

    // writes run one after the other, so none of them loses another's change
    const result = this.writing.then(run, run)
    this.writing = result.catch(() => {})
    return result
  }
}
