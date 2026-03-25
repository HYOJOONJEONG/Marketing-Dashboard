"use client"

import { useState } from "react"
import { 
  Heart, MessageCircle, Repeat2, Send, MoreHorizontal, 
  Bookmark, Play, Image as ImageIcon, Plus,
  TrendingUp, Users, Compass
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Post {
  id: string
  author: { username: string; avatar: string; isVerified?: boolean }
  timestamp: string
  title: string
  content: string
  media?: { type: "image" | "video" | "gallery"; aspectRatio?: string; count?: number }
  stats: { votes: number; comments: number; payout: string }
  isLiked?: boolean
  isSaved?: boolean
}

const mockPosts: Post[] = [
  {
    id: "1",
    author: { username: "steemit", avatar: "S", isVerified: true },
    timestamp: "2h",
    title: "Steem Ecosystem Update",
    content: "Exciting updates coming to the Steem ecosystem! We're introducing new features.",
    media: { type: "image", aspectRatio: "16/9" },
    stats: { votes: 1234, comments: 89, payout: "125.50" },
    isLiked: true,
  },
  {
    id: "2",
    author: { username: "photography", avatar: "P" },
    timestamp: "4h",
    title: "Weekly Photo Contest Winners",
    content: "Congratulations to this week's winners! Check out these stunning captures.",
    media: { type: "gallery", aspectRatio: "1/1", count: 5 },
    stats: { votes: 892, comments: 156, payout: "89.25" },
  },
  {
    id: "3",
    author: { username: "cryptoart", avatar: "C" },
    timestamp: "6h",
    title: "NFT Collection Drop",
    content: "Exclusive NFT collection dropping tomorrow! Limited to 100 pieces.",
    media: { type: "video", aspectRatio: "9/16" },
    stats: { votes: 567, comments: 234, payout: "67.80" },
  },
]

const feedTabs = [
  { id: "following", label: "Following", icon: Users },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "communities", label: "Communities", icon: Compass },
]

function formatNumber(num: number): string {
  return num >= 1000 ? (num / 1000).toFixed(1) + "K" : num.toString()
}

function getAvatarGradient(char: string): string {
  const gradients: Record<string, string> = {
    S: "from-teal-400 to-emerald-500",
    P: "from-pink-400 to-rose-500",
    C: "from-violet-400 to-purple-500",
  }
  return gradients[char] || "from-gray-400 to-gray-500"
}

interface FeedScreenProps {
  onCreatePost?: () => void
}

export function FeedScreen({ onCreatePost }: FeedScreenProps) {
  const [activeTab, setActiveTab] = useState("following")
  const [posts, setPosts] = useState(mockPosts)

  const toggleLike = (postId: string) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, isLiked: !post.isLiked, stats: { ...post.stats, votes: post.isLiked ? post.stats.votes - 1 : post.stats.votes + 1 } }
        : post
    ))
  }

  const toggleSave = (postId: string) => {
    setPosts(posts.map(post => post.id === postId ? { ...post, isSaved: !post.isSaved } : post))
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F5F7FA] relative overflow-visible">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-foreground">Feed</h1>
          <button className="w-8 h-8 rounded-full bg-[#F5F7FA] flex items-center justify-center">
            <Compass className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        {/* Feed Tabs */}
        <div className="flex items-center gap-1">
          {feedTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-[#1A1A2E] text-white"
                    : "bg-transparent text-muted-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Posts Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          {posts.map((post) => (
            <article key={post.id} className="bg-white mb-2">
              {/* Post Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-primary via-teal-400 to-emerald-400">
                      <div className={cn(
                        "w-full h-full rounded-full flex items-center justify-center text-white text-sm font-semibold bg-gradient-to-br",
                        getAvatarGradient(post.author.avatar)
                      )}>
                        {post.author.avatar}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-foreground">{post.author.username}</span>
                      {post.author.isVerified && (
                        <svg className="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{post.timestamp}</span>
                  </div>
                </div>
                <button className="p-1 text-muted-foreground">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Media Content */}
              <div 
                className="relative w-full bg-[#F5F7FA]"
                style={{ aspectRatio: post.media?.aspectRatio || "1/1", maxHeight: "280px" }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted to-muted/80 flex items-center justify-center">
                  {post.media?.type === "video" ? (
                    <div className="w-14 h-14 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-7 h-7 text-white fill-white" />
                    </div>
                  ) : post.media?.type === "gallery" ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-sm font-medium">1/{post.media.count}</span>
                    </div>
                  ) : (
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                  )}
                </div>
                {post.media?.type === "gallery" && (
                  <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm">
                    <span className="text-xs text-white font-medium">1/{post.media.count}</span>
                  </div>
                )}
              </div>

              {/* Actions Bar */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <button onClick={() => toggleLike(post.id)} className={cn("transition-all active:scale-90", post.isLiked ? "text-red-500" : "text-foreground")}>
                      <Heart className={cn("w-6 h-6", post.isLiked && "fill-current")} />
                    </button>
                    <button className="text-foreground"><MessageCircle className="w-6 h-6" /></button>
                    <button className="text-foreground"><Repeat2 className="w-6 h-6" /></button>
                    <button className="text-foreground"><Send className="w-6 h-6" /></button>
                  </div>
                  <button onClick={() => toggleSave(post.id)} className={cn("transition-all active:scale-90", post.isSaved ? "text-foreground" : "text-foreground")}>
                    <Bookmark className={cn("w-6 h-6", post.isSaved && "fill-current")} />
                  </button>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-semibold text-foreground">{formatNumber(post.stats.votes)} votes</span>
                  <span className="text-sm text-muted-foreground">{formatNumber(post.stats.comments)} comments</span>
                  <span className="text-sm text-[#22C55E] font-medium">${post.stats.payout} SBD</span>
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-semibold text-foreground mr-1.5">{post.author.username}</span>
                    <span className="font-medium text-foreground">{post.title}</span>
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                  <button className="text-sm text-muted-foreground">View all {post.stats.comments} comments</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Floating Action Button - Create Post */}
      <div className="absolute bottom-4 right-4 z-50">
        <button
          onClick={onCreatePost}
          className="w-14 h-14 rounded-full bg-[#10B3A3] text-white flex items-center justify-center hover:bg-[#0E9E90] transition-all active:scale-95"
          style={{ boxShadow: "0 6px 24px rgba(16, 179, 163, 0.5)" }}
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </button>
      </div>
    </div>
  )
}
