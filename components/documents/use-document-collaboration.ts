"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as Y from "yjs"
import type { DocumentReport } from "@/lib/document-report"
import { applyReportChange, base64ToBytes, bytesToBase64, DocumentMember, DocumentPresence, reportFromYDoc, StoredDocument } from "@/lib/document-collaboration"
import type { DocumentSummary } from "@/lib/document-library"
import { deleteLocalDocument, readLocalDocument, writeLocalDocument } from "@/lib/document-local-store"

export function useDocumentCollaboration(userId: string, selection: string, onReport: (report: DocumentReport | null, opened?: boolean) => void, currentReport: DocumentReport | null) {
  const [document, setDocument] = useState<StoredDocument | null>(null)
  const [role, setRole] = useState<"owner" | "editor" | "viewer" | null>(null)
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [listStatus, setListStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [listError, setListError] = useState("")
  const [listWarning, setListWarning] = useState("")
  const listRequest = useRef(0)
  const [presence, setPresence] = useState<DocumentPresence[]>([])
  const [status, setStatus] = useState<"local" | "unsaved" | "saving" | "saved" | "offline" | "denied">("local")
  const [error, setError] = useState("")
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const docRef = useRef<Y.Doc | null>(null)
  const undoRef = useRef<Y.UndoManager | null>(null)
  const metaRef = useRef<StoredDocument | null>(null)
  const roleRef = useRef<typeof role>(null)
  const reportCallback = useRef(onReport)
  reportCallback.current = onReport
  const latestReport = useRef(currentReport)
  latestReport.current = currentReport
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const pending = useRef<Uint8Array[]>([])
  const busy = useRef(false)
  const failures = useRef(0)
  const retryAfter = useRef(0)
  const creating = useRef(false)
  const creationId = useRef<string | null>(null)
  const connectionId = useRef("")
  const syncRef = useRef<(pushLocal?: boolean, reportFailure?: boolean) => Promise<boolean>>(async () => true)
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushCache = useRef<() => void>(() => {})
  const key = (id: string) => `document-crdt:${userId}:${id}`

  const list = useCallback(async () => {
    const request = ++listRequest.current
    setListStatus("loading")
    setListError("")
    try {
      const response = await fetch("/api/documents", { cache: "no-store", signal: AbortSignal.timeout(12000) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      if (!Array.isArray(json.documents)) throw new Error("문서 목록 응답을 확인할 수 없습니다.")
      if (request !== listRequest.current) return
      setDocuments(json.documents)
      setListWarning(json.unavailableCount ? "일부 문서의 목록 정보를 확인하지 못했습니다. 원본 문서는 삭제되지 않았습니다." : "")
      setListStatus("ready")
    } catch {
      if (request !== listRequest.current) return
      setListError("문서 목록을 불러오지 못했습니다. 다시 시도해주세요.")
      setListStatus("error")
    }
  }, [])

  useEffect(() => { connectionId.current = crypto.randomUUID(); void list() }, [list])
  useEffect(() => () => { if (cacheTimer.current) clearTimeout(cacheTimer.current); flushCache.current(); docRef.current?.destroy(); undoRef.current?.destroy() }, [])

  async function attach(row: StoredDocument, nextRole: typeof role, mergeLocal = true) {
    let localSnapshot: string | null = null
    let recoveryError = ""
    if (mergeLocal && nextRole !== "viewer") {
      try { localSnapshot = await readLocalDocument(key(row.id)) }
      catch { recoveryError = "브라우저 임시 문서를 읽지 못했습니다. 현재 서버 문서는 그대로 유지됩니다." }
    }
    if (cacheTimer.current) clearTimeout(cacheTimer.current)
    flushCache.current()
    window.removeEventListener("pagehide", flushCache.current)
    undoRef.current?.destroy()
    docRef.current?.destroy()
    const doc = new Y.Doc()
    Y.applyUpdate(doc, base64ToBytes(row.state), "remote")
    pending.current = []
    if (localSnapshot) {
      try {
        const serverVector = Y.encodeStateVector(doc)
        Y.applyUpdate(doc, base64ToBytes(localSnapshot), "recovery")
        const difference = Y.encodeStateAsUpdate(doc, serverVector)
        if (difference.length > 2) pending.current.push(difference)
      } catch { recoveryError = "임시 보관 내용을 복구하지 못했습니다." }
    }
    const report = reportFromYDoc(doc)
    docRef.current = doc
    metaRef.current = row
    roleRef.current = nextRole
    setDocument(row)
    setRole(nextRole)
    const manager = new Y.UndoManager(Array.from(doc.share.values()), { trackedOrigins: new Set(["local"]), captureTimeout: 500 })
    undoRef.current = manager
    const updateUndo = () => { setCanUndo(manager.undoStack.length > 0); setCanRedo(manager.redoStack.length > 0) }
    manager.on("stack-item-added", updateUndo)
    manager.on("stack-item-popped", updateUndo)
    manager.on("stack-cleared", updateUndo)
    updateUndo()
    const persistSnapshot = async () => {
      try { await writeLocalDocument(key(row.id), bytesToBase64(Y.encodeStateAsUpdate(doc))) }
      catch { setError("브라우저 임시 보관에 실패했습니다. 현재 화면의 내용은 유지 중입니다. 상단 임시저장을 눌러 서버에 저장해주세요.") }
    }
    const flushSnapshot = () => {
      if (cacheTimer.current) clearTimeout(cacheTimer.current)
      cacheTimer.current = null
      void persistSnapshot()
    }
    flushCache.current = flushSnapshot
    window.addEventListener("pagehide", flushSnapshot)
    doc.on("update", (update, origin) => {
      if (origin !== "remote") { pending.current.push(update); setStatus("unsaved") }
      if (cacheTimer.current) clearTimeout(cacheTimer.current)
      cacheTimer.current = setTimeout(flushSnapshot, 1200)
      updateUndo()
    })
    setStatus(pending.current.length ? "unsaved" : "saved")
    failures.current = 0
    retryAfter.current = 0
    setError(recoveryError)
    reportCallback.current(report, true)
  }

  async function open(id: string) {
    if (metaRef.current && pending.current.length) {
      setError("저장되지 않은 변경 내용이 있습니다. 임시저장을 완료한 뒤 문서를 여세요.")
      return false
    }
    try {
      const response = await fetch(`/api/documents/${id}?encoding=gzip`, { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      if (json.role !== "viewer") {
        const existing = new Y.Doc()
        let initialized: boolean
        try { Y.applyUpdate(existing, base64ToBytes(json.document.state)); initialized = Boolean(existing.getMap("report").get("richInitialized")) }
        finally { existing.destroy() }
        if (initialized) { await attach(json.document, json.role); return true }
        let recovery: string | null = null
        try { const cached = await readLocalDocument(key(id)); if (cached) recovery = bytesToBase64(base64ToBytes(cached)) } catch {}
        const initialization = await fetch(`/api/documents/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "initialize", encoding: "gzip", ...(recovery ? { update: recovery } : {}) }) })
        const migrated = await initialization.json()
        if (!initialization.ok) throw new Error(migrated.error)
        await attach(migrated.document, migrated.role)
        return true
      }
      await attach(json.document, json.role)
      return true
    } catch (error) { setError(error instanceof Error ? error.message : "문서를 열지 못했습니다."); return false }
  }

  async function create(report: DocumentReport) {
    if (creating.current) return false
    creating.current = true
    setStatus("saving")
    let id = creationId.current
    try { id ||= sessionStorage.getItem(`document-creation:${userId}`) } catch {}
    id ||= crypto.randomUUID()
    creationId.current = id
    try { sessionStorage.setItem(`document-creation:${userId}`, id) } catch {}
    try {
      const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, reportData: bytesToBase64(new TextEncoder().encode(JSON.stringify(report))), encoding: "gzip" }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      const latest = latestReport.current || report
      await attach(json.document, json.role, false)
      if (docRef.current) applyReportChange(docRef.current, latest, reportFromYDoc(docRef.current))
      creationId.current = null
      try { sessionStorage.removeItem(`document-creation:${userId}`) } catch {}
      void list()
      return true
    } catch (error) { setStatus("offline"); setError(error instanceof Error ? error.message : "임시저장에 실패했습니다."); return false }
    finally { creating.current = false }
  }

  syncRef.current = async (pushLocal = false, reportFailure = false) => {
    const doc = docRef.current
    const meta = metaRef.current
    if (!doc || !meta) return true
    if (status === "denied") return false
    if (busy.current && !pushLocal) return false
    while (busy.current) await new Promise(resolve => setTimeout(resolve, 40))
    if (docRef.current !== doc || metaRef.current?.id !== meta.id) return false
    if (pushLocal && Date.now() < retryAfter.current) return false
    busy.current = true
    const outgoing = pushLocal ? pending.current.splice(0) : []
    try {
      const response = pushLocal
        ? await fetch(`/api/documents/${meta.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sync", encoding: "gzip", vector: bytesToBase64(Y.encodeStateVector(doc)), ...(outgoing.length ? { update: bytesToBase64(Y.mergeUpdates(outgoing)) } : {}), field: selectionRef.current, connectionId: connectionId.current }), signal: AbortSignal.timeout(12000) })
        : await fetch(`/api/documents/${meta.id}?encoding=gzip`, { cache: "no-store", signal: AbortSignal.timeout(12000) })
      const json = await response.json()
      if (docRef.current !== doc) return true
      if (response.status === 403 || response.status === 401) {
        setStatus("denied"); setRole(null); roleRef.current = null; setError(json.error || "접근 권한이 없습니다.")
        if (response.status === 403) { void deleteLocalDocument(key(meta.id)).catch(() => {}); reportCallback.current(null) }
        return false
      }
      if (!response.ok) throw new Error(json.error)
      let members = json.members
      let updatedAt = json.updatedAt
      let version = json.version
      let nextPresence = json.presence
      if (pushLocal) {
        Y.applyUpdate(doc, base64ToBytes(json.update), "remote")
      } else {
        const remote = new Y.Doc()
        try {
          Y.applyUpdate(remote, base64ToBytes(json.document.state))
          const difference = Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc))
          if (difference.length > 2) Y.applyUpdate(doc, difference, "remote")
        } finally { remote.destroy() }
        members = json.document.members
        updatedAt = json.document.updatedAt
        version = json.document.version
        nextPresence = json.document.presence.filter((person: DocumentPresence) => Date.now() - person.seenAt < 30000)
      }
      setPresence(nextPresence || [])
      setRole(json.role)
      roleRef.current = json.role
      const next = { ...meta, members, updatedAt, version }
      metaRef.current = next
      setDocument(next)
      setStatus(pending.current.length ? "unsaved" : "saved")
      failures.current = 0
      retryAfter.current = 0
      setError("")
      return !pending.current.length
    } catch (error) {
      if (docRef.current === doc) {
        if (pushLocal) {
          pending.current.unshift(...outgoing)
          setStatus("offline")
          failures.current++
          retryAfter.current = Date.now() + Math.min(30000, 1000 * 2 ** Math.min(failures.current, 5))
          setError(error instanceof Error ? error.message : "저장하지 못했습니다. 변경 내용은 브라우저에 보관되어 있습니다.")
        } else if (reportFailure) {
          setError(error instanceof Error ? error.message : "문서를 확인하지 못했습니다.")
        }
      }
      return false
    } finally { busy.current = false }
  }

  useEffect(() => {
    if (!document?.id) return
    const interval = setInterval(() => { if (!window.document.hidden && !pending.current.length) void syncRef.current(false) }, 15000)
    const onFocus = () => { if (!pending.current.length) void syncRef.current(false) }
    const onLeave = (event: BeforeUnloadEvent) => { if (pending.current.length) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onFocus)
    window.addEventListener("beforeunload", onLeave)
    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); window.removeEventListener("beforeunload", onLeave) }
  }, [document?.id])

  function apply(next: DocumentReport, previous: DocumentReport) {
    if (!docRef.current || !["owner", "editor"].includes(roleRef.current || "")) return false
    applyReportChange(docRef.current, next, previous)
    undoRef.current?.addToScope(Array.from(docRef.current.share.values()))
    return true
  }
  async function changeMember(memberId: string, memberRole: DocumentMember["role"] | "remove") {
    if (!metaRef.current || roleRef.current !== "owner") return
    try {
      const response = await fetch(`/api/documents/${metaRef.current.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "members", userId: memberId, role: memberRole }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      const next = { ...metaRef.current, members: json.members }
      metaRef.current = next
      setDocument(next)
      setError("")
      void list()
    } catch (error) { setError(error instanceof Error ? error.message : "초대 권한을 변경하지 못했습니다.") }
  }
  async function detach() {
    if (pending.current.length) {
      setError("저장되지 않은 변경 내용이 있습니다. 임시저장을 완료한 뒤 이동하세요.")
      return false
    }
    undoRef.current?.destroy(); docRef.current?.destroy()
    docRef.current = null; metaRef.current = null; roleRef.current = null; creationId.current = null; pending.current = []
    setDocument(null); setRole(null); setStatus("local"); setPresence([]); setError("")
    return true
  }
  return { yDoc: docRef.current, document, role, documents, listStatus, listError, listWarning, presence, status, error, list, open, create, apply, detach, changeMember, save: () => { retryAfter.current = 0; return syncRef.current(true, true) }, canUndo, canRedo,
    undo: () => undoRef.current?.undo(), redo: () => undoRef.current?.redo() }
}
