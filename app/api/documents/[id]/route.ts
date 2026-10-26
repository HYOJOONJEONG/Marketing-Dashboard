import * as Y from "yjs"
import { NextResponse } from "next/server"
import { resolveRequestSession } from "@/lib/auth/session"
import { documentStorage, updateStoredDocument, validDocumentId } from "@/lib/document-store"
import { base64ToBytes, bytesToBase64, documentRole, initializeRichDocument, reportFromYDoc, StoredDocument, validateReport } from "@/lib/document-collaboration"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const session = await resolveRequestSession()
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401, headers })
  const { id } = await context.params
  if (!validDocumentId(id)) return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404, headers })
  try {
    const raw = await documentStorage({ action: "read", id })
    const document: StoredDocument | null = raw ? JSON.parse(raw) : null
    const role = document && documentRole(document, session.user.id)
    if (!document || !role) return NextResponse.json({ error: "문서를 찾을 수 없거나 초대받지 않은 문서입니다." }, { status: 404, headers })
    return NextResponse.json({ document, role }, { headers })
  } catch {
    return NextResponse.json({ error: "문서를 불러오지 못했습니다." }, { status: 503, headers })
  }
}

export async function POST(request: Request, context: Context) {
  const session = await resolveRequestSession()
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401, headers })
  const { id } = await context.params
  if (!validDocumentId(id)) return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404, headers })
  try {
    const body = await request.json()
    if (JSON.stringify(body).length > 900000) return NextResponse.json({ error: "저장 요청이 너무 큽니다." }, { status: 413, headers })
    let denied = false
    const document = await updateStoredDocument(id, current => {
      const role = current && documentRole(current, session.user.id)
      if (!current || !role) { denied = true; return null }
      if (body.action === "initialize") {
        if (role === "viewer") { denied = true; return null }
        const doc = new Y.Doc()
        try {
          Y.applyUpdate(doc, base64ToBytes(current.state))
          if (!doc.getMap("report").get("richInitialized") && typeof body.update === "string") {
            Y.applyUpdate(doc, base64ToBytes(body.update))
            if (!validateReport(reportFromYDoc(doc))) throw new Error("문서 내용을 확인해주세요.")
          }
          if (!initializeRichDocument(doc)) return null
          const state = bytesToBase64(Y.encodeStateAsUpdate(doc))
          if (state.length > 1100000) throw new Error("문서 용량 한도를 초과했습니다.")
          return { ...current, state, version: current.version + 1 }
        } finally { doc.destroy() }
      }
      if (body.action === "members") {
        if (role !== "owner") { denied = true; return null }
        const user = session.state.users.find(user => user.id === body.userId && user.active && !user.deletedAt)
        if (!user || user.id === current.ownerId) throw new Error("초대할 사용자를 확인해주세요.")
        const members = current.members.filter(member => member.userId !== user.id)
        if (body.role === "editor" || body.role === "viewer") members.push({ userId: user.id, name: user.name, role: body.role })
        else if (body.role !== "remove") throw new Error("권한을 확인해주세요.")
        if (members.length > 30) throw new Error("초대 인원이 너무 많습니다.")
        return { ...current, members, presence: current.presence.filter(person => person.userId === current.ownerId || members.some(member => member.userId === person.userId)), version: current.version + 1 }
      }
      if (body.action !== "sync") throw new Error("잘못된 요청입니다.")
      if (body.update && role === "viewer") { denied = true; return null }
      let state = current.state
      let title = current.title
      if (body.update) {
        if (typeof body.update !== "string") throw new Error("잘못된 저장 요청입니다.")
        const doc = new Y.Doc()
        try {
          Y.applyUpdate(doc, base64ToBytes(state))
          Y.applyUpdate(doc, base64ToBytes(body.update))
          const report = reportFromYDoc(doc)
          if (!validateReport(report)) throw new Error("문서 내용이 올바르지 않습니다.")
          title = report.fields?.title?.text || report.title
          state = bytesToBase64(Y.encodeStateAsUpdate(doc))
          if (state.length > 1100000) throw new Error("문서 용량 한도를 초과했습니다.")
        } finally { doc.destroy() }
      }
      const now = Date.now()
      const connectionId = String(body.connectionId || "").slice(0, 80)
      const person = current.presence.find(person => person.connectionId === connectionId && person.userId === session.user.id)
      const presenceChanged = !person || now - person.seenAt > 10000 || person.field !== String(body.field || "").slice(0, 100)
      if (!body.update && !presenceChanged) return null
      return { ...current, state, title, version: current.version + (state !== current.state ? 1 : 0), updatedAt: state !== current.state ? new Date().toISOString() : current.updatedAt,
        presence: [...current.presence.filter(person => now - person.seenAt < 30000 && person.connectionId !== connectionId), { userId: session.user.id, name: session.user.name, connectionId, field: String(body.field || "").slice(0, 100), seenAt: now }].slice(-40) }
    })
    if (denied || !document) return NextResponse.json({ error: "이 문서에 접근하거나 수정할 권한이 없습니다." }, { status: 403, headers })
    if (body.action === "members") return NextResponse.json({ members: document.members }, { headers })
    if (body.action === "initialize") return NextResponse.json({ document, role: documentRole(document, session.user.id) }, { headers })
    const doc = new Y.Doc()
    let update: string
    try {
      Y.applyUpdate(doc, base64ToBytes(document.state))
      update = bytesToBase64(Y.encodeStateAsUpdate(doc, typeof body.vector === "string" ? base64ToBytes(body.vector) : undefined))
    } finally { doc.destroy() }
    return NextResponse.json({ update, version: document.version, updatedAt: document.updatedAt, members: document.members, role: documentRole(document, session.user.id), presence: document.presence.filter(person => Date.now() - person.seenAt < 30000) }, { headers })
  } catch {
    return NextResponse.json({ error: "동기화하지 못했습니다. 변경 내용을 보관하고 다시 시도합니다." }, { status: 503, headers })
  }
}
