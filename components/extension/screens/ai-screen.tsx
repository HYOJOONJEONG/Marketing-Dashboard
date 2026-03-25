"use client"

import { useState } from "react"
import { 
  Sparkles, Send as SendIcon, 
  Wallet, Vote, PenTool, Search,
  Bot, User, MoreHorizontal
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const suggestedActions = [
  { id: "send", label: "Send tokens", icon: Wallet, description: "Transfer STEEM or SBD" },
  { id: "balance", label: "Check balance", icon: Search, description: "View wallet status" },
  { id: "vote", label: "Vote post", icon: Vote, description: "Upvote content" },
  { id: "sign", label: "Sign transaction", icon: PenTool, description: "Authorize operations" },
]

const initialMessages: Message[] = [
  { id: "1", role: "assistant", content: "Hello! I'm Hari AI, your Steem assistant. I can help you send tokens, check balances, vote on posts, and more. What would you like to do?" },
]

export function AIScreen() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const handleSend = () => {
    if (!input.trim()) return

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I understand you want to " + input.toLowerCase() + ". Let me help you with that. Please confirm the details and I'll prepare the transaction for you.",
      }
      setMessages(prev => [...prev, aiResponse])
      setIsTyping(false)
    }, 1500)
  }

  const handleQuickAction = (action: typeof suggestedActions[0]) => {
    setInput(`I want to ${action.label.toLowerCase()}`)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F7FA]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Hari AI</h1>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
          </div>
          <button className="w-9 h-9 rounded-xl bg-[#F5F7FA] flex items-center justify-center text-muted-foreground">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
              {message.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm",
                  message.role === "user"
                    ? "bg-primary text-white rounded-tr-sm"
                    : "bg-white text-foreground rounded-tl-sm"
                )}
              >
                <p className="leading-relaxed">{message.content}</p>
              </div>
              {message.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-[#F5F7FA] flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-white">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Actions */}
        {messages.length <= 2 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Suggested Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {suggestedActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white text-left hover:bg-[#FAFAFA] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <action.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{action.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{action.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="px-4 pb-4 pt-2 bg-white">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-[#F5F7FA]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Hari AI..."
            className="flex-1 px-2 py-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
              input.trim() ? "bg-primary text-white" : "bg-white text-muted-foreground"
            )}
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
