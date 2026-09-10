const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const test = require('node:test')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/option-termination.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const moduleObject = { exports: {} }
vm.runInNewContext(code, { exports: moduleObject.exports, module: moduleObject })
const { filterConfirmedOptions, buildOptionLabels } = moduleObject.exports
const clean = (value) => JSON.parse(JSON.stringify(value))
const bond = { user_id: 'E160279', company_name: 'Example', category_code: 'BOND', is_active: 1 }
const state = (confirmedItems = []) => ({ currentSheetId: 'current', sheets: [{ id: 'current', items: [{ customerId: 'E160279', selected: true }], confirmedItems }] })

test('pending termination does not remove options; confirmation removes only matching ID', () => {
  const records = [bond, { ...bond, user_id: 'E160280' }]
  assert.equal(filterConfirmedOptions(records, state()).length, 2)
  assert.deepEqual(clean(filterConfirmedOptions(records, state([{ customerId: ' e160279 ' }]))), [records[1]])
  assert.equal(filterConfirmedOptions(records, state()).length, 2)
  assert.equal(records.length, 2)
})

test('grouped option keeps remaining users without mutating original records', () => {
  const row = { ...bond, user_id: 'E160279, E160280', apply_ids: 'E160279 E160280', apply_count: '2' }
  const [remaining] = filterConfirmedOptions([row], state([{ customerId: 'E160279' }]))
  assert.equal(remaining.user_id, 'E160280')
  assert.equal(remaining.apply_count, '1')
  assert.equal(row.apply_count, '2')
})

test('new option requests after termination remain visible', () => {
  const result = filterConfirmedOptions([{ ...bond, request_date: '2026-09-10' }], state([{ customerId: 'E160279', terminationDate: '2026.09.09' }]))
  assert.equal(result.length, 1)
})

test('labels are deduplicated and match IDs, not company names', () => {
  const labels = buildOptionLabels([bond, bond, { ...bond, category_code: 'LME' }], { BOND: 'Bond', LME: 'LME' })
  assert.deepEqual(clean(labels.E160279), ['Bond', 'LME'])
  assert.equal(labels.E160280, undefined)
})

test('older archived sheet does not override restored current sheet', () => {
  const termination = state()
  termination.sheets.push({ id: 'old', confirmedItems: [{ customerId: 'E160279' }] })
  assert.equal(filterConfirmedOptions([bond], termination).length, 1)
})

test('confirmed list includes inactive option history without changing active labels', () => {
  const records = [bond, { ...bond, category_code: 'LME', is_active: 0 }, { ...bond, category_code: 'API', is_active: 0 }]
  const names = { BOND: 'Bond', LME: 'LME', API: 'API' }
  assert.deepEqual(clean(buildOptionLabels(records, names).E160279), ['Bond'])
  assert.deepEqual(clean(buildOptionLabels(records, names, true).E160279), ['Bond', 'LME'])
  assert.equal(buildOptionLabels(records, names, true).E160280, undefined)
})
