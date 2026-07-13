import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/react"
import { MobileTableEnhancer } from "@/components/mobile-table-enhancer"
import "./globals.css"

export const metadata: Metadata = {
  title: "인포Biz본부 통합 대시보드",
  description: "실적 관리, 계약서통합관리, 해지 진행사항을 한 화면에서 관리하는 내부 대시보드",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        {children}
        <MobileTableEnhancer />
        <Analytics />
      </body>
    </html>
  )
}
