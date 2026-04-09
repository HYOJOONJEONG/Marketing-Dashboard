import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

export async function GET() {
  const content = await fs.readFile(DATA_PATH, "utf8")
  try {
    return NextResponse.json(JSON.parse(content.replace(/^\uFEFF/, "")))
  } catch (error) {
    try {
      const fallback = await fs.readFile(FALLBACK_PATH, "utf8")
      const data = JSON.parse(fallback.replace(/^\uFEFF/, ""))
      await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8")
      return NextResponse.json(data)
    } catch (fallbackError) {
      console.error("Failed to parse app-state.json and fallback.", error, fallbackError)
      return NextResponse.json({ ui: {}, contracts: [], termination: {} })
    }
  }
}

export async function PUT(request: Request) {
  const raw = await request.text()
  let body: any
  try {
    body = JSON.parse(raw)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload" },
      { status: 400 },
    )
  }
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true })
  const tempPath = `${DATA_PATH}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(body, null, 2), "utf8")
  await fs.rename(tempPath, DATA_PATH)
  return NextResponse.json({ ok: true })
}
