import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all completions for today
    const todaysCompletions = await prisma.taskCompletion.findMany({
      where: {
        userId: session.user.id,
        completedAt: {
          gte: today
        }
      },
      select: {
        taskId: true,
        completedAt: true
      }
    })

    return NextResponse.json(todaysCompletions)
  } catch (error) {
    console.error('Error fetching today\'s completions:', error)
    return NextResponse.json({ error: 'Failed to fetch completions' }, { status: 500 })
  }
}