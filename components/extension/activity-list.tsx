"use client"

import { ArrowUpRight, ArrowDownLeft, RefreshCw, Vote, MessageSquare, History } from "lucide-react"
import { cn } from "@/lib/utils"

type ActivityType = "send" | "receive" | "swap" | "vote" | "comment"

interface Activity {
  id: string
  type: ActivityType
  title: string
  description: string
  amount?: string
  timestamp: string
  status?: "pending" | "completed" | "failed"
}

const activityIcons: Record<ActivityType, React.ReactNode> = {
  send: <ArrowUpRight className="h-4 w-4" />,
  receive: <ArrowDownLeft className="h-4 w-4" />,
  swap: <RefreshCw className="h-4 w-4" />,
  vote: <Vote className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
}

const activityColors: Record<ActivityType, string> = {
  send: "bg-orange-100 text-orange-600",
  receive: "bg-green-100 text-green-600",
  swap: "bg-blue-100 text-blue-600",
  vote: "bg-purple-100 text-purple-600",
  comment: "bg-pink-100 text-pink-600",
}

interface ActivityItemProps {
  activity: Activity
}

function ActivityItem({ activity }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
      <div className={cn(
        "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
        activityColors[activity.type]
      )}>
        {activityIcons[activity.type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
      </div>
      
      <div className="text-right shrink-0">
        {activity.amount && (
          <p className={cn(
            "text-sm font-medium",
            activity.type === "receive" ? "text-green-600" : "text-foreground"
          )}>
            {activity.type === "receive" ? "+" : activity.type === "send" ? "-" : ""}
            {activity.amount}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
      </div>
    </div>
  )
}

interface ActivityListProps {
  activities: Activity[]
  title?: string
}

export function ActivityList({ activities, title = "Recent Activity" }: ActivityListProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <button className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          View All
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <History className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">Your transactions will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export type { Activity, ActivityType }
