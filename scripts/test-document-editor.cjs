const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'MutationObserver', 'DOMParser', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) global[key] = typeof dom.window[key] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key]
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator })
global.ResizeObserver = class { observe() {} disconnect() {} }
global.IS_REACT_ACT_ENVIRONMENT = true
dom.window.HTMLElement.prototype.getClientRects = () => []
dom.window.Range.prototype.getClientRects = () => []
dom.window.Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0 })
const React = require('react')
const { createRoot } = require('react-dom/client')
const { act } = React
const rootPath = path.resolve(__dirname, '..')
const cache = new Map()
function load(file) {
  if (!path.extname(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx'
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const localRequire = name => name.startsWith('@/') ? load(path.join(rootPath, name.slice(2))) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name)
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}
async function run() {
  const { RichReportEditor } = load(path.join(rootPath, 'components/documents/rich-report-editor'))
  const reportFns = load(path.join(rootPath, 'lib/document-report'))
  let report = reportFns.formatDocumentReport('Ⅰ. 검증\n| 항목 | 내용 |\n| 검증 | 셀 내용 |', { title: '입력 검증', author: '검증', date: '2026-10-26' })
  const root = createRoot(document.getElementById('root'))
  const panel = document.createElement('aside')
  document.body.append(panel)
  let publications = 0
  const render = () => root.render(React.createElement(RichReportEditor, { report, editable: true, toolbarTarget: panel, onSelection() {}, onChange(next) { publications++; report = next; render() } }))
  await act(async () => { render(); await new Promise(resolve => setTimeout(resolve, 30)) })
  const content = document.querySelector('.tiptap')
  const editor = content.editor
  assert.ok(editor && editor.isEditable)
  let cellPosition
  editor.state.doc.descendants((node, pos) => { if (node.type.name === 'tableCell' && cellPosition === undefined) cellPosition = pos + 2 })
  await act(async () => { editor.commands.setTextSelection(cellPosition); editor.commands.insertContent('수정 ') })
  const cell = document.querySelector('td')
  const selection = editor.state.selection.from
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).reverse().map(key => [key, reorder(value[key])])) : value
  report = { ...report, richText: reorder(editor.getJSON()) }
  await act(async () => { render() })
  assert.equal(document.querySelector('td'), cell, 'Equivalent content must not replace the table DOM')
  assert.equal(editor.state.selection.from, selection, 'Equivalent content must not reset the cell cursor')
  const before = publications
  await act(async () => {
    content.dispatchEvent(new window.CompositionEvent('compositionstart', { bubbles: true }))
    assert.ok(editor.view.composing)
    editor.commands.insertContent('한글')
  })
  assert.equal(publications, before, 'Composition must not echo partial input into React report state')
  await act(async () => {
    content.dispatchEvent(new window.CompositionEvent('compositionend', { bubbles: true, data: '한글' }))
    await new Promise(resolve => setTimeout(resolve, 40))
  })
  assert.ok(publications > before)
  assert.ok(reportFns.reportPlainText(report).includes('수정 한글'))
  assert.equal(document.querySelector('td'), cell, 'Korean composition must preserve the active cell DOM')
  await act(async () => { editor.chain().focus(undefined, { scrollIntoView: false }).updateAttributes('table', { tableTheme: 'dark' }).run() })
  assert.equal(editor.getAttributes('table').tableTheme, 'dark')
  assert.equal(document.querySelector('td'), cell, 'Table design updates must preserve cells')
  assert.equal(document.querySelector('fieldset[aria-label="표 디자인"]'), null, 'Selecting a table must not mount a layout-shifting toolbar row')
  assert.ok(panel.contains(document.querySelector('fieldset[aria-label="선택한 텍스트 서식"]')), 'Tools must be portaled into the right sidebar')
  assert.ok(!document.querySelector('.report-editor-paper').style.zoom, 'Editable paper must not use CSS zoom')
  assert.ok(!document.querySelector('.report-editor-paper').style.transform, 'Editable paper must not transform click coordinates')
  const commands = load(path.join(rootPath, 'lib/document-rich-commands'))
  await act(async () => {
    editor.commands.setTextSelection({ from: cellPosition, to: cellPosition + 2 })
    commands.applyReportTextStyle(editor, { fontSize: 20 }, 'selection')
  })
  let selectedSize, unselectedSize
  editor.state.doc.nodesBetween(cellPosition, cellPosition + 2, node => { if (node.isText) selectedSize = node.marks.find(mark => mark.type.name === 'textStyle')?.attrs.fontSize })
  editor.state.doc.descendants(node => { if (node.isText && node.text.includes('셀 내용')) unselectedSize = node.marks.find(mark => mark.type.name === 'textStyle')?.attrs.fontSize })
  assert.equal(selectedSize, 20)
  assert.notEqual(unselectedSize, 20, 'Formatting a text range must leave other cells unchanged')
  await act(async () => { panel.querySelector('[aria-label="표 편집"]').click() })
  await act(async () => { Array.from(panel.querySelectorAll('button')).find(button => button.textContent === '셀 선택').click() })
  await act(async () => {
    document.querySelector('th').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1 }))
    document.querySelector('td').dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, buttons: 1 }))
    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }))
  })
  assert.equal(editor.state.selection.ranges.length, 2, 'Dragging cells must create a rectangular multi-cell selection')
  await act(async () => { commands.applyReportCellStyle(editor, 'backgroundColor', '#ffeecc', 'selection') })
  const cells = []
  editor.state.doc.descendants(node => { if (['tableCell', 'tableHeader'].includes(node.type.name)) cells.push(node) })
  assert.equal(cells.filter(node => node.attrs.backgroundColor === '#ffeecc').length, 2)
  assert.equal(cells.filter(node => node.attrs.backgroundColor === null).length, 2, 'Unselected cells must keep their design')
  assert.ok(reportFns.reportHtml(report).includes('background-color:#ffeecc'))
  await act(async () => { commands.applyReportTextStyle(editor, { fontSize: 16 }, 'document') })
  editor.state.doc.descendants(node => { if (node.isText) assert.equal(node.marks.find(mark => mark.type.name === 'textStyle')?.attrs.fontSize, 16) })
  await act(async () => { root.unmount() })
  const Y = require('yjs')
  const collab = load(path.join(rootPath, 'lib/document-collaboration'))
  const shared = new Y.Doc()
  collab.applyReportChange(shared, structuredClone(report))
  collab.initializeRichDocument(shared)
  const sharedRoot = createRoot(document.getElementById('root'))
  const sharedRender = () => sharedRoot.render(React.createElement(RichReportEditor, { report: collab.reportFromYDoc(shared), yDoc: shared, editable: true, toolbarTarget: panel, onSelection() {}, onChange() { throw new Error('Shared edits must not replace report snapshots') } }))
  await act(async () => { sharedRender(); await new Promise(resolve => setTimeout(resolve, 30)) })
  const sharedEditor = document.querySelector('.tiptap').editor
  let sharedCellPosition
  sharedEditor.state.doc.descendants((node, pos) => { if (node.type.name === 'tableCell' && sharedCellPosition === undefined) sharedCellPosition = pos + 2 })
  await act(async () => { sharedEditor.commands.setTextSelection(sharedCellPosition); sharedEditor.commands.insertContent('공동 ') })
  const sharedCell = document.querySelector('td')
  const peer = new Y.Doc()
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(shared))
  const table = peer.getXmlFragment('rich-text').toArray().find(node => node.nodeName === 'table')
  table.get(1).get(0).get(0).get(0).insert(0, '원격 ')
  await act(async () => { Y.applyUpdate(shared, Y.encodeStateAsUpdate(peer), 'remote'); sharedRender() })
  assert.equal(document.querySelector('td'), sharedCell, 'Remote synchronization must not rebuild the active table cell')
  assert.ok(sharedEditor.getText().includes('원격 공동 '))
  assert.equal(sharedEditor.state.selection.$from.parent.type.name, 'paragraph')
  await act(async () => { sharedRoot.unmount() })
  peer.destroy(); shared.destroy()
  panel.remove()
  dom.window.close()
  console.log('PASS: real editor table typing, IME composition, local echo normalization, stable cell DOM/cursor, table design updates, and sticky toolbar structure.')
}
run().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
