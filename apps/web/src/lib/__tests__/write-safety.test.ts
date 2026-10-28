import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPendingWrites, OfflineWriteError, runGuardedWrite, setWritesFrozen, subscribeWrites, WriteBlockedForUpdateError } from '../write-safety'

afterEach(() => {
  setWritesFrozen(false)
  vi.restoreAllMocks()
})

describe('write safety', () => {
  it('rejects offline without invoking or replaying the operation', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const write = vi.fn(async () => 'saved')
    await expect(runGuardedWrite(write)).rejects.toBeInstanceOf(OfflineWriteError)
    expect(write).not.toHaveBeenCalled()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    expect(write).not.toHaveBeenCalled()
  })

  it('tracks pending until completion, including failure', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeWrites(listener)
    let reject!: (reason: Error) => void
    const result = runGuardedWrite(() => new Promise<void>((_resolve, fail) => { reject = fail }))
    expect(getPendingWrites()).toBe(1)
    reject(new Error('failed'))
    await expect(result).rejects.toThrow('failed')
    expect(getPendingWrites()).toBe(0)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('blocks new writes during activation', async () => {
    setWritesFrozen(true)
    const write = vi.fn(async () => undefined)
    await expect(runGuardedWrite(write)).rejects.toBeInstanceOf(WriteBlockedForUpdateError)
    expect(write).not.toHaveBeenCalled()
  })
})
