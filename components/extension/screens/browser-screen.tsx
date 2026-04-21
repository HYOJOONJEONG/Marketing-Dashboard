"use client"

import { useState } from "react"
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Gamepad2,
  Globe,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Vote,
  Zap,
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
  { id: "steemit", name: "Steemit", url: "steemit.com", icon: TrendingUp, iconBg: "bg-gradient-to-br from-teal-400 to-teal-500" },
  { id: "peakd", name: "PeakD", url: "peakd.com", icon: BarChart3, iconBg: "bg-gradient-to-br from-blue-400 to-blue-500" },
  { id: "ecency", name: "Ecency", url: "ecency.com", icon: Sparkles, iconBg: "bg-gradient-to-br from-violet-400 to-purple-500" },
  { id: "steemworld", name: "SteemWorld", url: "steemworld.org", icon: Zap, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { id: "busy", name: "Busy", url: "busy.org", icon: Globe, iconBg: "bg-gradient-to-br from-sky-400 to-cyan-500" },
  { id: "splinterlands", name: "Splinterlands", url: "splinterlands.com", icon: Gamepad2, iconBg: "bg-gradient-to-br from-red-400 to-red-500" },
]

const popularDApps: DApp[] = [
  { id: "hivekeychain", name: "Keychain-style Wallet", url: "wallet.steem", icon: Globe, iconBg: "bg-gradient-to-br from-cyan-400 to-sky-500" },
  { id: "esteem", name: "eSteem", url: "esteem.app", icon: Sparkles, iconBg: "bg-gradient-to-br from-fuchsia-400 to-pink-500" },
  { id: "splinterlands", name: "Splinterlands", url: "splinterlands.com", icon: Gamepad2, iconBg: "bg-gradient-to-br from-red-400 to-red-500" },
]

const projectSubmissionUrl = "https://discord.gg/h4lab"

const recentSites: RecentSite[] = [
  { id: "1", name: "Steemit", url: "steemit.com/@h4lab", favicon: "S", lastVisited: "2h ago" },
  { id: "2", name: "PeakD", url: "peakd.com/trending", favicon: "P", lastVisited: "5h ago" },
  { id: "3", name: "Steem World", url: "steemworld.org", favicon: "W", lastVisited: "1d ago" },
]

const witnessCandidates = [
  { id: "h4lab.witness", name: "h4lab.witness", rank: "#21", votes: "18.2M", status: "Featured" },
  { id: "gtg", name: "gtg", rank: "#7", votes: "32.4M", status: "Recommended" },
  { id: "timcliff", name: "timcliff", rank: "#12", votes: "28.9M", status: "Community" },
]

const governanceProposals = [
  { id: "1", title: "Steem Onboarding Campaign", proposer: "@steem.dao", budget: "420 STEEM/day", expiresIn: "3 days left" },
  { id: "2", title: "Creator Grants Round 2", proposer: "@h4lab", budget: "180 STEEM/day", expiresIn: "6 days left" },
  { id: "3", title: "Witness Tooling Upgrade", proposer: "@dev.support", budget: "95 STEEM/day", expiresIn: "12 days left" },
]

type ViewMode = "home" | "steemit"

