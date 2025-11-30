// app/parent-dashboard/page.tsx

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ParentDashboard from '@/components/ParentDashboard'

export const metadata = {
  title: 'Parent Dashboard - Family Tracker',
  description: 'Monitor and manage your children\'s tasks and progress',
}

export default async function ParentDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Only parents can access this page
  if (session.user.role !== 'PARENT') {
    redirect('/')
  }

  return <ParentDashboard />
}