import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all incomplete tasks for this user
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: session.user.id,
        completed: false
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Get today's completions to filter out completed tasks
    const todayCompletions = await prisma.taskCompletion.findMany({
      where: {
        userId: session.user.id,
        completedAt: {
          gte: today
        }
      },
      select: {
        taskId: true
      }
    })

    const completedTodayIds = new Set(todayCompletions.map(c => c.taskId))

    // Filter out tasks completed today
    const overdueTasks = tasks.filter(task => !completedTodayIds.has(task.id))

    return NextResponse.json(overdueTasks)
  } catch (error) {
    console.error('Error fetching overdue tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch overdue tasks' }, { status: 500 })
  }
}