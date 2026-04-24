"use client"

import { useState } from "react"
import { DashboardShell } from "@/components/dashboard-shell"

type Props = {
  initialData: any
  initialView: string
  initialCollectionTab: string
  currentUser: {
    id: string
    name: string
    role: string
    teamName: string
    avatarEmoji?: string | null
    color: { bg: string; text: string; border: string; hex: string }
  }
  permissions: Record<string, Record<string, boolean>>
}

export function DashboardWorkspace({
  initialData,
  initialView,
  initialCollectionTab,
  currentUser,
  permissions,
}: Props) {
  const [currentSection, setCurrentSection] = useState(initialView)

  return (
    <div className="min-h-screen bg-[#f6f8fc] px-4 py-4">
      <DashboardShell
        initialData={initialData}
        initialView={initialView as any}
        initialCollectionTab={initialCollectionTab as any}
        currentUser={currentUser}
        permissions={permissions}
        onViewChange={setCurrentSection}
      />
    </div>
  )
}
