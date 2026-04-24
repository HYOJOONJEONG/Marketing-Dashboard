import { redirect } from "next/navigation"
import { AdminConsole } from "@/components/admin/admin-console"
import { requirePagePermission } from "@/lib/auth/server"
import { getUserColorToken } from "@/lib/auth/model"

export default async function AdminPage() {
  const auth = await requirePagePermission("adminPage", "view")
  if (!auth) redirect("/")

  return (
    <AdminConsole
      currentUser={{
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.title || auth.user.role,
        teamName: auth.teamName,
        avatarEmoji: auth.user.avatarEmoji || null,
        color: getUserColorToken(auth.user.id),
      }}
      permissions={auth.permissionIndex as any}
    />
  )
}
