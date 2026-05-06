import path from "path"
import { redirect } from "next/navigation"
import { requirePageAuth } from "@/lib/auth/server"
import { readDashboardState } from "@/lib/shared-db-store"
import { getUserColorToken, PopupMessageRecord } from "@/lib/auth/model"
import { PersonalDashboard } from "@/components/me/personal-dashboard"
import { buildPersonalDashboardData } from "@/lib/personal-dashboard"
import { getIndustryGroupLabel } from "@/lib/industry-groups"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

export default async function MyPage() {
  const auth = await requirePageAuth()
  if (!auth) redirect("/")

  const dashboard =
    (await readDashboardState<any>(DATA_PATH)) ||
    (await readDashboardState<any>(FALLBACK_PATH)) || { contracts: [], collection: {}, termination: {} }

  const personalData = buildPersonalDashboardData(auth.user, dashboard)
  const messageHistory = (Array.isArray(auth.state.popupMessages) ? auth.state.popupMessages : [])
    .filter((message: PopupMessageRecord) => message.recipientUserId === auth.user.id)
    .sort((a: PopupMessageRecord, b: PopupMessageRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)
  const industryOptions = Array.from(
    new Set(
      [
        ...(Array.isArray(dashboard?.contracts)
          ? dashboard.contracts.map((row: any) => getIndustryGroupLabel(row?.industry, row?.companyName))
          : []),
        ...(Array.isArray(dashboard?.collection?.integrated)
          ? dashboard.collection.integrated.map((row: any) => getIndustryGroupLabel(row?.industry, row?.companyName))
          : []),
        ...(Array.isArray(dashboard?.collection?.longTerm)
          ? dashboard.collection.longTerm.map((row: any) => getIndustryGroupLabel(row?.industry, row?.companyName))
          : []),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "ko"))

  return (
    <PersonalDashboard
      currentUser={{
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.title || auth.user.role,
        teamName: auth.teamName,
        avatarEmoji: auth.user.avatarEmoji || null,
        color: getUserColorToken(auth.user.id),
        assignedIndustries: auth.user.assignedIndustries || [],
        testIdEntries: auth.user.testIdEntries || [],
      }}
      data={{ ...personalData, industryOptions, messageHistory }}
    />
  )
}
