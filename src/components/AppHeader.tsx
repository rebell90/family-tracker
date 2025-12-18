'use client'

import { useSession, signOut } from 'next-auth/react'
import { LogOut, Home } from 'lucide-react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'

export default function AppHeader() {
  const { data: session } = useSession()

  if (!session) return null

  const user = session.user as { name?: string; role?: string } | undefined
  const isParent = user?.role === 'PARENT'

  return (
    <header className="bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo/Title */}
          <Link 
            href="/" 
            className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-xl font-bold text-purple-600 hover:text-purple-700 transition-colors"
          >
            <Home size={20} className="sm:w-6 sm:h-6" />
            <span className="hidden xs:inline">Family Tracker</span>
            <span className="xs:hidden">Tracker</span>
          </Link>

          {/* User Menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* User Info - Compact */}
            <div className="flex flex-col items-end">
              <span className="font-medium text-gray-800 text-sm sm:text-base">{user?.name}</span>
              <span className="text-xs text-gray-500">
                {isParent ? 'Parent' : 'Child'}
              </span>
            </div>

            {/* Notification Bell */}
            <NotificationBell />
            
            {/* Logout Button */}
            <button
              onClick={() => signOut({ callbackUrl: window.location.origin + '/auth/signin' })}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors"
            >
              <LogOut size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}