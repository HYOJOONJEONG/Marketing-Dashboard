export const DOMESTIC_SECURITIES_GROUPS = ["국내증권 가~사", "국내증권 아~하"] as const

function trimText(value: unknown) {
  return String(value ?? "").trim()
}

function findFirstHangulCharacter(text: string) {
  return [...text].find((char) => /[가-힣]/.test(char)) || ""
}

export function getIndustryGroupLabel(industry: unknown, companyName?: unknown) {
  const baseIndustry = trimText(industry)
  if (!baseIndustry) return ""
  if (baseIndustry !== "국내증권") return baseIndustry

  const firstHangul = findFirstHangulCharacter(trimText(companyName))
  if (firstHangul && firstHangul >= "가" && firstHangul <= "사") {
    return DOMESTIC_SECURITIES_GROUPS[0]
  }

  return DOMESTIC_SECURITIES_GROUPS[1]
}

export function normalizeAssignedIndustries(values: unknown) {
  const items = Array.isArray(values) ? values : []
  const normalized = new Set<string>()

  items.forEach((value) => {
    const text = trimText(value)
    if (!text) return
    if (text === "국내증권") {
      DOMESTIC_SECURITIES_GROUPS.forEach((item) => normalized.add(item))
      return
    }
    normalized.add(text)
  })

  return Array.from(normalized)
}
