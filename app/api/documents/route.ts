import crypto from "crypto"
import * as Y from "yjs"
import { NextResponse } from "next/server"
import { resolveRequestSession } from "@/lib/auth/session"
import { documentStorage, updateStoredDocument } from "@/lib/document-store"
import { applyReportChange, bytesToBase64, documentRole, StoredDocument, validateReport } from "@/lib/document-collaboration"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  const session = await resolveRequestSession()
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401, headers })
  try {
    if (new URL(request.url).searchParams.get("directory") === "1") {
      return NextResponse.json({ users: session.state.users.filter(user => user.active && !user.deletedAt).map(user => ({ id: user.id, name: user.name, title: user.title || "", teamName: session.state.teams.find(team => team.id === user.teamId)?.name || "" })) }, { headers })
    }
    const rows = await documentStorage({ action: "list", userId: session.user.id }) as Array<string | null>
    const documents = rows.filter(Boolean).map(raw => JSON.parse(raw!) as StoredDocument).filter(row => documentRole(row, session.user.id)).map(row => ({ id: row.id, title: row.title, ownerName: row.ownerName, role: documentRole(row, session.user.id), updatedAt: row.updatedAt, shared: row.members.length > 0 }))
    documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return NextResponse.json({ documents }, { headers })
  } catch {
    return NextResponse.json({ error: "문서 목록을 불러오지 못했습니다." }, { status: 503, headers })
  }
}

export async function POST(request: Request) {
  const session = await resolveRequestSession()
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401, headers })
  try {
    const body = await request.json()
    if (!validateReport(body.report)) return NextResponse.json({ error: "문서 내용이 올바르지 않거나 너무 큽니다." }, { status: 400, headers })
    const id = typeof body.id === "string" && /^[a-f0-9-]{36}$/.test(body.id) ? body.id : crypto.randomUUID()
    const doc = new Y.Doc()
    applyReportChange(doc, body.report)
    const state = bytesToBase64(Y.encodeStateAsUpdate(doc))
    doc.destroy()
    const now = new Date().toISOString()
    const document = await updateStoredDocument(id, current => {
      if (current) {
        if (current.ownerId !== session.user.id) throw new Error("접근할 수 없습니다.")
        return null
      }
      return { id, ownerId: session.user.id, ownerName: session.user.name, title: body.report.title, members: [], createdAt: now, updatedAt: now, version: 1, state, presence: [] }
    })
    return NextResponse.json({ document, role: "owner" }, { status: 201, headers })
  } catch {
    return NextResponse.json({ error: "문서를 저장하지 못했습니다. 입력 내용은 브라우저에 보관됩니다." }, { status: 503, headers })
  }
}
