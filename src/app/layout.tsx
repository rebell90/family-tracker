import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import AppHeader from '@/components/AppHeader'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Family Tracker',
  description: 'A family task and reward management app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <AppHeader />
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}