const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const ts = require('typescript')

function loadTs(file, overrides = {}, env = {}) {
  const filename = path.resolve(__dirname, '..', file)
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports,
    require: (name) => overrides[name] || require(name),
    process: { env, cwd: () => path.dirname(__dirname) },
    console, Buffer, setTimeout, clearTimeout, URL, AbortController,
  }, { filename })
  return exports
}

const merge = loadTs('lib/contract-weekly-selection.ts')
const row = (id, checked = false, time = '2026-09-15T00:00:00Z') => ({
  id, idCode: id, includedInWeekly: checked, includedInWeeklyUpdatedAt: time,
})
const mergeRows = (previous, incoming, deleted = []) =>
  JSON.parse(merge.mergeContractSelectionJson(JSON.stringify(previous), JSON.stringify(incoming), deleted))

test('stale two-row snapshot cannot remove three checked contracts', () => {
  const previous = ['E260289', 'E260288', 'E260287', 'E260338', 'E260362'].map(id => row(id, true))
  const saved = mergeRows(previous, previous.slice(3))
  assert.equal(saved.length, 5)
  assert.equal(saved.filter(item => item.includedInWeekly).length, 5)
})

test('older and equal checkbox versions preserve current selection; newer uncheck is accepted', () => {
  const previous = [row('one', true)]
  assert.equal(mergeRows(previous, [row('one', false)])[0].includedInWeekly, true)
  assert.equal(mergeRows(previous, [row('one', false, '2026-09-14T00:00:00Z')])[0].includedInWeekly, true)
  assert.equal(mergeRows(previous, [row('one', false, '2026-09-16T00:00:00Z')])[0].includedInWeekly, false)
})

test('ordinary field edits still persist without unchecking', () => {
  const saved = mergeRows([row('one', true)], [{ ...row('one'), departmentName: 'Updated' }])
  assert.equal(saved[0].departmentName, 'Updated')
  assert.equal(saved[0].includedInWeekly, true)
})

test('explicit deletions block stale resurrection, but a new record identity can be restored', () => {
  const previous = [row('one', true), row('two')]
  const saved = mergeRows(previous, previous, ['one'])
  assert.equal(saved.length, 1)
  assert.equal(mergeRows(saved, previous, ['one']).length, 1)
  assert.equal(mergeRows(saved, [...previous, row('restored-one')], ['one']).length, 2)
})

function memoryRedis() {
  const values = new Map()
  let conflicts = 0
  // Emulate only Redis primitives used by the store; no network or production environment is used.
  async function redisCommand(_url, command) {
    if (command[0] === 'MGET') return command.slice(1).map(key => values.get(key) ?? null)
    if (command[0] === 'GET') return values.get(command[1]) ?? null
    if (command[0] === 'EVAL') {
      assert.equal(command[1], merge.CONTRACT_SELECTION_CAS)
      const keys = command.slice(3, 3 + Number(command[2]))
      const args = command.slice(3 + Number(command[2]))
      if ((values.get(keys[0]) || '') !== args[0] || (values.get(keys[1]) || '') !== args[1]) {
        conflicts++
        return 0
      }
      keys.forEach((key, i) => values.set(key, args[i + 2]))
      return 1
    }
    throw new Error(`Unexpected Redis command: ${command[0]}`)
  }
  const store = loadTs('lib/shared-db-store.ts', {
    '@/lib/redis-client': { redisCommand },
    '@/lib/contract-weekly-selection': merge,
  }, { REDIS_URL: 'redis://test.invalid', NODE_ENV: 'production' })
  return { store, values, conflicts: () => conflicts }
}

test('concurrent writes retry against latest data and preserve all five selections', async () => {
  const db = memoryRedis()
  const initial = ['a', 'b', 'c', 'd', 'e'].map(id => row(id))
  await db.store.writeDashboardState({ contracts: initial }, undefined, ['contracts'])
  await Promise.all(initial.map((item) => db.store.writeDashboardState({
    contracts: initial.map(other => other.id === item.id ? row(other.id, true, '2026-09-16T00:00:00Z') : other),
  }, undefined, ['contracts'])))
  const saved = await db.store.readDashboardStateSlices(['contracts'])
  assert.equal(saved.contracts.filter(item => item.includedInWeekly).length, 5)
  assert.ok(db.conflicts() > 0)
})

test('storage persists deletion tombstones across subsequent stale saves', async () => {
  const db = memoryRedis()
  const initial = [row('one'), row('two')]
  await db.store.writeDashboardState({ contracts: initial }, undefined, ['contracts'])
  await db.store.writeDashboardState({ contracts: [initial[1]], collection: { integrated: [{ id: 'moved' }] } },
    undefined, ['contracts', 'collection'], ['one'])
  await db.store.writeDashboardState({ contracts: initial }, undefined, ['contracts'])
  const saved = await db.store.readDashboardStateSlices(['contracts', 'collection'])
  assert.equal(saved.contracts.length, 1)
  assert.equal(saved.contracts[0].id, 'two')
  assert.equal(saved.collection.integrated.length, 1)
  const history = JSON.parse(db.values.get('shared-kv:value:dashboard_contract_history'))
  assert.equal(history.at(-1).contracts.length, 2)
})

test('history retains the last 20 pre-save snapshots and skips unchanged writes', () => {
  let history = null
  for (let i = 0; i < 25; i++) {
    history = merge.appendContractHistory(history, JSON.stringify([row(String(i))]), JSON.stringify([row(String(i + 1))]), 'test')
  }
  const entries = JSON.parse(history)
  assert.equal(entries.length, 20)
  assert.equal(entries[0].contracts[0].id, '5')
  assert.equal(merge.appendContractHistory(history, '[]', '[]', 'same'), history)
})

test('UI sends explicit removal only for delete and collection move, never for edit', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../components/dashboard-shell.tsx'), 'utf8')
  const edit = source.slice(source.indexOf('function handleContractUpdate('), source.indexOf('function handleContractDelete('))
  const remove = source.slice(source.indexOf('function handleContractDelete('), source.indexOf('function handleCollectionDelete('))
  assert.ok(!edit.includes('deletedContractIds'))
  assert.ok(remove.includes('deletedContractIds: [contractId]'))
  assert.ok(source.includes('deletedContractIds: Array.from(selectedIds)'))
})
