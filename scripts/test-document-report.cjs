const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../lib/document-report.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const logoSource = fs.readFileSync(path.join(__dirname, '../lib/document-report-logo.ts'), 'utf8')
const logoContext = { exports: {} }
vm.runInNewContext(ts.transpileModule(logoSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, logoContext)
const context = { exports: {}, require: name => { assert.equal(name, './document-report-logo'); return logoContext.exports } }
vm.runInNewContext(compiled, context)
const { formatDocumentReport, reportBlocks, reportHtml, reportPlainText, reportFields } = context.exports
const metadata = { title: '업무 추진 검토 보고', author: '인포Biz1팀', date: '2026-10-21' }
const input = 'Ⅰ. 추진 개요\n- 기존 내용을 보존합니다.\n\nⅡ. 세부 추진 계획\n가. 추진 방향\n검토 내용과 금액 1,234,567원\n| 구분 | 주요 내용 |\n| --- | --- |\n| 계획 | 시범 운영 |\n\nⅢ. 향후 계획\n1) 수요 확인\n일정 협의'
const report = formatDocumentReport(input, metadata)
assert.equal(report.sections.length, 3)
assert.equal(report.sections[1].heading, '세부 추진 계획')
const blocks = reportBlocks(report.sections[1].content)
assert.equal(blocks[0].type, 'subheading')
assert.equal(blocks[2].type, 'table')
assert.equal(blocks[2].rows.length, 2)
assert.ok(reportPlainText(report).includes('1,234,567원'))
const html = reportHtml(report)
assert.ok(html.includes('<thead>'))
assert.ok(html.replace(/<[^>]*>/g, '').includes('Ⅰ.추진 개요'))
const hostile = reportHtml(formatDocumentReport('<script>alert(1)</script>\n| 항목 | 값 |\n| x | <img src=x onerror=alert(1)> |', { ...metadata, title: '<script>제목</script>' }))
assert.ok(!hostile.includes('<script>'))
assert.ok(!hostile.includes('<img src=x'))
assert.ok(hostile.includes('&lt;script&gt;'))
assert.equal(formatDocumentReport('분류가 없는 원문\n둘째 문장', metadata).sections[0].content, '분류가 없는 원문\n둘째 문장')
assert.equal(reportBlocks('항목\t금액\n계약\t1,000')[0].rows[1][1], '1,000')
const edited = { ...report, fields: {
  title: { text: '수정된 제목', style: { font: 'serif', size: 28, spacing: 1.5, align: 'left', color: '#123456' } },
  's1.b2.r1.c1': { text: '수정된 표 내용', style: { size: 12, bold: true } },
  's2.heading': { style: { pageBreak: true } },
}, page: { margin: 20, logoWidth: 160 } }
const editedHtml = reportHtml(edited)
assert.ok(editedHtml.includes('수정된 표 내용'))
assert.ok(editedHtml.includes('font-size:28pt;letter-spacing:1.5px'))
assert.ok(editedHtml.includes('break-before:page'))
assert.ok(editedHtml.includes('margin:20mm'))
assert.ok(editedHtml.includes('data:image/png;base64,'))
assert.ok(reportPlainText(edited).includes('수정된 제목'))
assert.ok(reportPlainText(edited).includes('수정된 표 내용'))
assert.ok(reportFields(edited).find(field => field.key === 's1.b2.r1.c1'))
const maliciousStyle = reportHtml({ ...report, fields: { title: { style: { font: 'bad";color:red', color: 'red;background:url(x)', size: 999, spacing: -10 } } } })
assert.ok(!maliciousStyle.includes('background:url(x)'))
assert.ok(maliciousStyle.includes('font-size:48pt;letter-spacing:0px'))
assert.equal(reportBlocks('| A | B |\n| C | D |\n\n| E | F |').length, 2)
console.log('Document report: section, table, content preservation, and HTML escaping checks passed.')
const richText = context.exports.legacyReportContent(edited)
assert.equal(richText.type, 'doc')
assert.equal(richText.content[0].type, 'heading')
assert.equal(richText.content[0].content[0].text, '수정된 제목')
const richHtml = reportHtml({ ...edited, richText })
assert.ok(richHtml.includes('수정된 표 내용'))
assert.ok(richHtml.includes('font-size:28pt'))
assert.ok(richHtml.includes('break-before:page'))
assert.ok(context.exports.validRichContent(richText))
assert.ok(!context.exports.validRichContent({ type: 'script', text: 'bad' }))
const hostileRich = reportHtml({ ...report, richText: { type: 'doc', content: [{ type: 'paragraph', attrs: { reportKind: 'bad" onclick="alert(1)' }, content: [{ type: 'text', text: '<script>bad</script>', marks: [{ type: 'textStyle', attrs: { fontFamily: 'bad', color: 'red;background:url(x)', fontSize: 999 } }] }] }] } })
assert.ok(!hostileRich.includes('<script>'))
assert.ok(!hostileRich.includes('onclick='))
assert.ok(!hostileRich.includes('background:url(x)'))
assert.ok(hostileRich.includes('font-size:48pt'))
console.log('PASS: rich template conversion, PDF HTML formatting, tables, page breaks, and safe rendering.')
if (process.argv.includes('--serve')) {
  require('node:http').createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(html)
  }).listen(3098, '127.0.0.1', () => console.log('Template preview: http://127.0.0.1:3098'))
}
