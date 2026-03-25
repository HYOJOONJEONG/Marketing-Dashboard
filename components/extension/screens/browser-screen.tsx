"use client"

import { useState } from "react"
import { 
  Search, Globe, ChevronRight, Zap, Sparkles, 
  TrendingUp, Gamepad2, BarChart3, ExternalLink, 
  Bookmark, ArrowLeft, Clock
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DApp {
  id: string
  name: string
  url: string
  icon: React.ElementType
  iconBg: string
}

interface RecentSite {
  id: string
  name: string
  url: string
  favicon: string
  lastVisited: string
}

const featuredDApps: DApp[] = [
  { id: "hari-raid", name: "Hari Raid", url: "hariraid.steem", icon: Zap, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { id: "hari-ai", name: "Hari AI", url: "hariai.steem", icon: Sparkles, iconBg: "bg-gradient-to-br from-violet-400 to-purple-500" },
]

const popularDApps: DApp[] = [
  { id: "steemit", name: "Steemit", url: "steemit.com", icon: TrendingUp, iconBg: "bg-gradient-to-br from-teal-400 to-teal-500" },
  { id: "peakd", name: "PeakD", url: "peakd.com", icon: BarChart3, iconBg: "bg-gradient-to-br from-blue-400 to-blue-500" },
  { id: "splinterlands", name: "Splinterlands", url: "splinterlands.com", icon: Gamepad2, iconBg: "bg-gradient-to-br from-red-400 to-red-500" },
]

const recentSites: RecentSite[] = [
  { id: "1", name: "Steemit", url: "steemit.com/@h4lab", favicon: "S", lastVisited: "2h ago" },
  { id: "2", name: "PeakD", url: "peakd.com/trending", favicon: "P", lastVisited: "5h ago" },
  { id: "3", name: "Steem World", url: "steemworld.org", favicon: "W", lastVisited: "1d ago" },
]

type ViewMode = "home" | "steemit"

export function BrowserScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("home")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.toLowerCase().includes("steemit")) {
      setViewMode("steemit")
    }
  }

  if (viewMode === "steemit") {
    return <SteemitFeedView onBack={() => setViewMode("home")} />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F7FA]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Browser</h1>
            <p className="text-xs text-muted-foreground">Web3 Mini Browser</p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch}>
          <div className="relative rounded-2xl bg-[#F5F7FA] overflow-hidden">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or enter URL..."
              className="w-full pl-10 pr-4 py-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </form>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
        {/* Hari Apps */}
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Hari Apps</h2>
          <div className="grid grid-cols-2 gap-2">
            {featuredDApps.map((app) => (
              <button key={app.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white text-left hover:scale-[1.02] transition-transform">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", app.iconBg)}>
                  <app.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{app.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{app.url}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Steemit Shortcut */}
        <div className="mb-4">
          <button 
            onClick={() => setViewMode("steemit")}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-between hover:from-primary/15 hover:to-primary/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white font-bold">S</div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">Open Steemit</p>
                <p className="text-xs text-muted-foreground">Browse trending posts</p>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-primary" />
          </button>
        </div>

        {/* Popular DApps */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Popular DApps</h2>
            <button className="text-xs text-primary font-medium">See All</button>
          </div>
          <div className="rounded-2xl bg-white overflow-hidden">
            {popularDApps.map((app, idx) => (
              <button key={app.id} className={cn("w-full flex items-center justify-between p-3 hover:bg-[#FAFAFA] transition-colors", idx < popularDApps.length - 1 && "border-b border-[#F5F7FA]")}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white", app.iconBg)}>
                    <app.icon className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{app.name}</p>
                    <p className="text-xs text-muted-foreground">{app.url}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Sites */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent</h2>
            <button className="text-xs text-primary font-medium">Clear</button>
          </div>
          <div className="space-y-2">
            {recentSites.map((site) => (
              <button key={site.id} className="w-full flex items-center justify-between p-3 rounded-xl bg-white hover:bg-[#FAFAFA] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F5F7FA] flex items-center justify-center text-xs font-bold text-muted-foreground">{site.favicon}</div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{site.name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{site.url}</p>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {site.lastVisited}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Steemit Feed View
interface Post {
  id: string
  author: string
  title: string
  preview: string
  votes: number
  comments: number
  payout: string
}

const mockPosts: Post[] = [
  { id: "1", author: "steemit", title: "Weekly Development Update", preview: "We're excited to share the latest updates from our development team...", votes: 234, comments: 45, payout: "$125.50" },
  { id: "2", author: "cryptonews", title: "Market Analysis: STEEM", preview: "The cryptocurrency market has been showing interesting patterns...", votes: 189, comments: 32, payout: "$89.25" },
  { id: "3", author: "steemdev", title: "Building Your First DApp", preview: "In this tutorial, we'll walk through the process...", votes: 156, comments: 67, payout: "$67.80" },
]

function SteemitFeedView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F7FA]">
      {/* Browser Header */}
      <div className="px-3 pt-3 pb-2 bg-white">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="w-8 h-8 rounded-lg bg-[#F5F7FA] flex items-center justify-center text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F5F7FA] text-xs text-muted-foreground">
            <Globe className="w-3.5 h-3.5" />
            <span className="truncate">steemit.com/trending</span>
          </div>
          <button className="w-8 h-8 rounded-lg bg-[#F5F7FA] flex items-center justify-center text-muted-foreground">
            <Bookmark className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Steemit Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Trending Posts</h2>
        <div className="space-y-3">
          {mockPosts.map((post) => (
            <div key={post.id} className="p-3.5 rounded-2xl bg-white cursor-pointer hover:bg-[#FAFAFA] transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {post.author.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-muted-foreground">@{post.author}</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1 line-clamp-2">{post.title}</h3>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{post.preview}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{post.votes} votes</span>
                  <span>{post.comments} comments</span>
                </div>
                <span className="text-xs font-semibold text-[#22C55E]">{post.payout}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
