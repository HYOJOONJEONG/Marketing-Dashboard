const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const api = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/dashboard-collaboration.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: api })

test('unsaved manual input does not block contract updates', () => {
  assert.equal(api.hasProtectedSlice(['contracts', 'currentYear', 'years', 'availableYears', 'ui'],
    ['weeklyReport', 'currentYear', 'years', 'availableYears', 'ui']), false)
})
test('shared contract slice is protected across different menus', () => {
  assert.equal(api.hasProtectedSlice(['contracts', 'ui'], ['contracts']), true)
})
test('contract change is detected even without menu timestamp change', () => {
  const current = { contracts: [{ id: 'one', includedInWeekly: false }], ui: {} }
  const latest = { contracts: [{ id: 'one', includedInWeekly: true }], ui: {} }
  assert.equal(api.dashboardSlicesDiffer(current, latest, ['contracts', 'ui']), true)
})
test('unchanged data avoids re-render and omitted slices are preserved', () => {
  assert.equal(api.dashboardSlicesDiffer({ contracts: [1], collection: [2] }, { contracts: [1] }, ['contracts', 'collection']), false)
})
test('explicit server removal is detected', () => {
  assert.equal(api.dashboardSlicesDiffer({ contracts: [1] }, { contracts: [] }, ['contracts']), true)
})
test('poller guards in-flight edits and reconnects; conditional reads remain authenticated', () => {
  const client = fs.readFileSync(path.join(root, 'components/dashboard-shell.tsx'), 'utf8')
  const server = fs.readFileSync(path.join(root, 'app/api/dashboard/route.ts'), 'utf8')
  assert.ok(client.includes('if (currentData !== baseData) return'))
  assert.ok(client.includes('etag && lastApplied === baseData'))
  assert.ok(client.includes('window.addEventListener("online", handleFocus)'))
  const get = server.slice(server.indexOf('export async function GET'))
  assert.ok(get.indexOf('resolveRequestSession()') < get.indexOf('url.searchParams.get("collaborative")'))
  assert.ok(get.includes('pickDashboardReturnData(state, keys, session, permissions)'))
})

test('conditional API returns 304, detects changes, filters contracts, and fails closed on DB errors', async () => {
  const output = {}
  let fail = false
  let signedIn = true
  let version = 1
  const mocks = {
    'next/server': { NextResponse: Response },
    '@/lib/auth/session': { resolveRequestSession: async () => signedIn ? { user: { id: 'one' }, state: {} } : null },
    '@/lib/auth/permissions': {
      buildPermissionIndex: () => ({}), hasPermission: () => true,
      filterContractsForUser: rows => rows.filter(row => row.owner === 'one'),
    },
    '@/lib/shared-db-store': { readDashboardStateSlices: async () => {
      if (fail) throw new Error('test outage')
      return { contracts: [{ id: version, owner: 'one' }, { id: 'hidden', owner: 'two' }], ui: {} }
    } },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'app/api/dashboard/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, {
    exports: output, require: name => mocks[name] || (name.startsWith('@/') ? {} : require(name)),
    process, URL, Response, console: { error() {} },
  })
  const url = 'https://test.invalid/api/dashboard?collaborative=1&keys=contracts,ui'
  const first = await output.GET(new Request(url))
  assert.equal(first.status, 200)
  assert.equal((await first.json()).contracts.length, 1)
  const request = () => new Request(url, { headers: { 'If-None-Match': first.headers.get('etag') } })
  assert.equal((await output.GET(request())).status, 304)
  version++
  assert.equal((await output.GET(request())).status, 200)
  fail = true
  assert.equal((await output.GET(request())).status, 503)
  signedIn = false
  assert.equal((await output.GET(request())).status, 401)
})
