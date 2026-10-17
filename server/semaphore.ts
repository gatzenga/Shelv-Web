// Lets only a few things run at once, the rest waits its turn
export class Semaphore {
  private running = 0
  private readonly waiting: (() => void)[] = []
  private readonly limit: number

  constructor(limit: number) {
    this.limit = limit
  }

  // Resolves with the function to call when the work is done
  async acquire() {
    if (this.running >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve))
    } else {
      this.running++
    }

    let released = false

    return () => {
      if (released) return
      released = true

      const next = this.waiting.shift()
      if (next) next()
      else this.running--
    }
  }
}
