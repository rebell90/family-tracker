// src/app/api/tasks/overdue/route.ts
// FIXED: Shows overdue tasks from BEFORE the end date (catch-up feature)

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
console.log('=== OVERDUE API DEBUG ===')
console.log('Total tasks from DB:', tasks.length)
console.log('Today:', today.toISOString())
console.log('\nTasks found:')
tasks.forEach(task => {
  console.log({
    title: task.title,
    isRecurring: task.isRecurring,
    daysOfWeek: task.daysOfWeek,
    startDate: task.startDate?.toISOString(),
    recurringEndDate: task.recurringEndDate?.toISOString(),
    createdAt: task.createdAt.toISOString()
  })
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
      // Get task start date
      const taskStartDate = task.startDate ? new Date(task.startDate) : new Date(task.createdAt)
      taskStartDate.setHours(0, 0, 0, 0)

      if (task.isRecurring && task.daysOfWeek.length > 0) {
        // 🔧 FIXED: Don't skip the whole task if it ended
        // Instead, only check dates up to the end date
        
        const daysToCheck = task.daysOfWeek.map(d => DAYS_MAP[d])
        
        // Start checking from task start date (or 30 days ago, whichever is later)
        const startCheckDate = new Date(Math.max(taskStartDate.getTime(), today.getTime() - (30 * 24 * 60 * 60 * 1000)))
        
        const checkDate = new Date(startCheckDate)
        
        // 🆕 NEW: Determine last date to check
        let lastCheckDate = new Date(today)
        lastCheckDate.setDate(lastCheckDate.getDate() - 1) // Yesterday
        lastCheckDate.setHours(0, 0, 0, 0)
        
        // If task has ended, only check up to the end date
        if (task.recurringEndDate) {
          const endDate = new Date(task.recurringEndDate)
          endDate.setHours(0, 0, 0, 0)
          
          // Only check dates up to the end date (or yesterday, whichever is earlier)
          if (lastCheckDate > endDate) {
            lastCheckDate = endDate
          }
        }
        
        while (checkDate <= lastCheckDate) {
          const dayOfWeek = checkDate.getDay()
          
          if (daysToCheck.includes(dayOfWeek)) {
            // Only process if on or after task start date
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
        // For non-recurring tasks
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

console.log('\n=== FINAL RESULT ===')
console.log('Overdue tasks found:', overdueTasks.length)
console.log('Overdue tasks:', overdueTasks.map(t => ({
  title: t.title,
  missedDate: t.missedDate
})))
console.log('===================\n')

    return NextResponse.json({ tasks: overdueTasks })
  } catch (error) {
    console.error('Error fetching overdue tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overdue tasks' },
      { status: 500 }
    )
  }
}