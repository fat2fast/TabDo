export class OfflineWriteError extends Error {
  constructor() {
    super('Không có kết nối. Thay đổi chưa được lưu; vui lòng thử lại khi có mạng.')
    this.name = 'OfflineWriteError'
  }
}

export class WriteBlockedForUpdateError extends Error {
  constructor() {
    super('Ứng dụng đang cập nhật. Vui lòng tải lại trước khi lưu thay đổi.')
    this.name = 'WriteBlockedForUpdateError'
  }
}

export class SessionVerificationError extends Error {
  constructor() {
    super('Chưa xác minh được phiên đăng nhập. Vui lòng thử lại.')
    this.name = 'SessionVerificationError'
  }
}

let pending = 0
let frozen = false
let sessionBlocked = false
let identityRevision = 0
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach(listener => listener())
}

export function getPendingWrites() { return pending }
export function areWritesFrozen() { return frozen }
export function getWriteIdentityRevision() { return identityRevision }
export function advanceWriteIdentity() { identityRevision += 1 }
export function canContinueWrite(revision: number) {
  return !sessionBlocked && revision === identityRevision && (typeof navigator === 'undefined' || navigator.onLine)
}
export function assertWriteIdentity(revision: number) {
  if (revision !== identityRevision) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.')
  if (sessionBlocked) throw new SessionVerificationError()
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new OfflineWriteError()
}
export function setSessionWritesBlocked(value: boolean) { sessionBlocked = value }
export function subscribeWrites(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setWritesFrozen(value: boolean) {
  if (frozen !== value) {
    frozen = value
    notify()
  }
}

export async function runGuardedWrite<T>(operation: () => PromiseLike<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new OfflineWriteError()
  if (frozen) throw new WriteBlockedForUpdateError()
  if (sessionBlocked) throw new SessionVerificationError()
  pending += 1
  notify()
  try {
    return await operation()
  } finally {
    pending -= 1
    notify()
  }
}
