const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const api = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/daily-activity.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: api })
const now = new Date('2026-09-16T00:00:00Z')
const rows = [
  { id: 'yesterday', createdAt: '2026-09-15T14:59:59Z', actorUserId: 'one' },
  { id: 'midnight', createdAt: '2026-09-15T15:00:00Z', actorUserId: 'one', actionType: 'login', ipAddress: 'private', sessionId: 'private' },
  { id: 'other', createdAt: '2026-09-16T00:00:00Z', actorUserId: 'two' },
  { id: 'invalid', createdAt: 'bad-date', actorUserId: 'one' },
]
test('Korean midnight boundary and own-record permissions', () => {
  const result = api.dailyActivityRows(rows, 'one', false, now)
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'midnight')
  assert.equal(result[0].label, '로그인')
  assert.equal(result[0].ipAddress, undefined)
  assert.equal(result[0].sessionId, undefined)
})
test('authorized daily records are newest first', () => {
  const result = api.dailyActivityRows(rows, 'one', true, now)
  assert.equal(result.length, 2)
  assert.equal(result[0].id, 'other')
})
test('panel payload is bounded to 100 rows', () => {
  assert.equal(api.dailyActivityRows(Array.from({ length: 120 }, (_, id) => ({ ...rows[1], id: String(id) })), 'one', true, now).length, 100)
})
