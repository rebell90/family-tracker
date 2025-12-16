// src/app/api/tasks/overdue/route.ts
// FIXED: Returns completedToday and completedAt for filtering
// ✅ FIXED: Handles "all children" case for parents

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
  completedToday?: boolean
  completedAt?: Date | null
  skippedToday?: boolean
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

    let targetUserIds: string[] = []  // ✅ CHANGED: Now supports multiple users
    let fetchAllChildren = false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ✅ FIXED: Handle "all children" case for parents
    if (user.role === 'PARENT') {
      if (requestedUserId) {
        // Parent requesting specific child's tasks
        const targetUser = await prisma.user.findUnique({
          where: { id: requestedUserId },
          select: { familyId: true },
        })
        
        if (targetUser?.familyId === user.familyId) {
          targetUserIds = [requestedUserId]
        }
      } else {
        // ✅ NEW: Parent with no userId param = get ALL children's tasks
        fetchAllChildren = true
        
        // Get all children in the family
        const children = await prisma.user.findMany({
          where: {
            familyId: user.familyId,
            role: 'CHILD',
          },
          select: {
            id: true,
          },
        })
        
        targetUserIds = children.map(c => c.id)
        console.log('📋 Fetching overdue tasks for ALL children:', targetUserIds)
      }
    } else {
      // Child viewing their own tasks
      targetUserIds = [session.user.id]
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ tasks: [] })
    }

    // ✅ FIXED: Fetch tasks for target users
    const tasks = await prisma.task.findMany({
      where: {
        familyId: user.familyId,
        assignedToId: { in: targetUserIds },  // ✅ FIXED: Use IN clause for multiple users
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
    console.log('targetUserIds:', targetUserIds)
    console.log('fetchAllChildren:', fetchAllChildren)

    // ✅ FIXED: Get completions and skips for ALL TARGET USERS
    const completions = await prisma.taskCompletion.findMany({
      where: {
        userId: { in: targetUserIds },  // ✅ FIXED: Check all target users
        taskId: { in: tasks.map(t => t.id) },
      },
      select: {
        taskId: true,
        completedAt: true,
        userId: true,  // ✅ ADDED: Track which user completed it
      },
    })

    const skips = await prisma.taskSkip.findMany({
      where: {
        userId: { in: targetUserIds },  // ✅ FIXED: Check all target users
        taskId: { in: tasks.map(t => t.id) },
      },
      select: {
        taskId: true,
        skippedAt: true,
        userId: true,  // ✅ ADDED: Track which user skipped it
      },
    })

    // ✅ FIXED: Build completion map with user ID included
    const completionMap = new Map<string, Set<string>>()
    completions.forEach(c => {
      const dateKey = new Date(c.completedAt).toDateString()
      const key = `${c.taskId}-${c.userId}`  // ✅ CHANGED: Include userId in key
      if (!completionMap.has(key)) {
        completionMap.set(key, new Set())
      }
      completionMap.get(key)!.add(dateKey)
    })

    const skipMap = new Map<string, Set<string>>()
    skips.forEach(s => {
      const dateKey = new Date(s.skippedAt).toDateString()
      const key = `${s.taskId}-${s.userId}`  // ✅ CHANGED: Include userId in key
      if (!skipMap.has(key)) {
        skipMap.set(key, new Set())
      }
      skipMap.get(key)!.add(dateKey)
    })

    // ✅ NEW: Also create a map for the actual completion dates with userId
    const completionDateMap = new Map<string, Date>()
    completions.forEach(c => {
      const dateKey = new Date(c.completedAt).toDateString()
      const key = `${c.taskId}-${c.userId}-${dateKey}`  // ✅ CHANGED: Include userId
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

      // ✅ FIXED: Get the userId for this task (assignedToId)
      const taskUserId = task.assignedToId

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
              const completionKey = `${task.id}-${taskUserId}`  // ✅ CHANGED: Include userId
              const isCompleted = completionMap.get(completionKey)?.has(dateKey)
              
              const skipKey = `${task.id}-${taskUserId}`  // ✅ CHANGED: Include userId
              const isSkipped = skipMap.get(skipKey)?.has(dateKey)
              
              // Return ALL tasks with their completion status
              // Frontend will filter out completed ones
              const completionDateKey = `${task.id}-${taskUserId}-${dateKey}`  // ✅ CHANGED
              const completedAt = completionDateMap.get(completionDateKey)
              
              overdueTasks.push({
                ...task,
                missedDate: checkDate.toISOString(),
                completedToday: !!isCompleted,
                completedAt: completedAt || null,
                skippedToday: !!isSkipped,
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
          const completionKey = `${task.id}-${taskUserId}`  // ✅ CHANGED: Include userId
          const isCompleted = completionMap.get(completionKey)?.has(dateKey)
          
          const skipKey = `${task.id}-${taskUserId}`  // ✅ CHANGED: Include userId
          const isSkipped = skipMap.get(skipKey)?.has(dateKey)
          
          const completionDateKey = `${task.id}-${taskUserId}-${dateKey}`  // ✅ CHANGED
          const completedAt = completionDateMap.get(completionDateKey)
          
          overdueTasks.push({
            ...task,
            missedDate: task.createdAt.toISOString(),
            completedToday: !!isCompleted,
            completedAt: completedAt || null,
            skippedToday: !!isSkipped,
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