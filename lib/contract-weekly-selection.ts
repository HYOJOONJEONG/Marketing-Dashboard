function key(row: any) {
  return row?.id ? `id:${String(row.id).trim()}` : `code:${String(row?.idCode || "").trim().toUpperCase()}`
}

function selectionTime(row: any) {
  return Date.parse(String(row?.includedInWeeklyUpdatedAt || row?.weeklySelectionUpdatedAt || "")) || 0
}

// A full-list save is not evidence that an unchanged checkbox was clicked.
export function preserveContractWeeklySelections(existing: any[], incoming: any[]) {
  const byKey = new Map(existing.map((row) => [key(row), row]))
  return incoming.map((row) => {
    const previous = byKey.get(key(row))
    if (!previous) return row
    const previousTime = selectionTime(previous)
    const nextTime = selectionTime(row)
    if (nextTime > previousTime || (!previousTime && !nextTime && row.includedInWeekly)) return row
    return {
      ...row,
      includedInWeekly: Boolean(previous.includedInWeekly),
      includedInWeeklyUpdatedAt: previous.includedInWeeklyUpdatedAt,
      weeklySelectionUpdatedAt: previous.weeklySelectionUpdatedAt,
      includedInWeeklyUpdatedBy: previous.includedInWeeklyUpdatedBy,
    }
  })
}

export function mergeContractSelectionJson(existing: string | null, incoming: string, deletedIds: string[] = []) {
  const rows = JSON.parse(incoming)
  const previous = existing ? JSON.parse(existing) : []
  if (!Array.isArray(rows) || !Array.isArray(previous)) throw new Error("Invalid contracts data")
  const deleted = new Set(deletedIds)
  const incomingKeys = new Set(rows.map(key))
  const merged = [...preserveContractWeeklySelections(previous, rows),
    ...previous.filter((row) => !incomingKeys.has(key(row)))]
  return JSON.stringify(merged.filter((row) => !deleted.has(String(row.id || ""))))
}

export function appendContractHistory(history: string | null, previous: string | null, next: string, change: string) {
  const entries = history ? JSON.parse(history) : []
  if (!previous || previous === next) return JSON.stringify(entries)
  return JSON.stringify([...entries.slice(-19), {
    savedAt: new Date().toISOString(),
    change,
    contracts: JSON.parse(previous),
  }])
}

// Compare and write all affected slices together; another writer forces a re-read.
export const CONTRACT_SELECTION_CAS = `
local current = redis.call('GET', KEYS[1])
if (current or '') ~= ARGV[1] then return 0 end
local deleted = redis.call('GET', KEYS[2])
if (deleted or '') ~= ARGV[2] then return 0 end
for i = 1, #KEYS do redis.call('SET', KEYS[i], ARGV[i + 2]) end
return 1
`
