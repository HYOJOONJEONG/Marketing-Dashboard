import fs from "fs/promises"
import path from "path"
import initSqlJs from "sql.js"

type OptionCategory = {
  category_code: string
  category_name_ko: string
  display_order: number
}

type OptionRecord = {
  category_code: string
  sub_type: string
  company_name: string
  user_id: string
  department: string
  requester_name: string
  billing_month: string
  status: string
  note: string
  is_active?: number
}

type SummaryCount = { category_code: string; count: number }

const DB_PATH = path.join(process.cwd(), "data", "options_dashboard.db")
const MOCK_PATH = path.join(process.cwd(), "data", "options-dashboard.mock.json")

let dbPromise: Promise<any | null> | null = null

async function getDatabase() {
  if (dbPromise) return dbPromise
  dbPromise = (async () => {
    try {
      const buffer = await fs.readFile(DB_PATH)
      const SQL = await initSqlJs({
        locateFile: (file: string) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
      })
      return new SQL.Database(new Uint8Array(buffer))
    } catch (error) {
      return null
    }
  })()
  return dbPromise
}

function queryRows(db: any, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: any[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

async function loadMockData() {
  try {
    const raw = await fs.readFile(MOCK_PATH, "utf8")
    return JSON.parse(raw)
  } catch (error) {
    return {
      categories: [],
      summary: [],
      historyDates: [],
      records: [],
      activeCounts: [],
    }
  }
}

export async function fetchOptionDashboardData(args: {
  basis: "snapshot" | "latest" | "date"
  date?: string
  category?: string
  status?: string
  query?: string
  activeOnly?: boolean
}) {
  const db = await getDatabase()
  if (!db) {
    return loadMockData()
  }

  let categories: OptionCategory[] = []
  let historyDates: string[] = []
  let summary: SummaryCount[] = []
  let seedCounts: SummaryCount[] = []
  let activeCounts: SummaryCount[] = []

  try {
    categories = queryRows(
      db,
      "SELECT category_code, category_name_ko, display_order FROM category_master ORDER BY display_order ASC",
    ) as OptionCategory[]
  } catch {}

  try {
    historyDates = queryRows(
      db,
      "SELECT DISTINCT snapshot_date FROM history_counts ORDER BY snapshot_date DESC",
    ).map((row) => String(row.snapshot_date))
  } catch {}

  try {
    seedCounts = queryRows(
      db,
      "SELECT category_code, count FROM dashboard_seed_counts WHERE snapshot_label = ?",
      ["screenshot_current"],
    ) as SummaryCount[]
  } catch {}

  try {
    activeCounts = queryRows(
      db,
      "SELECT category_code, count FROM v_current_active_counts",
    ) as SummaryCount[]
  } catch {}

  if (args.basis === "snapshot") {
    summary = seedCounts
  } else if (args.basis === "latest") {
    try {
      summary = queryRows(db, "SELECT category_code, count FROM v_dashboard_card_counts") as SummaryCount[]
    } catch {}
  } else if (args.basis === "date" && args.date) {
    try {
      summary = queryRows(
        db,
        "SELECT category_code, count FROM history_counts WHERE snapshot_date = ?",
        [args.date],
      ) as SummaryCount[]
    } catch {}
  }

  const seedMap = new Map(seedCounts.map((row) => [row.category_code, Number(row.count || 0)]))
  const summaryMap = new Map(summary.map((row) => [row.category_code, Number(row.count || 0)]))
  const fallbackCategories = new Set(
    categories
      .filter((row) => ["전광판", "API"].includes(String(row.category_name_ko)))
      .map((row) => row.category_code),
  )

  categories.forEach((category) => {
    const current = summaryMap.get(category.category_code) ?? 0
    if ((current === 0 || Number.isNaN(current)) && fallbackCategories.has(category.category_code)) {
      summaryMap.set(category.category_code, seedMap.get(category.category_code) ?? 0)
    }
  })

  summary = categories.map((category) => ({
    category_code: category.category_code,
    count: summaryMap.get(category.category_code) ?? 0,
  }))

  const conditions: string[] = []
  const params: any[] = []
  if (args.category && args.category !== "all") {
    conditions.push("category_code = ?")
    params.push(args.category)
  }
  if (args.status && args.status !== "all") {
    conditions.push("status = ?")
    params.push(args.status)
  }
  if (args.activeOnly !== false) {
    conditions.push("is_active = 1")
  }
  if (args.query) {
    conditions.push("(company_name LIKE ? OR user_id LIKE ? OR department LIKE ?)")
    const like = `%${args.query}%`
    params.push(like, like, like)
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  let records: OptionRecord[] = []
  try {
    records = queryRows(
      db,
      `SELECT category_code, sub_type, company_name, user_id, department, '' AS requester_name, billing_month, status, note, is_active
       FROM option_records
       ${whereClause}
       ORDER BY category_code ASC, company_name ASC`,
      params,
    ) as OptionRecord[]
  } catch {}

  return {
    categories,
    summary,
    historyDates,
    records,
    activeCounts,
  }
}
