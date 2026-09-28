function idText(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function mergeText(value: unknown) {
  return String(value ?? "").replace(/[^a-zA-Z0-9가-힣]/g, "").toUpperCase()
}

function normalizedDate(value: unknown) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "").slice(0, 8)
  return digits.length === 8 ? `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}` : String(value ?? "").trim()
}

export type TypeAnalysisRecordKind = "new" | "termination"

export function typeAnalysisRecordKey(kind: TypeAnalysisRecordKind, record: any) {
  const sourceId = idText(record?.sourceId)
  const idCode = idText(record?.idCode || record?.customerId)
  const company = mergeText(record?.companyName)
  const department = mergeText(record?.departmentName)
  const reflectedDate = normalizedDate(record?.date || record?.registrationDate || record?.receivedDate || record?.terminationDate)

  if (sourceId) return `${kind}:source:${sourceId}`
  if (idCode) return `${kind}:id:${idCode}:${company}:${department}:${reflectedDate}`
  return `${kind}:fallback:${reflectedDate}:${company}:${department}`
}

function mergeRecords(current: any[], incoming: any[], kind: TypeAnalysisRecordKind, deletedKeys: Set<string>) {
  const order: string[] = []
  const rows = new Map<string, any>()
  const put = (row: any) => {
    const key = typeAnalysisRecordKey(kind, row)
    if (!key || deletedKeys.has(key)) return
    if (!rows.has(key)) order.push(key)
    rows.set(key, { ...(rows.get(key) || {}), ...row })
  }
  ;(Array.isArray(current) ? current : []).forEach(put)
  ;(Array.isArray(incoming) ? incoming : []).forEach(put)
  return order.map((key, index) => ({ ...rows.get(key), no: index + 1 }))
}

export function mergeTypeAnalysisState(current: any, incoming: any, deletedRecordKeys: string[] = []) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return current
  if (!current || typeof current !== "object" || Array.isArray(current)) return incoming
  const deletedKeys = new Set(deletedRecordKeys.map(String))
  const newRecords = mergeRecords(
    current?.newReplacement?.records,
    incoming?.newReplacement?.records,
    "new",
    deletedKeys,
  )
  const terminationRecords = mergeRecords(
    current?.terminationType?.records,
    incoming?.terminationType?.records,
    "termination",
    deletedKeys,
  )
  return {
    ...current,
    ...incoming,
    newReplacement: {
      ...(current?.newReplacement || {}),
      ...(incoming?.newReplacement || {}),
      records: newRecords,
    },
    terminationType: {
      ...(current?.terminationType || {}),
      ...(incoming?.terminationType || {}),
      records: terminationRecords,
    },
  }
}