export function BrowserScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("home")
  const [governanceView, setGovernanceView] = useState<"witnesses" | "proposals">("witnesses")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.toLowerCase().includes("steemit")) {
      setViewMode("steemit")
    }
  }

  const handleOpenSubmission = () => {
    window.open(projectSubmissionUrl, "_blank", "noopener,noreferrer")
  }

  if (viewMode === "steemit") {
    return <SteemitFeedView onBack={() => setViewMode("home")} />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F7FA]">
      <div className="px-4 pt-4 pb-3 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-foreground">Browser</h1>
            <p className="text-[12px] text-muted-foreground">Web3 Mini Browser</p>
          </div>
        </div>

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

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <div className="mb-4 rounded-2xl bg-white border border-[#E5EEF6] overflow-hidden" style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}>
          <div className="p-4 bg-gradient-to-r from-[#3B82F6]/10 to-[#10B3A3]/10 border-b border-[#E5EEF6]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-white flex items-center justify-center text-[#3B82F6] shadow-sm">
                  <Vote className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-foreground">Governance Portal</p>
                </div>
              </div>
              <span className="shrink-0 px-2 py-1 rounded-full bg-[#10B3A3]/10 text-[#10B3A3] text-[11px] font-semibold">Live</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => setGovernanceView("witnesses")}
                className={cn(
                  "flex items-center justify-center gap-2 p-3.5 rounded-xl border text-center transition-all",
                  governanceView === "witnesses"
                    ? "bg-[#10B3A3] border-[#10B3A3] text-white"
                    : "bg-white border-[#E5EEF6] text-foreground hover:border-[#10B3A3]/30"
                )}
              >
                <User className="w-4 h-4" />
                <span className="text-[13px] font-semibold tracking-[-0.01em]">Witnesses</span>
              </button>
              <button
                onClick={() => setGovernanceView("proposals")}
                className={cn(
                  "flex items-center justify-center gap-2 p-3.5 rounded-xl border text-center transition-all",
                  governanceView === "proposals"
                    ? "bg-[#10B3A3] border-[#10B3A3] text-white"
                    : "bg-white border-[#E5EEF6] text-foreground hover:border-[#10B3A3]/30"
                )}
              >
                <FileText className="w-4 h-4" />
                <span className="text-[13px] font-semibold tracking-[-0.01em]">Proposals</span>
              </button>
            </div>
          </div>

          <div className="p-4">
            {governanceView === "witnesses" ? (
              <div className="space-y-2.5">
                {witnessCandidates.map((witness) => (
                  <div
                    key={witness.id}
                    className={cn(
                      "flex items-center justify-between gap-3 p-3 rounded-xl border",
                      witness.id === "h4lab.witness"
                        ? "bg-gradient-to-r from-[#10B3A3]/12 to-[#0E9E90]/6 border-[#10B3A3]/30"
                        : "bg-[#F8FCFB] border-[#E0EEEB]"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center",
                          witness.id === "h4lab.witness"
                            ? "bg-[#10B3A3] text-white shadow-sm"
                            : "bg-[#10B3A3]/10 text-[#10B3A3]"
                        )}
                      >
                        <Vote className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "truncate text-[14px] font-semibold",
                            witness.id === "h4lab.witness" ? "text-[#0E7F74]" : "text-foreground"
                          )}>
                            @{witness.name}
                          </p>
                          <span className={cn(
                            "shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                            witness.id === "h4lab.witness"
                              ? "bg-white text-[#0E7F74] border-[#10B3A3]/20"
                              : "bg-white text-[#10B3A3] border-[#E0EEEB]"
                          )}>
                            {witness.status}
                          </span>
                        </div>
                        <p className={cn(
                          "text-[12px]",
                          witness.id === "h4lab.witness" ? "text-[#0E7F74]/80" : "text-muted-foreground"
                        )}>
                          {witness.rank} | {witness.votes} votes
                        </p>
                      </div>
                    </div>
                    <button className={cn(
                      "shrink-0 px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors",
                      witness.id === "h4lab.witness"
                        ? "bg-[#0E7F74] text-white hover:bg-[#0B6A61]"
                        : "bg-[#10B3A3] text-white hover:bg-[#0E9E90]"
                    )}>
                      Vote
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {governanceProposals.map((proposal) => (
                  <div key={proposal.id} className="p-3 rounded-xl bg-[#F8FCFB] border border-[#E0EEEB]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[14px] font-semibold leading-5 text-foreground">{proposal.title}</p>
                        <p className="mt-1 text-[12px] text-muted-foreground">{proposal.proposer} | {proposal.budget}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-[#10B3A3]">{proposal.expiresIn}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button className="flex-1 py-2 rounded-xl bg-[#10B3A3] text-white text-[12px] font-semibold hover:bg-[#0E9E90] transition-colors">
                        Support
                      </button>
                      <button className="flex-1 py-2 rounded-xl bg-white text-foreground text-[12px] font-semibold border border-[#E0EEEB] hover:border-[#10B3A3]/30 transition-colors">
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-2">STEEM APPS</h2>
          <div className="grid grid-cols-2 gap-2">
            {featuredDApps.map((app) => (
              <button
                key={app.id}
                className="rounded-2xl bg-white p-3 text-left transition-transform hover:scale-[1.02]"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white", app.iconBg)}>
                    <app.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">{app.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{app.url}</p>
                    <p className="mt-2 text-[11px] text-[#7C8F8C] leading-4">
                      Open in wallet browser
                    </p>
                  </div>
                </div>
              </button>
            ))}

            <button
              onClick={handleOpenSubmission}
              className="col-span-2 rounded-2xl border border-dashed border-[#10B3A3]/35 bg-white p-4 text-left transition-colors hover:bg-[#F8FCFB]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground">Add your project to H4LAB Wallet</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Want your dApp listed here? Join our Discord room and request an integration.
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#10B3A3]/10 text-[#10B3A3]">
                  <ExternalLink className="w-4 h-4" />
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">More DApps</h2>
            <button className="text-[11px] text-primary font-medium">See All</button>
          </div>
          <div className="rounded-2xl bg-white overflow-hidden">
            {popularDApps.map((app, idx) => (
              <button key={app.id} className={cn("w-full flex items-center justify-between p-3 hover:bg-[#FAFAFA] transition-colors", idx < popularDApps.length - 1 && "border-b border-[#F5F7FA]")}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white", app.iconBg)}>
                  <app.icon className="w-5 h-5" />
                </div>
                  <div className="text-left">
                    <p className="text-[14px] font-medium text-foreground">{app.name}</p>
                    <p className="text-[12px] text-muted-foreground truncate max-w-[180px]">{app.url}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">Recent</h2>
            <button className="text-[11px] text-primary font-medium">Clear</button>
          </div>
          <div className="space-y-2">
            {recentSites.map((site) => (
              <button key={site.id} className="w-full flex items-center justify-between p-3 rounded-xl bg-white hover:bg-[#FAFAFA] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F5F7FA] flex items-center justify-center text-xs font-bold text-muted-foreground">{site.favicon}</div>
                  <div className="text-left">
                    <p className="text-[14px] font-medium text-foreground">{site.name}</p>
                    <p className="text-[12px] text-muted-foreground truncate max-w-[180px]">{site.url}</p>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
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

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-[15px] font-bold text-foreground mb-3">Trending Posts</h2>
        <div className="space-y-3">
          {mockPosts.map((post) => (
            <div key={post.id} className="p-3.5 rounded-2xl bg-white cursor-pointer hover:bg-[#FAFAFA] transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {post.author.charAt(0).toUpperCase()}
                </div>
                <span className="text-[12px] font-medium text-muted-foreground">@{post.author}</span>
              </div>
              <h3 className="mb-1 line-clamp-2 text-[14px] font-semibold leading-5 text-foreground">{post.title}</h3>
              <p className="mb-3 line-clamp-2 text-[12px] leading-5 text-muted-foreground">{post.preview}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{post.votes} votes</span>
                  <span>{post.comments} comments</span>
                </div>
                <span className="text-[12px] font-semibold text-[#22C55E]">{post.payout}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
