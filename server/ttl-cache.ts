// Small in-memory cache with expiry. Concurrent lookups of the same key share
// one pending promise, so e.g. many listeners polling one station cause a
// single upstream request.
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>()
  private readonly pending = new Map<string, Promise<V>>()
  private readonly maxEntries: number

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries
  }

  async getOrLoad(
    key: string,
    ttlFor: (value: V) => number,
    load: () => Promise<V>,
  ): Promise<V> {
    const entry = this.entries.get(key)
    if (entry && entry.expiresAt > Date.now()) return entry.value

    const running = this.pending.get(key)
    if (running) return running

    const promise = load()
      .then((value) => {
        this.prune()
        this.entries.set(key, { value, expiresAt: Date.now() + ttlFor(value) })
        return value
      })
      .finally(() => {
        this.pending.delete(key)
      })

    this.pending.set(key, promise)

    return promise
  }

  delete(key: string) {
    this.entries.delete(key)
  }

  // Expired entries are removed, so large values (e.g. full album lists)
  // do not stay in memory after their lifetime
  private prune() {
    const now = Date.now()

    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key)
    }

    if (this.entries.size >= this.maxEntries) this.entries.clear()
  }
}
