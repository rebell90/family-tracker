import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ManageCompletions from '@/components/ManageCompletions'
import Link from 'next/link'

export const metadata = {
  title: 'Manage Completions - Family Tracker',
  description: 'View and manage task completions',
}

export default async function ManageCompletionsPage() {
  const session = await getServerSession(authOptions)

  // Redirect to login if not authenticated
  if (!session) {
    redirect('/login')
  }

  // Check if user is a parent (optional - component does its own check too)
  const user = session.user as { role?: string } | undefined
  const isParent = user?.role === 'PARENT'

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Back Button - MOBILE RESPONSIVE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manage Completions</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              View and delete task completion history
            </p>
          </div>
          <Link
            href="/"
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-center sm:whitespace-nowrap"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* ManageCompletions Component */}
        <ManageCompletions />
      </div>
    </div>
  )
}