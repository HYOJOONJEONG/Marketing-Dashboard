"use client"

import { useState } from "react"
import { ExtensionWrapper } from "@/components/extension/extension-wrapper"
import { BottomTabs, type TabId } from "@/components/extension/bottom-tabs"
import { LoginScreen } from "@/components/extension/screens/login-screen"
import { HomeScreen } from "@/components/extension/screens/home-screen"
import { FeedScreen } from "@/components/extension/screens/feed-screen"
import { RaidScreen } from "@/components/extension/screens/raid-screen"
import { AIScreen } from "@/components/extension/screens/ai-screen"
import { BrowserScreen } from "@/components/extension/screens/browser-screen"
import { SettingsScreen } from "@/components/extension/screens/settings-screen"
import { PostComposer } from "@/components/extension/screens/post-composer"
import { TransactionScreen } from "@/components/extension/screens/transaction-screen"
import { cn } from "@/lib/utils"

type ViewMode = "locked" | "unlocked" | "transaction" | "settings" | "composer"

const screens = [
  { id: "login", label: "Login" },
  { id: "wallet", label: "Wallet" },
  { id: "post", label: "Post" },
  { id: "transaction", label: "Transaction" },
] as const

type ScreenId = typeof screens[number]["id"]

export default function Home() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("wallet")
  const [viewMode, setViewMode] = useState<ViewMode>("unlocked")
  const [activeTab, setActiveTab] = useState<TabId>("home")

  const handleUnlock = () => {
    setViewMode("unlocked")
    setActiveTab("home")
  }

  const handleLock = () => {
    setViewMode("locked")
  }

  const handleTransactionComplete = () => {
    setViewMode("unlocked")
    setActiveTab("home")
  }

  const handleOpenSettings = () => {
    setViewMode("settings")
  }

  const handleCloseSettings = () => {
    setViewMode("unlocked")
  }

  const handleOpenComposer = () => {
    setViewMode("composer")
  }

  const handleOpenGovernance = () => {
    setViewMode("unlocked")
    setActiveTab("browser")
  }

  const handleCloseComposer = () => {
    setViewMode("unlocked")
  }

  const handleScreenChange = (screen: ScreenId) => {
    setActiveScreen(screen)
    if (screen === "login") {
      setViewMode("locked")
    } else if (screen === "transaction") {
      setViewMode("transaction")
    } else if (screen === "post") {
      setViewMode("composer")
    } else {
      setViewMode("unlocked")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4 py-6 md:px-6 md:py-8 flex flex-col items-center justify-start">
      {/* Screen Selector */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-white shadow-sm">
          {screens.map((screen) => (
            <button
              key={screen.id}
              onClick={() => handleScreenChange(screen.id)}
              className={cn(
                "px-5 py-2.5 text-sm font-medium rounded-xl transition-all",
                activeScreen === screen.id
                  ? "bg-[#1A1A2E] text-white shadow-md"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              {screen.label}
            </button>
          ))}
        </div>
      </div>

      {/* Extension Preview */}
      <ExtensionWrapper>
        {viewMode === "locked" && (
          <LoginScreen onUnlock={handleUnlock} />
        )}

        {viewMode === "transaction" && (
          <TransactionScreen
            onConfirm={handleTransactionComplete}
            onReject={() => setViewMode("unlocked")}
          />
        )}

        {viewMode === "settings" && (
          <SettingsScreen 
            onBack={handleCloseSettings} 
            onLock={handleLock}
          />
        )}

        {viewMode === "composer" && (
          <PostComposer 
            username="h4lab.user"
            onClose={handleCloseComposer}
          />
        )}

        {viewMode === "unlocked" && (
          <>
            {/* Screen Content */}
            <div className="flex-1 overflow-hidden relative">
              {activeTab === "home" && (
                <HomeScreen
                  username="h4lab.user"
                  totalBalance="26,849.05"
                  onOpenSettings={handleOpenSettings}
                  onOpenGovernance={handleOpenGovernance}
                />
              )}
              {activeTab === "feed" && (
                <div className="h-full relative">
                  <FeedScreen onCreatePost={handleOpenComposer} />
                  {/* FAB for Feed */}
                  <button
                    onClick={handleOpenComposer}
                    className="absolute bottom-4 right-4 w-14 h-14 rounded-full bg-[#10B3A3] text-white flex items-center justify-center hover:bg-[#0E9E90] transition-all active:scale-95 z-50"
                    style={{ boxShadow: "0 6px 24px rgba(16, 179, 163, 0.5)" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" /><path d="M12 5v14" />
                    </svg>
                  </button>
                </div>
              )}
              {activeTab === "raid" && <RaidScreen />}
              {activeTab === "ai" && <AIScreen />}
              {activeTab === "browser" && <BrowserScreen />}
            </div>

            {/* Bottom Tabs */}
            <BottomTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </>
        )}
      </ExtensionWrapper>

      {/* Footer */}
      <p className="text-center text-sm text-gray-400 mt-6">
        H4LAB - Steem Wallet
      </p>
    </div>
  )
}
