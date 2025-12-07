// src/app/api/tasks/overdue/route.ts
// FIXED: Returns completedToday and completedAt for filtering

import { NextResponse, NextRequest } from 'next/server'
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
  completedToday?: boolean  // ✅ ADDED
  completedAt?: Date | null  // ✅ ADDED
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { familyId: true, role: true },
    })

    if (!user?.familyId) {
      return NextResponse.json({ tasks: [] })
    }

    let targetUserId = session.user.id

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // If parent is requesting another user's overdue tasks
    if (requestedUserId && user.role === 'PARENT') {
      const targetUser = await prisma.user.findUnique({
        where: { id: requestedUserId },
        select: { familyId: true },
      })
      
      if (targetUser?.familyId === user.familyId) {
        targetUserId = requestedUserId
      }
    }

    // Fetch all family tasks
    const tasks = await prisma.task.findMany({
      where: {
        familyId: user.familyId,
        assignedToId: targetUserId, 
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
    console.log('targetUserId:', targetUserId)

    // ✅ FIXED: Get completions and skips for TARGET USER (child), not parent!
    const completions = await prisma.taskCompletion.findMany({
      where: {
        userId: targetUserId,  // ✅ FIXED: Was session.user.id
        taskId: { in: tasks.map(t => t.id) },
      },
      select: {
        taskId: true,
        completedAt: true,
      },
    })

    const skips = await prisma.taskSkip.findMany({
      where: {
        userId: targetUserId,  // ✅ FIXED: Was session.user.id
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

    // ✅ NEW: Also create a map for the actual completion dates
    const completionDateMap = new Map<string, Date>()
    completions.forEach(c => {
      const dateKey = new Date(c.completedAt).toDateString()
      const key = `${c.taskId}-${dateKey}`
      completionDateMap.set(key, c.completedAt)
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
        const daysToCheck = task.daysOfWeek.map(d => DAYS_MAP[d])
        
        // Start checking from task start date (or 30 days ago, whichever is later)
        const startCheckDate = new Date(Math.max(taskStartDate.getTime(), today.getTime() - (30 * 24 * 60 * 60 * 1000)))
        
        const checkDate = new Date(startCheckDate)
        
        // Determine last date to check
        let lastCheckDate = new Date(today)
        lastCheckDate.setDate(lastCheckDate.getDate() - 1) // Yesterday
        lastCheckDate.setHours(0, 0, 0, 0)
        
        // If task has ended, only check up to the end date
        if (task.recurringEndDate) {
          const endDate = new Date(task.recurringEndDate)
          endDate.setHours(0, 0, 0, 0)
          
          if (lastCheckDate > endDate) {
            lastCheckDate = endDate
          }
        }
        
        while (checkDate <= lastCheckDate) {
          const dayOfWeek = checkDate.getDay()
          
          if (daysToCheck.includes(dayOfWeek)) {
            if (checkDate >= taskStartDate) {
              const dateKey = checkDate.toDateString()
              const isCompleted = completionMap.get(task.id)?.has(dateKey)
              const isSkipped = skipMap.get(task.id)?.has(dateKey)
              
              // Return ALL tasks with their completion status
              // Frontend will filter out completed ones
              const completionKey = `${task.id}-${dateKey}`
              const completedAt = completionDateMap.get(completionKey)
              
              overdueTasks.push({
                ...task,
                missedDate: checkDate.toISOString(),
                completedToday: !!isCompleted,  // True if completed on this specific date
                completedAt: completedAt || null,
                skippedToday: !!isSkipped,  // ✅ ADDED: True if skipped on this date
              })
            }
          }
          
          checkDate.setDate(checkDate.getDate() + 1)
        }
      } else if (!task.isRecurring) {
        // For non-recurring tasks
        const taskDate = new Date(task.createdAt)
        taskDate.setHours(0, 0, 0, 0)
        
        if (taskDate < today && taskDate >= taskStartDate) {
          const dateKey = taskDate.toDateString()
          const isCompleted = completionMap.get(task.id)?.has(dateKey)
          const isSkipped = skipMap.get(task.id)?.has(dateKey)  // ✅ ADDED
          
          // ✅ CHANGED: Always add task, with completion status
          const completionKey = `${task.id}-${dateKey}`
          const completedAt = completionDateMap.get(completionKey)
          
          overdueTasks.push({
            ...task,
            missedDate: task.createdAt.toISOString(),
            completedToday: !!isCompleted,  // ✅ ADDED
            completedAt: completedAt || null,  // ✅ ADDED
            skippedToday: !!isSkipped,  // ✅ ADDED
          })
        }
      }
    })

    overdueTasks.sort((a, b) => 
      new Date(b.missedDate).getTime() - new Date(a.missedDate).getTime()
    )

    console.log('\n=== FINAL RESULT ===')
    console.log('Total overdue tasks (before filter):', overdueTasks.length)
    console.log('Completed tasks:', overdueTasks.filter(t => t.completedToday).length)
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