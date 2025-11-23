// src/app/api/tasks/overdue/route.ts
// UPDATED: Now filters out tasks before their startDate

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface OverdueTask {
  id: string
  title: string
  description: string | null
  points: number
  timePeriod: string | null
  isRecurring: boolean
  daysOfWeek: string[]
  category: string | null
  familyId: string
  assignedToId: string | null
  createdById: string
  createdAt: Date
  updatedAt: Date
  recurringEndDate: Date | null
  startDate: Date | null
  assignedTo: {
    id: string
    name: string | null
  } | null
  missedDate: string
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { familyId: true, role: true },
    })

    if (!user?.familyId) {
      return NextResponse.json({ tasks: [] })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Fetch all family tasks
    const tasks = await prisma.task.findMany({
      where: {
        familyId: user.familyId,
        assignedToId: session.user.id,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Get all completions and skips for this user
    const completions = await prisma.taskCompletion.findMany({
      where: {
        userId: session.user.id,
        taskId: { in: tasks.map(t => t.id) },
      },
      select: {
        taskId: true,
        completedAt: true,
      },
    })

    const skips = await prisma.taskSkip.findMany({
      where: {
        userId: session.user.id,
        taskId: { in: tasks.map(t => t.id) },
      },
      select: {
        taskId: true,
        skippedAt: true,
      },
    })

    const completionMap = new Map<string, Set<string>>()
    completions.forEach(c => {
      const dateKey = new Date(c.completedAt).toDateString()
      if (!completionMap.has(c.taskId)) {
        completionMap.set(c.taskId, new Set())
      }
      completionMap.get(c.taskId)!.add(dateKey)
    })

    const skipMap = new Map<string, Set<string>>()
    skips.forEach(s => {
      const dateKey = new Date(s.skippedAt).toDateString()
      if (!skipMap.has(s.taskId)) {
        skipMap.set(s.taskId, new Set())
      }
      skipMap.get(s.taskId)!.add(dateKey)
    })

    const overdueTasks: OverdueTask[] = []
    const DAYS_MAP: { [key: string]: number } = {
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
    }

    tasks.forEach(task => {
      // ✅ NEW: Get task start date
      const taskStartDate = task.startDate ? new Date(task.startDate) : new Date(task.createdAt)
      taskStartDate.setHours(0, 0, 0, 0)

      if (task.isRecurring && task.daysOfWeek.length > 0) {
        // Check recurring end date
        if (task.recurringEndDate) {
          const endDate = new Date(task.recurringEndDate)
          endDate.setHours(23, 59, 59, 999)
          if (today > endDate) return
        }

        const daysToCheck = task.daysOfWeek.map(d => DAYS_MAP[d])
        
        // ✅ CHANGED: Start from taskStartDate, not 30 days ago
        const startCheckDate = new Date(Math.max(taskStartDate.getTime(), today.getTime() - (30 * 24 * 60 * 60 * 1000)))
        
        const checkDate = new Date(startCheckDate)
        
        while (checkDate < today) {
          const dayOfWeek = checkDate.getDay()
          
          if (daysToCheck.includes(dayOfWeek)) {
            // ✅ NEW: Skip if before task start date
            if (checkDate >= taskStartDate) {
              const dateKey = checkDate.toDateString()
              const isCompleted = completionMap.get(task.id)?.has(dateKey)
              const isSkipped = skipMap.get(task.id)?.has(dateKey)
              
              if (!isCompleted && !isSkipped) {
                overdueTasks.push({
                  ...task,
                  missedDate: checkDate.toISOString(),
                })
              }
            }
          }
          
          checkDate.setDate(checkDate.getDate() + 1)
        }
      } else if (!task.isRecurring) {
        // ✅ NEW: For non-recurring, also check start date
        const taskDate = new Date(task.createdAt)
        taskDate.setHours(0, 0, 0, 0)
        
        // Only show as overdue if it's before today AND after start date
        if (taskDate < today && taskDate >= taskStartDate) {
          const dateKey = taskDate.toDateString()
          const isCompleted = completionMap.get(task.id)?.has(dateKey)
          const isSkipped = skipMap.get(task.id)?.has(dateKey)
          
          if (!isCompleted && !isSkipped) {
            overdueTasks.push({
              ...task,
              missedDate: task.createdAt.toISOString(),
            })
          }
        }
      }
    })

    overdueTasks.sort((a, b) => 
      new Date(b.missedDate).getTime() - new Date(a.missedDate).getTime()
    )

    return NextResponse.json({ tasks: overdueTasks })
  } catch (error) {
    console.error('Error fetching overdue tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overdue tasks' },
      { status: 500 }
    )
  }
}