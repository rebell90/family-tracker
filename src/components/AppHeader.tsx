'use client'

import { useSession, signOut } from 'next-auth/react'
import { LogOut, User, Home } from 'lucide-react'
import Link from 'next/link'

export default function AppHeader() {
  const { data: session } = useSession()

  if (!session) return null

  const user = session.user as { name?: string; role?: string } | undefined

  return (
    <header className="bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Title */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-purple-600 hover:text-purple-700 transition-colors">
              <Home size={24} />
              Family Tracker
            </Link>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600">
              <User size={16} />
              <span className="font-medium">{user?.name}</span>
              <span className="text-sm text-gray-400">
                ({user?.role === 'PARENT' ? '👨‍👩‍👧‍👦 Parent' : '🧒 Child'})
              </span>
            </div>
            
<button
  onClick={() => signOut()}
  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
>
  <LogOut size={16} />
  Logout
</button>
          </div>
        </div>
      </div>
    </header>
  )
}