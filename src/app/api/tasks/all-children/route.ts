// src/app/api/tasks/all-children/route.ts
// Returns tasks for ALL children in the family (parent view)

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { familyId: true, role: true },
    })

    if (!user?.familyId) {
      return NextResponse.json({ tasks: [] })
    }

    // Only parents can access this
    if (user.role !== 'PARENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Fetch ALL tasks for ALL children in the family
    const tasks = await prisma.task.findMany({
      where: {
        familyId: user.familyId,
        assignedTo: {
          role: 'CHILD' // Only fetch tasks assigned to children
        }
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Get completions for ALL children
    const completions = await prisma.taskCompletion.findMany({
      where: {
        task: {
          familyId: user.familyId,
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Get skips for ALL children
    const skips = await prisma.taskSkip.findMany({
      where: {
        task: {
          familyId: user.familyId,
        },
      },
      select: {
        taskId: true,
        userId: true,
        skippedAt: true,
      },
    })

    // Create completion/skip maps
    const completionMap = new Map<string, { completedAt: Date; userName: string }>()
    completions.forEach(c => {
      const todayStr = today.toDateString()
      const completedStr = new Date(c.completedAt).toDateString()
      if (completedStr === todayStr) {
        completionMap.set(`${c.taskId}-${c.userId}`, {
          completedAt: c.completedAt,
          userName: c.user.name || 'Unknown'
        })
      }
    })

    const skipMap = new Map<string, boolean>()
    skips.forEach(s => {
      const todayStr = today.toDateString()
      const skippedStr = new Date(s.skippedAt).toDateString()
      if (skippedStr === todayStr) {
        skipMap.set(`${s.taskId}-${s.userId}`, true)
      }
    })

    // Apply date filtering
    const validTasks = tasks.filter(task => {
      // Check if task has started
      if (task.startDate) {
        const startDate = new Date(task.startDate)
        startDate.setHours(0, 0, 0, 0)
        if (today < startDate) return false
      }

      // Check if recurring task has ended (for child view)
      // Parents can see ended tasks in TaskManager, but not here
      if (task.isRecurring && task.recurringEndDate) {
        const endDate = new Date(task.recurringEndDate)
        endDate.setHours(0, 0, 0, 0)
        if (today > endDate) return false
      }

      return true
    })

    // Process tasks with completion status
    const processedTasks = validTasks.map(task => {
      const userId = task.assignedToId!
      const completionKey = `${task.id}-${userId}`
      const completion = completionMap.get(completionKey)
      const isSkipped = skipMap.get(completionKey) || false

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        points: task.points,
        completedAt: completion?.completedAt || null,
        completedToday: !!completion,
        completedBy: completion?.userName || null,
        skippedToday: isSkipped,
        timePeriod: task.timePeriod,
        isRecurring: task.isRecurring,
        daysOfWeek: task.daysOfWeek,
        category: task.category,
        startDate: task.startDate,
        recurringEndDate: task.recurringEndDate,
        assignedTo: task.assignedTo,
        createdBy: task.createdBy,
      }
    })

    return NextResponse.json({ tasks: processedTasks })
  } catch (error) {
    console.error('Error fetching all children tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}