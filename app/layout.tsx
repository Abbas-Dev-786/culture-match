import { Geist_Mono, DM_Sans, Outfit } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";
import { SessionRefresh } from "@/app/auth/session-refresh"

const outfitHeading = Outfit({ subsets: ['latin'], variable: '--font-heading' });

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", dmSans.variable, outfitHeading.variable)}
    >
      <body>
        <ThemeProvider>
          <SessionRefresh />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
