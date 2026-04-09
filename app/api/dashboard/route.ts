import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")

export async function GET() {
  const content = await fs.readFile(DATA_PATH, "utf8")
  return NextResponse.json(JSON.parse(content.replace(/^\uFEFF/, "")))
}

export async function PUT(request: Request) {
  const body = await request.json()
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true })
  await fs.writeFile(DATA_PATH, JSON.stringify(body, null, 2), "utf8")
  return NextResponse.json({ ok: true })
}
