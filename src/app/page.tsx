// src/app/page.tsx
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import ParentDashboard from '@/components/ParentDashboard'
import Dashboard from '@/components/Dashboard' // Your existing child dashboard

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  // 🆕 NEW: Show ParentDashboard for parents, regular Dashboard for children
  if (session?.user?.role === 'PARENT') {
    return <ParentDashboard />
  }

  return <Dashboard />
}