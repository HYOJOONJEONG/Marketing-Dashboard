"use client"

import { useState, useRef, useEffect } from "react"
import { 
  X, Image as ImageIcon, Hash, Users, 
  Send, ChevronDown, Sparkles, PenLine, FileImage,
  Clock, Calendar, Check, Settings, ChevronRight, Eye
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PostComposerProps {
  username: string
  onClose: () => void
  onPublish?: (post: { title: string; body: string; tags: string[]; scheduledAt?: Date }) => void
}

export function PostComposer({ username, onClose, onPublish }: PostComposerProps) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [tags, setTags] = useState("")
  const [community, setCommunity] = useState("")
  const [isPublishing, setIsPublishing] = useState(false)
  const [showAIMenu, setShowAIMenu] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  
  // Scheduling states
  const [isScheduled, setIsScheduled] = useState(false)
  const [showSchedulePanel, setShowSchedulePanel] = useState(false)
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  
  // Post-publish config panel
  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [publishedPost, setPublishedPost] = useState<{ title: string; scheduledAt?: Date } | null>(null)
  
  const aiMenuRef = useRef<HTMLDivElement>(null)

  const canPublish = title.trim().length > 0 && body.trim().length > 0
  const hasSchedule = isScheduled && scheduledDate && scheduledTime

  // Close AI menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
        setShowAIMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const getScheduledDateTime = () => {
    if (!scheduledDate || !scheduledTime) return null
    return new Date(`${scheduledDate}T${scheduledTime}`)
  }

  const handlePublish = () => {
    if (!canPublish) return
    setIsPublishing(true)
    
    const scheduledAt = hasSchedule ? getScheduledDateTime() : undefined
    
    setTimeout(() => {
      const postData = { 
        title, 
        body, 
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        scheduledAt: scheduledAt || undefined
      }
      
      onPublish?.(postData)
      setIsPublishing(false)
      
      setPublishedPost({ title, scheduledAt: scheduledAt || undefined })
      setShowConfigPanel(true)
    }, 1000)
  }

  const handleAIRefine = () => {
    setShowAIMenu(false)
    if (!body.trim()) return
    setIsRefining(true)
    setTimeout(() => {
      setBody(prev => prev + "\n\n[AI refined content would appear here]")
      setIsRefining(false)
    }, 1500)
  }

  const handleImageToText = () => {
    setShowAIMenu(false)
    setBody(prev => prev + "\n\n[AI-generated text from image would appear here]")
  }

  const formatScheduledTime = () => {
    const dt = getScheduledDateTime()
    if (!dt) return ""
    return dt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    })
  }

  const getMinDate = () => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  }

  // Post-publish configuration panel
  if (showConfigPanel && publishedPost) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#F8FAFA] to-white">
        {/* Header */}
        <div 
          className="px-5 pt-5 pb-4 flex items-center justify-between"
          style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFA 100%)" }}
        >
          <div className="w-10" />
          <h1 className="text-lg font-bold text-[#1F2A2A]">Post Settings</h1>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-[#F3FAF8] flex items-center justify-center text-[#7C8F8C] hover:text-[#1F2A2A] hover:bg-[#E8F7F4] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Card */}
        <div className="mx-4 mt-2 p-6 rounded-3xl bg-white" style={{ boxShadow: "0 4px 24px rgba(16, 179, 163, 0.08)" }}>
          <div className="flex flex-col items-center text-center">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
              style={{ 
                background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
                boxShadow: "0 8px 24px rgba(16, 179, 163, 0.3)"
              }}
            >
              <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-bold text-[#1F2A2A] mb-2">
              {publishedPost.scheduledAt ? "Post Scheduled!" : "Post Published!"}
            </h2>
            <p className="text-sm text-[#7C8F8C] leading-relaxed">
              {publishedPost.scheduledAt 
                ? `Your post will be published on ${publishedPost.scheduledAt.toLocaleString()}`
                : "Your post is now live on Steemit"
              }
            </p>
          </div>
        </div>

        {/* Post Info Card */}
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <p className="text-[10px] font-semibold text-[#10B3A3] uppercase tracking-wider mb-2">Post Title</p>
          <p className="text-base font-semibold text-[#1F2A2A]">{publishedPost.title}</p>
        </div>

        {/* Configuration Options */}
        <div className="mx-4 mt-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <p className="px-4 pt-4 pb-2 text-[10px] font-semibold text-[#10B3A3] uppercase tracking-wider">Additional Settings</p>
          
          {publishedPost.scheduledAt && (
            <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#F8FAFA] transition-colors border-b border-[#F3FAF8]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-sm font-medium text-[#1F2A2A]">Edit Schedule</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#7C8F8C]" />
            </button>
          )}
          
          <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#F8FAFA] transition-colors border-b border-[#F3FAF8]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F3FAF8] to-[#E8F7F4] flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#10B3A3]" />
              </div>
              <span className="text-sm font-medium text-[#1F2A2A]">Post Options</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#7C8F8C]" />
          </button>
          
          <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#F8FAFA] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-500" />
              </div>
              <span className="text-sm font-medium text-[#1F2A2A]">Beneficiaries</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#7C8F8C]" />
          </button>
        </div>

        {/* Done Button */}
        <div className="mt-auto px-4 py-4">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl text-white text-base font-semibold transition-all active:scale-[0.98]"
            style={{ 
              background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
              boxShadow: "0 4px 16px rgba(16, 179, 163, 0.3)"
            }}
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#F8FAFA] to-white">
      {/* Header */}
      <div 
        className="px-4 pt-4 pb-3 flex items-center justify-between"
        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFA 100%)" }}
      >
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-2xl bg-[#F3FAF8] flex items-center justify-center text-[#7C8F8C] hover:text-[#1F2A2A] hover:bg-[#E8F7F4] transition-all"
        >
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-[#1F2A2A]">Create Post</h1>
        <button
          onClick={handlePublish}
          disabled={!canPublish || isPublishing}
          className={cn(
            "px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all",
            canPublish && !isPublishing
              ? "text-white"
              : "bg-[#F3FAF8] text-[#7C8F8C]"
          )}
          style={canPublish && !isPublishing ? { 
            background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
            boxShadow: "0 4px 12px rgba(16, 179, 163, 0.3)"
          } : {}}
        >
          {isPublishing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </span>
          ) : hasSchedule ? "Schedule" : "Publish"}
        </button>
      </div>

      {/* Author Card */}
      <div className="mx-4 mt-3 p-4 rounded-2xl bg-white flex items-center gap-3" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base"
          style={{ 
            background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
            boxShadow: "0 4px 12px rgba(16, 179, 163, 0.25)"
          }}
        >
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-[#1F2A2A]">@{username}</p>
          <p className="text-xs text-[#7C8F8C]">
            {hasSchedule ? (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatScheduledTime()}
              </span>
            ) : "Posting to Steemit"}
          </p>
        </div>
        <button className="w-9 h-9 rounded-xl bg-[#F3FAF8] flex items-center justify-center text-[#7C8F8C] hover:bg-[#E8F7F4] transition-colors">
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title Input */}
        <div className="p-4 rounded-2xl bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <label className="text-[10px] font-semibold text-[#10B3A3] uppercase tracking-wider mb-2 block">Title</label>
          <input
            type="text"
            placeholder="Enter your post title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-lg font-semibold text-[#1F2A2A] placeholder:text-[#7C8F8C]/50 focus:outline-none bg-transparent"
          />
        </div>

        {/* Body Input */}
        <div className="p-4 rounded-2xl bg-white relative" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <label className="text-[10px] font-semibold text-[#10B3A3] uppercase tracking-wider mb-2 block">Content</label>
          <textarea
            placeholder="Write your post content here...

Markdown supported:
• **bold** for emphasis
• *italic* for style
• # Heading for titles
• [link](url) for links"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full min-h-[140px] text-sm text-[#1F2A2A] placeholder:text-[#7C8F8C]/50 focus:outline-none bg-transparent resize-none leading-relaxed"
          />
          {isRefining && (
            <div className="absolute inset-0 bg-white/90 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[#F3FAF8]">
                <Sparkles className="w-5 h-5 text-[#10B3A3] animate-pulse" />
                <span className="text-sm font-medium text-[#10B3A3]">AI refining...</span>
              </div>
            </div>
          )}
        </div>

        {/* Tools Section */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[#10B3A3] uppercase tracking-wider px-1">Tools</p>
          
          {/* AI Assistant */}
          <div className="relative" ref={aiMenuRef}>
            <button 
              onClick={() => setShowAIMenu(!showAIMenu)}
              className={cn(
                "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all",
                showAIMenu 
                  ? "bg-white ring-2 ring-[#10B3A3]/20" 
                  : "bg-white hover:bg-[#F8FAFA]"
              )}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ 
                    background: showAIMenu 
                      ? "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)" 
                      : "linear-gradient(135deg, #F3FAF8 0%, #E8F7F4 100%)"
                  }}
                >
                  <Sparkles className={cn("w-5 h-5", showAIMenu ? "text-white" : "text-[#10B3A3]")} />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-[#1F2A2A]">Hari AI Assistant</span>
                  <p className="text-xs text-[#7C8F8C]">Enhance your content</p>
                </div>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-[#7C8F8C] transition-transform",
                showAIMenu && "rotate-180"
              )} />
            </button>

            {/* AI Dropdown */}
            {showAIMenu && (
              <div 
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl overflow-hidden z-50"
                style={{ boxShadow: "0 12px 40px rgba(16, 179, 163, 0.15)" }}
              >
                <button
                  onClick={handleAIRefine}
                  className="w-full flex items-center gap-3 p-4 hover:bg-[#F8FAFA] transition-colors border-b border-[#F3FAF8]"
                >
                  <div 
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)" }}
                  >
                    <PenLine className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-[#1F2A2A]">AI Text Refinement</p>
                    <p className="text-xs text-[#7C8F8C]">Polish and improve your writing</p>
                  </div>
                </button>
                <button
                  onClick={handleImageToText}
                  className="w-full flex items-center gap-3 p-4 hover:bg-[#F8FAFA] transition-colors"
                >
                  <div 
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" }}
                  >
                    <FileImage className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-[#1F2A2A]">Image-based Auto Writing</p>
                    <p className="text-xs text-[#7C8F8C]">Generate text from images</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Add Image */}
          <button 
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white hover:bg-[#F8FAFA] transition-colors"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-rose-400" />
            </div>
            <span className="text-sm font-medium text-[#1F2A2A]">Add Image</span>
          </button>

          {/* Tags */}
          <div 
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-50 to-sky-50 flex items-center justify-center">
              <Hash className="w-5 h-5 text-sky-400" />
            </div>
            <input
              type="text"
              placeholder="Add tags (comma separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="flex-1 text-sm text-[#1F2A2A] placeholder:text-[#7C8F8C]/50 focus:outline-none bg-transparent"
            />
          </div>

          {/* Community */}
          <button 
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-[#F8FAFA] transition-colors"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-400" />
              </div>
              <span className="text-sm font-medium text-[#1F2A2A]">
                {community || "Select Community"}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-[#7C8F8C]" />
          </button>

          {/* Schedule Post */}
          <div>
            <button 
              onClick={() => setShowSchedulePanel(!showSchedulePanel)}
              className={cn(
                "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all",
                isScheduled 
                  ? "bg-white ring-2 ring-blue-500/20" 
                  : "bg-white hover:bg-[#F8FAFA]"
              )}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ 
                    background: isScheduled 
                      ? "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)" 
                      : "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)"
                  }}
                >
                  <Clock className={cn("w-5 h-5", isScheduled ? "text-white" : "text-blue-500")} />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-[#1F2A2A]">Schedule Post</span>
                  <p className="text-xs text-[#7C8F8C]">
                    {hasSchedule ? formatScheduledTime() : "Publish later"}
                  </p>
                </div>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-[#7C8F8C] transition-transform",
                showSchedulePanel && "rotate-180"
              )} />
            </button>

            {/* Schedule Panel */}
            {showSchedulePanel && (
              <div 
                className="mt-2 p-4 bg-white rounded-2xl space-y-4"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                {/* Enable Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#1F2A2A]">Enable Scheduling</span>
                  <button
                    onClick={() => setIsScheduled(!isScheduled)}
                    className={cn(
                      "w-14 h-8 rounded-full transition-all relative",
                      isScheduled 
                        ? "bg-[#10B3A3]" 
                        : "bg-gray-200"
                    )}
                    style={isScheduled ? { boxShadow: "0 2px 8px rgba(16, 179, 163, 0.3)" } : {}}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full bg-white absolute top-1 transition-transform shadow-sm",
                      isScheduled ? "translate-x-7" : "translate-x-1"
                    )} />
                  </button>
                </div>

                {isScheduled && (
                  <div className="space-y-3 pt-2">
                    {/* Date Picker */}
                    <div>
                      <label className="text-[10px] font-semibold text-[#10B3A3] uppercase tracking-wider mb-2 block">Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C8F8C]" />
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          min={getMinDate()}
                          className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#F8FAFA] text-sm text-[#1F2A2A] focus:outline-none focus:ring-2 focus:ring-[#10B3A3]/20 transition-all"
                        />
                      </div>
                    </div>

                    {/* Time Picker */}
                    <div>
                      <label className="text-[10px] font-semibold text-[#10B3A3] uppercase tracking-wider mb-2 block">Time</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C8F8C]" />
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#F8FAFA] text-sm text-[#1F2A2A] focus:outline-none focus:ring-2 focus:ring-[#10B3A3]/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div 
        className="px-4 py-4 flex gap-3"
        style={{ background: "linear-gradient(180deg, #F8FAFA 0%, #FFFFFF 100%)" }}
      >
        <button
          onClick={onClose}
          className="flex-1 py-3.5 rounded-2xl bg-white text-[#1F2A2A] text-sm font-semibold border border-[#E0EEEB] hover:bg-[#F8FAFA] transition-colors"
        >
          Save Draft
        </button>
        <button
          onClick={handlePublish}
          disabled={!canPublish || isPublishing}
          className={cn(
            "flex-1 py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
            canPublish && !isPublishing
              ? "text-white"
              : "bg-[#F3FAF8] text-[#7C8F8C]"
          )}
          style={canPublish && !isPublishing ? { 
            background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
            boxShadow: "0 4px 16px rgba(16, 179, 163, 0.3)"
          } : {}}
        >
          {isPublishing ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              {hasSchedule ? "Schedule" : "Publish"}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
