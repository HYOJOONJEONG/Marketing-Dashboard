const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../app/api/dashboard/route.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText

function loadRoute({ legacy = false, writeError = null } = {}) {
  const calls = { fullReads: 0, writes: [] }
  const ui = { theme: 'light', menuUpdatedAt: { contracts: 'previous' }, manualWeeklyRestore: { id: 'keep' } }
  const mocks = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/auth/permissions': { buildPermissionIndex: () => ({}), hasPermission: () => true },
    '@/lib/auth/server': { getRequestIp: () => '127.0.0.1' },
    '@/lib/auth/store': { updateAuthState: async (fn) => fn({}), appendActivityLog: () => {} },
    '@/lib/auth/session': { resolveRequestSession: async () => ({ state: {}, user: { id: 'test', name: 'Test' } }) },
    '@/lib/manual-weekly-restore': {},
    '@/lib/shared-db-store': {
      readDashboardStateSlices: async (keys) => {
        assert.deepEqual(Array.from(keys), ['ui'])
        return legacy ? null : { ui }
      },
      readDashboardState: async () => { calls.fullReads++; return { ui, contracts: [{ id: 'untouched' }] } },
      writeDashboardState: async (data, meta, keys) => {
        if (writeError) throw new Error(writeError)
        calls.writes.push({ data, keys: Array.from(keys) })
      },
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    exports: module.exports, module, process, console, Error,
    require: (name) => name === 'path' ? path : mocks[name] || assert.fail(`Unexpected import ${name}`),
  })
  return { PUT: module.exports.PUT, calls }
}

function request() {
  return new Request('http://localhost/api/dashboard', {
    method: 'PUT',
    body: JSON.stringify({
      partial: true, sourceViews: ['type-analysis'], changedKeys: ['typeAnalysis', 'ui'],
      data: { typeAnalysis: { newReplacement: { records: [{ id: 'new-1' }] } }, ui: { menuUpdatedAt: { 'type-analysis': 'now' } } },
    }),
  })
}

for (const legacy of [false, true]) {
  test(`type analysis save preserves UI and limits written slices (legacy=${legacy})`, async () => {
    const { PUT, calls } = loadRoute({ legacy })
    const response = await PUT(request())
    assert.equal(response.status, 200)
    assert.equal((await response.json()).ok, true)
    assert.equal(calls.fullReads, legacy ? 1 : 0)
    assert.equal(calls.writes.length, 1)
    const { data, keys } = calls.writes[0]
    assert.deepEqual(keys, ['typeAnalysis', 'ui'])
    assert.equal(data.typeAnalysis.newReplacement.records[0].id, 'new-1')
    assert.equal(data.ui.theme, 'light')
    assert.equal(data.ui.manualWeeklyRestore.id, 'keep')
    assert.equal(data.ui.menuUpdatedAt.contracts, 'previous')
    assert.equal(data.ui.menuUpdatedAt['type-analysis'], 'now')
  })
}

test('failed writes do not return a successful save receipt', async () => {
  const { PUT } = loadRoute({ writeError: 'storage unavailable' })
  const response = await PUT(request())
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { ok: false, error: 'storage unavailable' })
})
