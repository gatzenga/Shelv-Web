import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { logger } from './logger.ts'

const maxEntries = 200
const maxFileLines = 2000
const keepFileLines = 1000

export class ServiceLog {
  private _entries: string[] = []
  private logsDir: string
  private logFilePath: string
  private isDirEnsured = false
  private fileName: string
  private label: string

  constructor(logsDir: string, fileName = 'lastfm.log', label = 'Last.fm') {
    this.logsDir = logsDir
    this.fileName = fileName
    this.label = label
    this.logFilePath = join(logsDir, fileName)
  }

  setLogsDir(logsDir: string) {
    this.logsDir = logsDir
    this.logFilePath = join(logsDir, this.fileName)
    this.isDirEnsured = false
  }

  get entries(): string[] {
    return [...this._entries]
  }

  getEntries(): string[] {
    return [...this._entries]
  }

  async clear(): Promise<void> {
    this._entries = []
    try {
      await this.ensureDir()
      await writeFile(this.logFilePath, '', 'utf8')
    } catch (error) {
      logger.warn(`Failed to clear ${this.fileName} file`, error)
    }
  }

  success(message: string): void {
    this.add(`✓ ${message}`)
  }

  failure(message: string): void {
    this.add(`✗ ${message}`)
  }

  info(message: string): void {
    this.add(`• ${message}`)
  }

  // Takes over what an earlier run wrote, so the log carries on where it
  // stopped. A file that grew large is cut back to its recent lines.
  async load(): Promise<void> {
    try {
      const lines = (await readFile(this.logFilePath, 'utf8'))
        .split('\n')
        .filter(Boolean)

      this._entries = lines
        .slice(-maxEntries)
        .reverse()
        .map((line) => {
          const match = /^\[([^\]]+)\] (.*)$/.exec(line)
          const date = match ? new Date(match[1]) : null
          if (!match || !date || Number.isNaN(date.getTime())) return line

          return `[${date.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}] ${match[2]}`
        })

      if (lines.length > maxFileLines) {
        await writeFile(
          this.logFilePath,
          `${lines.slice(-keepFileLines).join('\n')}\n`,
          'utf8',
        )
      }
    } catch {
      // No log file yet
    }
  }

  async init(): Promise<void> {
    try {
      await this.ensureDir()
      await appendFile(this.logFilePath, '', 'utf8')
      this.info(`${this.label} logging initialized`)
    } catch (error) {
      logger.error(
        `Failed to initialize ${this.fileName} at ${this.logFilePath}`,
        error,
      )
    }
  }

  private async ensureDir(): Promise<void> {
    if (this.isDirEnsured) return
    try {
      await mkdir(this.logsDir, { recursive: true })
      this.isDirEnsured = true
    } catch {
      // Ignore directory creation errors if already exists
    }
  }

  private add(line: string): void {
    const now = new Date()
    const stamp = now.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const entry = `[${stamp}] ${line}`
    const fileLine = `[${now.toISOString()}] ${line}\n`

    this._entries.unshift(entry)
    if (this._entries.length > maxEntries) {
      this._entries.pop()
    }

    logger.info(`[${this.label}] ${line}`)

    this.ensureDir()
      .then(() => appendFile(this.logFilePath, fileLine, 'utf8'))
      .catch((error) => {
        logger.error(
          `Failed to append to ${this.fileName} at ${this.logFilePath}`,
          error,
        )
      })
  }
}

export const lastfmLog = new ServiceLog(process.env.LOGS_DIR || '/logs')
