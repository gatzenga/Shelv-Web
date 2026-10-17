import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { Semaphore } from './semaphore.ts'

test('no more than the limit run at once, and all of them run', async () => {
  const semaphore = new Semaphore(3)
  let running = 0
  let most = 0
  let done = 0

  await Promise.all(
    Array.from({ length: 20 }, async () => {
      const release = await semaphore.acquire()
      running++
      most = Math.max(most, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      done++
      release()
    }),
  )

  assert.equal(most, 3)
  assert.equal(done, 20)
})

test('releasing twice does not give away a second place', async () => {
  const semaphore = new Semaphore(1)
  const release = await semaphore.acquire()
  release()
  release()

  let running = 0
  let most = 0
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      const done = await semaphore.acquire()
      running++
      most = Math.max(most, running)
      await new Promise((resolve) => setTimeout(resolve, 2))
      running--
      done()
    }),
  )

  assert.equal(most, 1)
})
