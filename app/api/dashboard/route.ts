import path from "path"
import { NextResponse } from "next/server"
import { readDashboardState, writeDashboardState } from "@/lib/shared-db-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

const EMPTY_DASHBOARD = { ui: {}, contracts: [], termination: {} }

export async function GET() {
  try {
    const data = await readDashboardState<any>(DATA_PATH)
    if (data) return NextResponse.json(data)

    const fallbackData = await readDashboardState<any>(FALLBACK_PATH)
    return NextResponse.json(fallbackData || EMPTY_DASHBOARD)
  } catch (error) {
    console.error("Failed to read dashboard state.", error)
    return NextResponse.json(EMPTY_DASHBOARD)
  }
}

export async function PUT(request: Request) {
  const raw = await request.text()
  let body: any

  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Dashboard state must be a JSON object" }, { status: 400 })
  }

  try {
    await writeDashboardState(body, {
      menuLabel: "Dashboard",
      changeLabel: "Save dashboard state",
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save dashboard state"
    const isReadOnly = message.toLowerCase().includes("read-only")
    return NextResponse.json(
      { ok: false, error: message },
      { status: isReadOnly ? 403 : 500 },
    )
  }
}

export async function POST(request: Request) {
  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 })
  }

  if (body?.action !== "addContract" || !body.contract || typeof body.contract !== "object") {
    return NextResponse.json({ ok: false, error: "Unsupported dashboard action" }, { status: 400 })
  }

  try {
    const data = (await readDashboardState<any>(DATA_PATH)) || (await readDashboardState<any>(FALLBACK_PATH)) || EMPTY_DASHBOARD
    const contracts = Array.isArray(data.contracts) ? data.contracts : []
    const incoming = body.contract
    const incomingId = String(incoming.id || `c${Date.now()}`)
    const nextNo = contracts.reduce((max: number, row: any) => Math.max(max, Number(row?.no || 0)), 0) + 1
    const nextContract = {
      ...incoming,
      id: incomingId,
      no: Number(incoming.no || 0) > 0 ? Number(incoming.no) : nextNo,
      companyName: String(incoming.companyName || "").trim(),
      departmentName: String(incoming.departmentName || "").trim(),
      idCode: String(incoming.idCode || "").trim(),
      industry: String(incoming.industry || "국내증권"),
      contractMonth: String(incoming.contractMonth || "").trim(),
      documentStatus: String(incoming.documentStatus || "미회수"),
      replacementType: String(incoming.replacementType || "신규"),
      includedInWeekly: Boolean(incoming.includedInWeekly),
      recommender: String(incoming.recommender || "").trim(),
      note: String(incoming.note || "").trim(),
    }

    if (!nextContract.companyName || !nextContract.idCode) {
      return NextResponse.json({ ok: false, error: "회사명과 아이디는 필수입니다." }, { status: 400 })
    }

    const withoutDuplicate = contracts.filter((row: any) => String(row?.id || "") !== incomingId)
    const updatedAt = new Date().toISOString()
    const nextData = {
      ...data,
      contracts: [nextContract, ...withoutDuplicate],
      ui: {
        ...(data.ui || {}),
        menuUpdatedAt: {
          ...(data.ui?.menuUpdatedAt || {}),
          contracts: updatedAt,
        },
      },
    }

    await writeDashboardState(nextData, {
      menuLabel: "신규계약 리스트",
      changeLabel: "Register contract",
    })
    return NextResponse.json({ ok: true, data: nextData, contract: nextContract })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register contract"
    const isReadOnly = message.toLowerCase().includes("read-only")
    return NextResponse.json(
      { ok: false, error: message },
      { status: isReadOnly ? 403 : 500 },
    )
  }
}
