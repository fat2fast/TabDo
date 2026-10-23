import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makePurgeResult, validateWorkerSecret, isOwnedObjectPath } from '../../supabase/functions/purge-deleted-tasks/contract.ts'
import { verifyPurgeResponse } from '../verify-purge-worker-response.ts'

const dedicated = '0123456789abcdef0123456789abcdef'

test('missing, weak, or wrong secrets fail; only matching dedicated secret passes', () => {
  assert.equal(validateWorkerSecret(null, dedicated), false)
  assert.equal(validateWorkerSecret('wrong', dedicated), false)
  assert.equal(validateWorkerSecret(dedicated, 'short'), false)
  assert.equal(validateWorkerSecret(dedicated, dedicated), true)
})

test('empty purge is a success with explicit zero counts', () => {
  const result = makePurgeResult(0, 0, [])
  assert.deepEqual(result, { success: true, processedCount: 0, purgedCount: 0, skippedCount: 0, errorCount: 0, errorCategories: [] })
  assert.equal(verifyPurgeResponse('200', JSON.stringify(result)).ok, true)
})

test('partial storage or DB error fails without returning task IDs', () => {
  const result = makePurgeResult(3, 1, ['storage_remove', 'db_purge'])
  assert.equal(result.success, false)
  assert.equal(result.errorCount, 2)
  assert.equal(verifyPurgeResponse('200', JSON.stringify(result)).ok, false)
  assert.equal(verifyPurgeResponse('503', JSON.stringify(result)).ok, false)
  assert.equal(JSON.stringify(result).includes('taskId'), false)
})

test('safe concurrent-skip result succeeds only when counters add up', () => {
  assert.equal(verifyPurgeResponse('200', JSON.stringify(makePurgeResult(2, 1, [], 1))).ok, true)
  assert.equal(verifyPurgeResponse('200', JSON.stringify(makePurgeResult(2, 1, [], 0))).ok, false)
})

test('invalid HTML/JSON or inconsistent response must fail closed', () => {
  assert.equal(verifyPurgeResponse('200', '<html>oops</html>').ok, false)
  assert.equal(verifyPurgeResponse('200', JSON.stringify({ success: true })).ok, false)
  assert.equal(verifyPurgeResponse('401', JSON.stringify(makePurgeResult(0, 0, []))).ok, false)
})

test('privileged removal rejects other-task or malformed paths', () => {
  const user = 'a0000000-0000-0000-0000-000000000001'
  const task = '11111111-1111-1111-1111-111111111111'
  assert.equal(isOwnedObjectPath(`${user}/${task}/file.txt`, user, task), true)
  assert.equal(isOwnedObjectPath(`${user}/22222222-2222-2222-2222-222222222222/file.txt`, user, task), false)
  assert.equal(isOwnedObjectPath(`${user}/${task}/../file.txt`, user, task), false)
  assert.equal(isOwnedObjectPath(null, user, task), false)
})
