// The approval at Last.fm: an administrator asks for a token, the browser
// sends them to Last.fm, and the token is completed once they have approved.
// Only that one token counts. The page Last.fm sends the browser back to is
// open to everybody, so anything else that arrives there is not even looked at.
const lifetime = 10 * 60 * 1000

export class PendingApproval {
  private token: string | null = null
  private expiresAt = 0
  private isDone = false

  start(token: string) {
    this.token = token
    this.expiresAt = Date.now() + lifetime
    this.isDone = false
  }

  // 'open': to be completed with Last.fm, 'done': it already worked,
  // 'unknown': not the token we are waiting for
  check(token: string): 'open' | 'done' | 'unknown' {
    if (!this.token || token !== this.token || Date.now() > this.expiresAt) {
      return 'unknown'
    }

    return this.isDone ? 'done' : 'open'
  }

  // the poll of the dialog and the page of Last.fm can both bring the token
  finish() {
    this.isDone = true
  }
}
