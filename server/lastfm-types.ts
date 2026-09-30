export interface LastFMTrack {
  title: string
  artist: string
  album?: string | null
}

export type LastFMConnectionState =
  | 'notConfigured'
  | 'notConnected'
  | 'checking'
  | 'connected'
  | 'failed'

export type LastFMConnectionProblem =
  | 'invalidAPIKey'
  | 'invalidSecret'
  | 'accessRevoked'
  | 'authorizationIncomplete'
  | 'unreachable'
  | { other: string }

export interface LastFMStatusResponse {
  configured: boolean
  state: LastFMConnectionState
  username?: string | null
  problem?: LastFMConnectionProblem | null
  message?: string
  lastChecked?: string | null
}

export interface LastFMSessionData {
  username: string
  sessionKey: string
}

export class LastFMAPIError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'LastFMAPIError'
    this.code = code
  }

  static readonly authenticationFailed = 4
  static readonly invalidSessionKey = 9
  static readonly invalidAPIKey = 10
  static readonly invalidSignature = 13
  static readonly unauthorizedToken = 14
  static readonly suspendedAPIKey = 26
}
