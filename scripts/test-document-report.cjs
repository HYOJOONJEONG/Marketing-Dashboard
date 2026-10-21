const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../lib/document-report.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const context = { exports: {} }
vm.runInNewContext(compiled, context)
const { formatDocumentReport, reportBlocks, reportHtml, reportPlainText } = context.exports
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
assert.ok(html.includes('Ⅰ. 추진 개요'))
const hostile = reportHtml(formatDocumentReport('<script>alert(1)</script>\n| 항목 | 값 |\n| x | <img src=x onerror=alert(1)> |', { ...metadata, title: '<script>제목</script>' }))
assert.ok(!hostile.includes('<script>'))
assert.ok(!hostile.includes('<img src=x'))
assert.ok(hostile.includes('&lt;script&gt;'))
assert.equal(formatDocumentReport('분류가 없는 원문\n둘째 문장', metadata).sections[0].content, '분류가 없는 원문\n둘째 문장')
assert.equal(reportBlocks('항목\t금액\n계약\t1,000')[0].rows[1][1], '1,000')
console.log('Document report: section, table, content preservation, and HTML escaping checks passed.')
if (process.argv.includes('--serve')) {
  require('node:http').createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(html)
  }).listen(3098, '127.0.0.1', () => console.log('Template preview: http://127.0.0.1:3098'))
}
