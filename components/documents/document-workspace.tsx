"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Cloud, CloudOff, Copy, Download, FileText, FolderOpen, Loader2, LockKeyhole, PanelLeftClose, PanelLeftOpen, Plus, Printer, Redo2, Save, Undo2, Users } from "lucide-react"
import { DocumentReport, fieldText, formatDocumentReport, reportHtml, reportPlainText, REPORT_CSS } from "@/lib/document-report"
import { RichReportEditor } from "./rich-report-editor"
import { documentSavedAt } from "@/lib/document-library"
import { useDocumentCollaboration } from "./use-document-collaboration"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const INPUT = "h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const TOOL = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30"

export function DocumentWorkspace({ author, userId, department }: { author: string; userId: string; department?: string }) {
  const [source, setSource] = useState("")
  const [title, setTitle] = useState("업무 보고서")
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()))
  const [writer, setWriter] = useState(department || author)
  const [report, setReport] = useState<DocumentReport | null>(null)
  const [selected, setSelected] = useState("title")
  const [message, setMessage] = useState("")
  const [ready, setReady] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [undo, setUndo] = useState<DocumentReport[]>([])
  const [redo, setRedo] = useState<DocumentReport[]>([])
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [sharingOpen, setSharingOpen] = useState(false)
  const [directory, setDirectory] = useState<Array<{ id: string; name: string; title: string; teamName: string }>>([])
  const [inviteId, setInviteId] = useState("")
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor")
  const [search, setSearch] = useState("")
  const sourceChanged = useRef(false)
  const draftKey = `document-report-draft:${userId}`
  const collaboration = useDocumentCollaboration(userId, selected, (next, opened) => {
    setReport(next)
    if (opened && next) {
      setReady(true)
      setTitle(next.title); setDate(next.date); setWriter(next.author)
      setSource(next.sections.map((section, index) => `${index + 1}. ${section.heading}\n${section.content}`).join("\n\n"))
      setSourceOpen(false); setSelected("title"); setUndo([]); setRedo([])
      sourceChanged.current = false
    }
  }, report)
  const canEdit = !collaboration.document || collaboration.role === "owner" || collaboration.role === "editor"

  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey)
      if (stored) {
        const draft = JSON.parse(stored)
        if (typeof draft.documentId === "string") {
          void collaboration.open(draft.documentId)
          return
        }
        if (typeof draft.source === "string") setSource(draft.source)
        if (typeof draft.title === "string") setTitle(draft.title)
        if (typeof draft.date === "string") setDate(draft.date)
        if (typeof draft.writer === "string") setWriter(draft.writer)
        if (draft.report && typeof draft.report.title === "string" && typeof draft.report.author === "string" && typeof draft.report.date === "string" && Array.isArray(draft.report.sections) && draft.report.sections.every((s: any) => typeof s.heading === "string" && typeof s.content === "string")) {
          setReport(draft.report)
          setSourceOpen(false)
        }
      }
    } catch { setMessage("임시 문서를 불러오지 못했습니다.") }
    setReport(previous => previous || formatDocumentReport("", { title, date, author: writer }))
    setReady(true)
  }, [draftKey])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(draftKey, JSON.stringify(collaboration.document ? { documentId: collaboration.document.id } : { source, title, date, writer, report })) }
    catch { setMessage("임시 보관 공간이 부족합니다. 파일로 내려받아 주세요.") }
  }, [source, title, date, writer, report, draftKey, ready, collaboration.document?.id])

  useEffect(() => {
    if (!libraryOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setLibraryOpen(false) }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [libraryOpen])


  useEffect(() => {
    if (!sourceChanged.current || !ready || !source.trim() || collaboration.document) return
    const timer = setTimeout(() => {
      // Existing edits are only replaced by the explicit apply action.
      if (!report?.richText && (!report?.fields || !Object.keys(report.fields).length)) {
        sourceChanged.current = false
        setReport(formatDocumentReport(source, { title, date, author: writer }))
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [source, title, date, writer, ready, report, collaboration.document?.id])


  function commit(next: DocumentReport) {
    if (!canEdit) return
    if (collaboration.document && report) { collaboration.apply(next, report); return }
    if (report) setUndo(items => [...items.slice(-39), report])
    setRedo([])
    setReport(next)
    setMessage("이 브라우저에 임시 보관됨")
  }
  function travel(direction: "undo" | "redo") {
    if (collaboration.document) { if (direction === "undo") collaboration.undo(); else collaboration.redo(); return }
    if (!report) return
    const stack = direction === "undo" ? undo : redo
    const previous = stack.at(-1)
    if (!previous) return
    if (direction === "undo") { setUndo(stack.slice(0, -1)); setRedo(items => [...items, report]) }
    else { setRedo(stack.slice(0, -1)); setUndo(items => [...items, report]) }
    setReport(previous)
  }
  function applySource() {
    if (!source.trim()) return
    sourceChanged.current = false
    commit(formatDocumentReport(source, { title: title.trim() || "업무 보고서", date, author: writer.trim() }))
    setSelected("title")
    setSourceOpen(false)
    setMessage("공통 보고서 양식을 적용했습니다.")
  }
  async function saveDraft() {
    if (!report) return
    if (collaboration.document) await collaboration.save()
    else await collaboration.create(report)
  }
  async function newReport() {
    if (report && !collaboration.document && !await collaboration.create(report)) return
    if (!await collaboration.detach()) return
    setReady(true)
    setSource(""); setTitle("업무 보고서"); setWriter(department || author); setReport(formatDocumentReport("", { title: "업무 보고서", date, author: department || author })); setSourceOpen(false); setUndo([]); setRedo([]); setMessage(""); setSelected("title")
  }
  async function openSharing() {
    if (!report) return
    if (!collaboration.document && !await collaboration.create(report)) return
    setSharingOpen(true)
    try {
      const response = await fetch("/api/documents?directory=1", { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      setDirectory(json.users)
    } catch { setMessage("초대할 사용자 목록을 불러오지 못했습니다.") }
  }
  async function openDocument(id: string) {
    if (report && !collaboration.document && !await collaboration.create(report)) return
    if (await collaboration.open(id)) setLibraryOpen(false)
  }
  const peers = collaboration.presence.filter(person => person.userId !== userId)
  const statusLabel = collaboration.document
    ? ({ local: "브라우저 임시 보관", saving: "서버 저장 중", saved: "서버 저장 완료", offline: "연결 끊김 · 재시도 중", denied: "권한 확인 필요" })[collaboration.status]
    : "비공개 · 브라우저 임시 보관"
  function download() {
    if (!report) return
    const blob = new Blob(["\ufeff", reportHtml(report)], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${fieldText(report, "title", report.title).replace(/[\\/:*?"<>|]/g, "_") || "보고서"}_${report.date}.html`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function printReport() {
    if (!report) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) { setMessage("인쇄 창을 열 수 없습니다. 팝업 허용 후 다시 시도해주세요."); return }
    printWindow.opener = null
    printWindow.document.open()
    printWindow.document.write(reportHtml(report))
    printWindow.document.close()
    await Promise.all([printWindow.document.fonts.ready, ...Array.from(printWindow.document.images).map(image => image.decode().catch(() => undefined))])
    if (!printWindow.closed) { printWindow.focus(); printWindow.print() }
  }
  async function copy() {
    if (!report) return
    try { await navigator.clipboard.writeText(reportPlainText(report)); setMessage("수정된 보고서 내용을 복사했습니다.") }
    catch { setMessage("복사하지 못했습니다. 다운로드를 이용해주세요.") }
  }

  return <div className="document-workspace min-w-0">
    <style>{REPORT_CSS}</style>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <div className="flex items-center gap-2">
        <button type="button" className={TOOL} onClick={() => setLibraryOpen(true)} title="내 문서" aria-label="내 문서"><FolderOpen size={17} /></button>
        <button type="button" className={TOOL} onClick={newReport} title="새 보고서" aria-label="새 보고서"><Plus size={17} /></button>
        <button type="button" className={TOOL} onClick={() => setSourceOpen(value => !value)} title="원문 입력" aria-label="원문 입력" aria-expanded={sourceOpen}>{sourceOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}</button>
        <div className="ml-1 min-w-0"><span className="block max-w-64 truncate text-sm font-bold text-slate-800">{report ? fieldText(report, "title", report.title) : "새 보고서"}</span><span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">{collaboration.document?.members.length ? <Users size={11} /> : <LockKeyhole size={11} />}{collaboration.document?.members.length ? "초대 멤버 전용" : "나만 볼 수 있음"} · A4</span></div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={TOOL} disabled={!canEdit || !(collaboration.document ? collaboration.canUndo : undo.length)} onClick={() => travel("undo")} title="실행 취소" aria-label="실행 취소"><Undo2 size={16} /></button>
        <button type="button" className={TOOL} disabled={!canEdit || !(collaboration.document ? collaboration.canRedo : redo.length)} onClick={() => travel("redo")} title="다시 실행" aria-label="다시 실행"><Redo2 size={16} /></button>
        <button type="button" className={TOOL} disabled={!report} onClick={copy} title="본문 복사" aria-label="본문 복사"><Copy size={16} /></button>
        <button type="button" className={TOOL} disabled={!report} onClick={download} title="서식 포함 다운로드" aria-label="서식 포함 다운로드"><Download size={16} /></button>
        <button type="button" disabled={!report || !canEdit} onClick={saveDraft} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"><Save size={16} />임시저장</button>
        <button type="button" disabled={!report || Boolean(collaboration.document && collaboration.role !== "owner")} onClick={openSharing} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"><Users size={16} />초대</button>
        <button type="button" disabled={!report} onClick={printReport} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-30"><Printer size={16} />PDF / 인쇄</button>
      </div>
    </div>

    {sourceOpen && <fieldset disabled={!canEdit} className="mb-4 border-b border-slate-200 bg-white pb-5 disabled:opacity-60">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <label className="text-xs font-semibold text-slate-500">제목<input className={`${INPUT} mt-1`} value={title} onChange={e => setTitle(e.target.value)} maxLength={150} /></label>
        <label className="text-xs font-semibold text-slate-500">작성 부서 / 작성자<input className={`${INPUT} mt-1`} value={writer} onChange={e => setWriter(e.target.value)} maxLength={80} /></label>
        <label className="text-xs font-semibold text-slate-500">작성일<input type="date" className={`${INPUT} mt-1`} value={date} onChange={e => setDate(e.target.value)} /></label>
      </div>
      <label className="mt-3 block text-xs font-semibold text-slate-500">보고 내용<textarea className={`${INPUT} mt-1 h-48 resize-y py-3 leading-7`} value={source} onChange={e => { sourceChanged.current = true; setSource(e.target.value) }} placeholder={"Ⅰ. 추진 개요\n- 보고 내용을 입력하세요\n\nⅡ. 세부 계획\n가. 추진 방향\n\n| 구분 | 주요 내용 |\n| --- | --- |\n| 추진 과제 | 세부 내용 |\n\nⅢ. 향후 계획"} maxLength={100000} /></label>
      <div className="mt-3 flex justify-end"><button type="button" disabled={!source.trim() || !date} onClick={applySource} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40">양식 적용<ArrowRight size={16} /></button></div>
    </fieldset>}

    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div role="status" className={`flex items-center gap-1.5 text-xs ${collaboration.status === "offline" || collaboration.status === "denied" ? "text-rose-600" : "text-slate-500"}`}>{collaboration.status === "saving" ? <Loader2 size={13} className="animate-spin" /> : collaboration.status === "offline" ? <CloudOff size={13} /> : collaboration.document ? <Cloud size={13} /> : <LockKeyhole size={13} />}{statusLabel}{collaboration.role === "viewer" ? " · 읽기 전용" : ""}</div>
      <div className="flex items-center gap-1.5">{Array.from(new Map(collaboration.presence.map(person => [person.userId, person])).values()).map(person => <span key={person.userId} title={`${person.name}${person.userId === userId ? " (나)" : " · 접속 중"}`} className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${person.userId === userId ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{person.name.slice(-2)}</span>)}</div>
    </div>
    {collaboration.error ? <div role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{collaboration.error}</div> : null}
    {message && !collaboration.document ? <div className="mb-3 text-xs text-slate-500">{message}</div> : null}
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 overflow-visible rounded-lg border border-slate-200 bg-[#e9edf0] px-4 py-6">
        {report ? <RichReportEditor key={collaboration.document?.id || "local"} report={report} yDoc={collaboration.yDoc} editable={canEdit} toolbarTarget={toolbarTarget} onChange={commit} onSelection={setSelected} />
          : <div className="flex min-h-[500px] flex-col items-center justify-center gap-3 text-slate-400"><FileText size={40} strokeWidth={1} /><span className="text-sm">작성된 보고서가 없습니다.</span></div>}
      </div>

      <aside className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-3 lg:max-h-[calc(100dvh-24px)] lg:overflow-y-auto" aria-label="보고서 서식 편집">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">용지 설정</h2></div>
        {peers.some(person => person.field === selected) ? <div className="mb-4 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">{peers.filter(person => person.field === selected).map(person => person.name).join(", ")} 님 편집 중</div> : null}
        <fieldset disabled={!report || !canEdit} className="mt-5 space-y-4 border-t border-slate-100 pt-4 disabled:opacity-40"><legend className="pt-4 text-xs font-bold text-slate-700">용지</legend>
          <label className="block text-xs font-semibold text-slate-500">여백 {report?.page?.margin ?? 18}mm<input type="range" aria-label="용지 여백" min={10} max={30} value={report?.page?.margin ?? 18} onChange={e => report && commit({ ...report, page: { ...report.page, margin: Number(e.target.value) } })} className="mt-2 block w-full accent-blue-600" /></label>
          <label className="block text-xs font-semibold text-slate-500">로고 크기 {report?.page?.logoWidth ?? 145}px<input type="range" aria-label="로고 크기" min={80} max={220} value={report?.page?.logoWidth ?? 145} onChange={e => report && commit({ ...report, page: { ...report.page, logoWidth: Number(e.target.value) } })} className="mt-2 block w-full accent-blue-600" /></label>
        </fieldset>
        <div ref={setToolbarTarget} />
      </aside>
    </div>
    {libraryOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setLibraryOpen(false) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="document-library-title" className="flex max-h-[min(80dvh,720px)] w-full max-w-xl flex-col gap-4 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <header className="flex items-center justify-between"><h2 id="document-library-title" className="text-lg font-bold text-slate-900">내 문서</h2><button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700" onClick={() => setLibraryOpen(false)}>닫기</button></header>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>마지막 저장순</span><button type="button" className="rounded border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40" disabled={collaboration.listStatus === "loading"} onClick={() => void collaboration.list()}>새로고침</button></div>
        {collaboration.listStatus === "loading" ? <div role="status" className="flex items-center gap-2 py-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />문서 불러오는 중</div> : null}
        {collaboration.listError ? <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700"><span>{collaboration.listError}</span><button type="button" className="shrink-0 rounded border border-rose-200 px-2 py-1 font-semibold" onClick={() => void collaboration.list()}>다시 시도</button></div> : null}
        {collaboration.listWarning ? <div role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{collaboration.listWarning}</div> : null}
        <input autoFocus aria-label="문서 검색" placeholder="문서 제목 검색" className={INPUT} value={search} onChange={event => setSearch(event.target.value)} />
        <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">{collaboration.documents.filter(document => document.title.includes(search)).map(document => <button type="button" key={document.id} onClick={() => openDocument(document.id)} className="flex w-full items-center gap-3 px-2 py-4 text-left hover:bg-slate-50"><FileText size={20} className="shrink-0 text-blue-500" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-800">{document.title}</div><div className="mt-1 text-xs text-slate-400">{document.ownerName} · 마지막 저장 {documentSavedAt(document.updatedAt)}</div></div><span className="shrink-0 text-xs text-slate-500">{document.role === "owner" ? document.shared ? "공유 중" : "비공개" : document.role === "editor" ? "공동 편집" : "열람"}</span></button>)}{collaboration.listStatus === "ready" && !collaboration.documents.length ? <div className="py-10 text-center text-sm text-slate-400">저장된 문서가 없습니다.</div> : null}</div>
      </section>
    </div>}
    <Dialog open={sharingOpen} onOpenChange={setSharingOpen}><DialogContent className="max-w-lg rounded-lg"><DialogHeader><DialogTitle>문서 초대</DialogTitle></DialogHeader>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4 text-xs text-slate-500"><LockKeyhole size={14} />초대한 계정만 접근할 수 있습니다.</div>
      <div className="grid grid-cols-[minmax(0,1fr)_100px_auto] gap-2"><select aria-label="초대할 사용자" className={INPUT} value={inviteId} onChange={event => setInviteId(event.target.value)}><option value="">사용자 선택</option>{directory.filter(person => person.id !== userId && !collaboration.document?.members.some(member => member.userId === person.id)).map(person => <option key={person.id} value={person.id}>{person.name} {person.title} · {person.teamName}</option>)}</select><select aria-label="초대 권한" className={INPUT} value={inviteRole} onChange={event => setInviteRole(event.target.value as typeof inviteRole)}><option value="editor">편집 가능</option><option value="viewer">열람만</option></select><button type="button" disabled={!inviteId} onClick={async () => { await collaboration.changeMember(inviteId, inviteRole); setInviteId("") }} className="rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-40">초대</button></div>
      <div className="divide-y divide-slate-100"><div className="flex items-center justify-between py-3 text-sm"><span className="font-semibold text-slate-800">{collaboration.document?.ownerName}</span><span className="text-xs text-slate-400">소유자</span></div>{collaboration.document?.members.map(member => <div key={member.userId} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{member.name}</span><select aria-label={`${member.name} 문서 권한`} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" value={member.role} onChange={event => collaboration.changeMember(member.userId, event.target.value as "editor" | "viewer" | "remove")}><option value="editor">편집 가능</option><option value="viewer">열람만</option><option value="remove">초대 취소</option></select></div>)}</div>
    </DialogContent></Dialog>
  </div>
}
