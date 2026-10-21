"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Copy, Download, FileText, Printer } from "lucide-react"
import { DocumentReport, formatDocumentReport, reportPlainText, reportHtml, REPORT_CSS } from "@/lib/document-report"

export function DocumentWorkspace({ author, userId, department }: { author: string; userId: string; department?: string }) {
  const [source, setSource] = useState("")
  const [title, setTitle] = useState("업무 보고서")
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()))
  const [writer, setWriter] = useState(department || author)
  const [report, setReport] = useState<DocumentReport | null>(null)
  const [message, setMessage] = useState("")
  const [ready, setReady] = useState(false)
  const draftKey = `document-report-draft:${userId}`
  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey)
      if (stored) {
        const draft = JSON.parse(stored)
        if (typeof draft.source === "string") setSource(draft.source)
        if (typeof draft.title === "string") setTitle(draft.title)
        if (typeof draft.date === "string") setDate(draft.date)
        if (typeof draft.writer === "string") setWriter(draft.writer)
        if (draft.report && Array.isArray(draft.report.sections)) setReport(draft.report)
      }
    } catch { setMessage("임시 문서를 불러오지 못했습니다.") }
    setReady(true)
  }, [draftKey])
  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(draftKey, JSON.stringify({ source, title, date, writer, report })) }
    catch { setMessage("이 브라우저에 임시 보관하지 못했습니다. 파일로 내려받아 주세요.") }
  }, [source, title, date, writer, report, draftKey, ready])
  const inputClass = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
  function download() {
    if (!report) return
    const blob = new Blob(["\ufeff", reportHtml(report)], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${report.title.replace(/[\\/:*?"<>|]/g, "_") || "보고서"}_${report.date}.html`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function printReport() {
    if (!report) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) { setMessage("인쇄 창을 열 수 없습니다. 팝업 허용 후 다시 시도해주세요."); return }
    printWindow.opener = null
    printWindow.document.open()
    printWindow.document.write(reportHtml(report))
    printWindow.document.close()
    void printWindow.document.fonts.ready.then(() => { printWindow.focus(); printWindow.print() })
  }
  async function copy() {
    if (!report) return
    try { await navigator.clipboard.writeText(reportPlainText(report)); setMessage("보고서를 복사했습니다.") }
    catch { setMessage("복사하지 못했습니다. 파일 다운로드를 이용해주세요.") }
  }
  return <div className="document-workspace min-w-0">
    <style>{REPORT_CSS}</style>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-5 flex items-center gap-2 text-base font-bold text-slate-900"><FileText className="h-4 w-4 text-blue-600" />보고서 작성</h2>
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-600">제목<input className={`${inputClass} mt-1.5`} value={title} onChange={e => setTitle(e.target.value)} maxLength={150} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-600">작성일<input type="date" className={`${inputClass} mt-1.5`} value={date} onChange={e => setDate(e.target.value)} /></label>
            <label className="block text-sm font-semibold text-slate-600">작성 부서 / 작성자<input className={`${inputClass} mt-1.5`} value={writer} onChange={e => setWriter(e.target.value)} maxLength={80} /></label>
          </div>
          <label className="block text-sm font-semibold text-slate-600">보고 내용<textarea className={`${inputClass} mt-1.5 min-h-[340px] resize-y leading-7`} value={source} onChange={e => setSource(e.target.value)} placeholder={"Ⅰ. 추진 개요\n- 보고 내용\n\nⅡ. 세부 추진 계획\n가. 추진 방향\n\n| 구분 | 주요 내용 |\n| --- | --- |\n| 추진 과제 | 세부 내용 |\n\nⅢ. 향후 계획"} maxLength={100000} /></label>
          <button type="button" disabled={!source.trim() || !title.trim() || !date} onClick={() => { setReport(formatDocumentReport(source, { title: title.trim(), date, author: writer.trim() })); setMessage("보고서 양식을 적용했습니다.") }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">보고서 만들기<ArrowRight className="h-4 w-4" /></button>
        </div>
      </section>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-700">보고서 미리보기</h2>
          <div className="flex gap-2">{[{ label: "복사", Icon: Copy, action: copy }, { label: "서식 포함 HTML 다운로드", Icon: Download, action: download }, { label: "인쇄 / PDF 저장", Icon: Printer, action: printReport }].map(({ label, Icon, action }) => <button key={label} type="button" title={label} aria-label={label} disabled={!report} onClick={action} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30"><Icon className="h-4 w-4" /></button>)}</div>
        </div>
        <div role="status" className="mb-2 min-h-5 text-xs text-slate-500">{message}</div>
        {report ? <>
          <div className="min-h-[650px] min-w-0 border border-slate-200 bg-white" dangerouslySetInnerHTML={{ __html: reportHtml(report, true) }} />
          <details className="mt-4 rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-600">본문 수정</summary>{report.sections.map((section, index) => <label key={index} className="mt-4 block text-sm font-semibold text-slate-600">{section.heading}<textarea aria-label={`${section.heading} 수정`} className={`${inputClass} mt-2 min-h-32 resize-y font-normal leading-7`} value={section.content} onChange={e => setReport({ ...report, sections: report.sections.map((item, i) => i === index ? { ...item, content: e.target.value } : item) })} /></label>)}</details>
        </> : <div className="flex min-h-[450px] flex-col items-center justify-center gap-3 border border-dashed border-slate-300 bg-white text-sm text-slate-400"><FileText className="h-9 w-9" /><span>작성된 보고서가 없습니다.</span></div>}
      </div>
    </div>
  </div>
}
