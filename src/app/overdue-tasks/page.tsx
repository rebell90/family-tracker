// app/overdue-tasks/page.tsx

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OverdueTasks from '@/components/OverdueTasks'

export const metadata = {
  title: 'Overdue Tasks - Family Tracker',
  description: 'Manage all your overdue and incomplete tasks',
}

export default async function OverdueTasksPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return <OverdueTasks />
}