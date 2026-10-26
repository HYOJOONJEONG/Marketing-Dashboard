const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const ts = require('typescript')
const Y = require('yjs')
const root = path.resolve(__dirname, '..')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'infobiz-documents-test-'))
const cache = new Map()
const users = ['owner', 'editor', 'viewer', 'outsider'].map(id => ({ id, name: id, active: true, deletedAt: null, teamId: 'test-team', title: '테스트' }))
let session = null
const asUser = id => { session = id ? { user: users.find(user => user.id === id), state: { users, teams: [{ id: 'test-team', name: '테스트팀' }] } } : null }
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const localRequire = name => {
    if (name === 'next/server') return { NextResponse: { json: (value, init) => new Response(JSON.stringify(value), { ...init, headers: { 'content-type': 'application/json', ...init?.headers } }) } }
    if (name === '@/lib/auth/session') return { resolveRequestSession: async () => session }
    if (name.startsWith('@/')) return load(path.join(root, name.slice(2) + '.ts'))
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'))
    return require(name)
  }
  vm.runInNewContext(code, { module, exports: module.exports, require: localRequire, console, Buffer, Uint8Array, Map, Set, Array, Object, Date, Promise, Response, Request, AbortSignal, URL,
    process: { env: { NODE_ENV: 'test' }, cwd: () => temporary }, setTimeout, clearTimeout }, { filename: file })
  return module.exports
}
const collaboration = load(path.join(root, 'lib/document-collaboration.ts'))
const reportFunctions = load(path.join(root, 'lib/document-report.ts'))
const collection = load(path.join(root, 'app/api/documents/route.ts'))
const detail = load(path.join(root, 'app/api/documents/[id]/route.ts'))
const storageRoute = load(path.join(root, 'app/api/documents/storage/route.ts'))
const post = body => new Request('http://localhost/api/documents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const context = id => ({ params: Promise.resolve({ id }) })
const metadata = { title: '협업 검증 보고', author: '테스트팀', date: '2026-10-21' }
const initial = reportFunctions.formatDocumentReport('Ⅰ. 검증\n공통 문장\n\nⅡ. 계획\n테스트 내용', metadata)
function client(state) {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, collaboration.base64ToBytes(state))
  return doc
}
function change(doc, field, text, style) {
  const before = collaboration.reportFromYDoc(doc)
  const next = structuredClone(before)
  next.fields[field] = { ...next.fields[field], ...(text == null ? {} : { text }), ...(style ? { style: { ...next.fields[field]?.style, ...style } } : {}) }
  collaboration.applyReportChange(doc, next, before)
}
async function run() {
  const { EditorState } = require('node:module').createRequire(require.resolve('@tiptap/core'))('@tiptap/pm/state')
  const schema = load(path.join(root, 'lib/document-rich-schema.ts')).reportSchema()
  const commands = load(path.join(root, 'lib/document-rich-commands.ts'))
  const formatted = reportFunctions.legacyReportContent(reportFunctions.formatDocumentReport('Ⅰ. 표 검증\n본문 수정\n| 항목 | 내용 |\n| A | B |', metadata))
  let editorState = EditorState.create({ schema, doc: schema.nodeFromJSON(formatted) })
  const sizes = []
  editorState.doc.descendants(node => { if (node.isText) sizes.push(node.marks.find(mark => mark.type.name === 'textStyle')?.attrs.fontSize) })
  const fakeEditor = { isEditable: true, commands: { command: callback => { const tr = editorState.tr; const result = callback({ state: editorState, tr }); editorState = editorState.apply(tr); return result } } }
  assert.ok(commands.applyWholeReportFont(fakeEditor, 'serif'))
  let index = 0
  editorState.doc.descendants(node => {
    if (node.isTextblock) assert.equal(node.attrs.documentFont, 'serif')
    if (!node.isText) return
    const mark = node.marks.find(mark => mark.type.name === 'textStyle')
    assert.equal(mark.attrs.fontFamily, 'serif')
    assert.equal(mark.attrs.fontSize, sizes[index++])
  })
  assert.ok(!commands.applyWholeReportFont(fakeEditor, 'invalid'))
  fakeEditor.isEditable = false
  assert.ok(!commands.applyWholeReportFont(fakeEditor, 'arial'))
  const richDesign = editorState.doc.toJSON()
  const table = richDesign.content.find(node => node.type === 'table')
  table.attrs = { ...table.attrs, tableTheme: 'dark', tableDensity: 'compact', headerColor: '#123456', borderColor: '#654321' }
  const designed = { ...initial, richText: richDesign }
  const designDoc = new Y.Doc()
  collaboration.applyReportChange(designDoc, structuredClone(designed))
  const designReload = client(collaboration.bytesToBase64(Y.encodeStateAsUpdate(designDoc)))
  const output = reportFunctions.reportHtml(collaboration.reportFromYDoc(designReload))
  assert.ok(output.includes('data-table-theme="dark"'))
  assert.ok(output.includes('data-table-density="compact"'))
  assert.ok(output.includes('--report-table-header:#123456'))
  assert.ok(output.includes('--report-table-border:#654321'))
  assert.ok(output.includes('font-family:Batang'))
  designDoc.destroy(); designReload.destroy()
  console.log('PASS: whole-document font changes preserve sizes, table designs survive Yjs reload and PDF HTML export, read-only edits denied.')
  asUser(null)
  assert.equal((await collection.GET(new Request('http://localhost/api/documents'))).status, 401)
  asUser('owner')
  const createdResponse = await collection.POST(post({ report: initial }))
  assert.equal(createdResponse.status, 201)
  const created = (await createdResponse.json()).document
  const id = created.id
  assert.equal(created.members.length, 0)
  assert.equal((await storageRoute.POST(post({ action: 'read', id }))).status, 403)
  asUser('outsider')
  assert.equal((await detail.GET(new Request('http://localhost'), context(id))).status, 404)
  assert.equal((await collection.GET(new Request('http://localhost/api/documents'))).status, 200)
  assert.equal((await (await collection.GET(new Request('http://localhost/api/documents'))).json()).documents.length, 0)
  assert.equal((await detail.POST(post({ action: 'sync' }), context(id))).status, 403)
  asUser('owner')
  assert.equal((await detail.POST(post({ action: 'members', userId: 'editor', role: 'editor' }), context(id))).status, 200)
  assert.equal((await detail.POST(post({ action: 'members', userId: 'viewer', role: 'viewer' }), context(id))).status, 200)
  asUser('editor')
  assert.equal((await (await detail.GET(new Request('http://localhost'), context(id))).json()).role, 'editor')
  assert.equal((await detail.POST(post({ action: 'members', userId: 'outsider', role: 'editor' }), context(id))).status, 403)
  const a = client(created.state)
  const b = client(created.state)
  change(a, 's0.b0', '앞 공통 문장', { size: 18 })
  change(b, 's0.b0', '공통 문장 뒤', { color: '#123456' })
  const updateA = collaboration.bytesToBase64(Y.encodeStateAsUpdate(a))
  const updateB = collaboration.bytesToBase64(Y.encodeStateAsUpdate(b))
  asUser('viewer')
  assert.equal((await detail.POST(post({ action: 'sync', update: updateA }), context(id))).status, 403)
  asUser('editor')
  const savingA = detail.POST(post({ action: 'sync', update: updateA, connectionId: 'editor-session', field: 's0.b0' }), context(id))
  asUser('owner')
  const savingB = detail.POST(post({ action: 'sync', update: updateB, connectionId: 'owner-session', field: 's0.b0' }), context(id))
  const responses = await Promise.all([savingA, savingB])
  assert.equal(responses[0].status, 200)
  assert.equal(responses[1].status, 200)
  let latest = (await (await detail.GET(new Request('http://localhost'), context(id))).json()).document
  let merged = client(latest.state)
  let result = collaboration.reportFromYDoc(merged)
  assert.equal(result.fields['s0.b0'].text, '앞 공통 문장 뒤')
  assert.equal(result.fields['s0.b0'].style.size, 18)
  assert.equal(result.fields['s0.b0'].style.color, '#123456')
  assert.equal(latest.presence.length, 2)
  const richA = client(latest.state)
  const richB = client(latest.state)
  const xmlA = richA.getXmlFragment('rich-text').get(0).get(0)
  const xmlB = richB.getXmlFragment('rich-text').get(0).get(0)
  xmlA.insert(0, '공동 ')
  xmlB.insert(xmlB.length, ' 완료')
  xmlB.format(0, xmlB.length, { underline: {} })
  assert.equal((await detail.POST(post({ action: 'sync', update: collaboration.bytesToBase64(Y.encodeStateAsUpdate(richA)) }), context(id))).status, 200)
  assert.equal((await detail.POST(post({ action: 'sync', update: collaboration.bytesToBase64(Y.encodeStateAsUpdate(richB)) }), context(id))).status, 200)
  const richSaved = (await (await detail.GET(new Request('http://localhost'), context(id))).json()).document
  const richReloaded = client(richSaved.state)
  const richReport = collaboration.reportFromYDoc(richReloaded)
  assert.ok(reportFunctions.reportPlainText(richReport).includes('공동 협업 검증 보고 완료'))
  assert.ok(reportFunctions.reportHtml(richReport).includes('<u>'))
  assert.equal((await detail.POST(post({ action: 'initialize' }), context(id))).status, 200)
  const richAgain = (await (await detail.GET(new Request('http://localhost'), context(id))).json()).document
  assert.equal(richAgain.state, richSaved.state, 'Initialization must not duplicate existing rich content')
  richA.destroy(); richB.destroy(); richReloaded.destroy()
  asUser('viewer')
  assert.equal((await detail.POST(post({ action: 'initialize' }), context(id))).status, 403)
  asUser('owner')
  assert.equal((await detail.POST(post({ action: 'sync', update: updateA, connectionId: 'editor-session' }), context(id))).status, 200)
  latest = (await (await detail.GET(new Request('http://localhost'), context(id))).json()).document
  merged.destroy()
  merged = client(latest.state)
  assert.equal(collaboration.reportFromYDoc(merged).fields['s0.b0'].text, '앞 공통 문장 뒤')
  change(merged, 's0.b0', '')
  change(merged, 'title', null, { size: 17 })
  assert.equal(collaboration.reportFromYDoc(merged).fields['s0.b0'].text, '')
  asUser('owner')
  assert.equal((await detail.POST(post({ action: 'members', userId: 'editor', role: 'remove' }), context(id))).status, 200)
  asUser('editor')
  assert.equal((await detail.GET(new Request('http://localhost'), context(id))).status, 404)
  assert.equal((await detail.POST(post({ action: 'sync', update: updateA }), context(id))).status, 403)
  assert.equal((await (await collection.GET(new Request('http://localhost/api/documents'))).json()).documents.length, 0)
  asUser('viewer')
  assert.equal((await detail.GET(new Request('http://localhost'), context(id))).status, 200)
  a.destroy(); b.destroy(); merged.destroy()
  console.log('PASS: private defaults, owner/editor/viewer access, invitation and revocation, atomic concurrent saves, Yjs text/style merge, idempotent retries, empty-field preservation, and private storage isolation.')
}
run().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  const directory = path.join(temporary, 'data/private-documents')
  for (const filename of await fsp.readdir(directory).catch(() => [])) {
    assert.match(filename, /^[a-f0-9-]{36}\.json$/)
    await fsp.unlink(path.join(directory, filename))
  }
  await fsp.rmdir(directory).catch(() => {})
  await fsp.rmdir(path.join(temporary, 'data')).catch(() => {})
  await fsp.rmdir(temporary)
})
