import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ManageCompletions from '@/components/ManageCompletions'

export const metadata = {
  title: 'Manage Completions - Family Tracker',
  description: 'View and manage task completions',
}

export default async function ManageCompletionsPage() {
  const session = await getServerSession(authOptions)

  // Redirect to login if not authenticated
  if (!session) {
    redirect('/auth/login')
  }

  // Check if user is a parent (optional - component does its own check too)
  const user = session.user as { role?: string } | undefined
  const isParent = user?.role === 'PARENT'

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Manage Completions</h1>
            <p className="text-gray-600 mt-1">
              View and delete task completion history
            </p>
          </div>
          <a
            href="/"
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Back to Dashboard
          </a>
        </div>

        {/* ManageCompletions Component */}
        <ManageCompletions />
      </div>
    </div>
  )
}