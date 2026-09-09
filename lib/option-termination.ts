export function optionCustomerIds(value: unknown): string[] {
  return [...new Set((String(value || "").match(/\bE\d{6}\b/gi) || []).map((id) => id.toUpperCase()))]
}

function dateKey(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "")
  return digits.length === 8 ? digits : digits.length === 6 ? `20${digits}` : ""
}

export function filterConfirmedOptions(records: any[], termination: any) {
  const sheets = Array.isArray(termination?.sheets) ? termination.sheets : []
  const sheet = sheets.find((item: any) => item.id === termination?.currentSheetId) || sheets[0]
  const confirmed = new Map<string, string>()
  for (const row of sheet?.confirmedItems || []) {
    for (const id of optionCustomerIds(row.customerId || row.idCode)) {
      const date = dateKey(row.terminationDate || row.reflectedDate)
      if (!confirmed.has(id) || date > confirmed.get(id)!) confirmed.set(id, date)
    }
  }
  return records.flatMap((row) => {
    const ids = optionCustomerIds(row.apply_ids).length ? optionCustomerIds(row.apply_ids) : optionCustomerIds(row.user_id)
    const requested = dateKey(row.request_date)
    const remaining = ids.filter((id) => !confirmed.has(id) || (requested && confirmed.get(id) && requested > confirmed.get(id)!))
    if (!ids.length || remaining.length === ids.length) return [row]
    if (!remaining.length) return []
    return [{ ...row, user_id: remaining.join(", "), ...(row.apply_ids ? { apply_ids: remaining.join(", "), apply_count: String(remaining.length) } : {}) }]
  })
}

export function buildOptionLabels(records: any[], labels: Record<string, string>) {
  const result: Record<string, string[]> = {}
  for (const row of records) {
    if (row.category_code === "API" || (row.category_code !== "BOND" && Number(row.is_active) !== 1)) continue
    const label = labels[row.category_code] || row.category_name_ko
    if (!label) continue
    for (const id of [...optionCustomerIds(row.user_id), ...optionCustomerIds(row.apply_ids)]) {
      const values = result[id] || (result[id] = [])
      if (!values.includes(label)) values.push(label)
    }
  }
  return result
}
