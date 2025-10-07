import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DAYS_MAP: { [key: string]: number } = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { family: true }
    })

    if (!user?.familyId) {
      return NextResponse.json([])
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all active tasks for the user
    const tasks = await prisma.task.findMany({
      where: {
        familyId: user.familyId,
        isActive: true,
        OR: [
          { assignedToId: userId },
          { assignedToId: null }
        ]
      },
      include: {
        assignedTo: {
          select: { id: true, name: true }
        }
      }
    })

    const overdueTasks: any[] = []

    for (const task of tasks) {
      if (task.isRecurring) {
        // For recurring tasks, find all missed occurrences
        const missedDates = await findMissedOccurrences(task, userId, today)
        
        // Create a task entry for each missed date
        missedDates.forEach(missedDate => {
          overdueTasks.push({
            ...task,
            missedDate: missedDate.toISOString(),
            occurrenceDate: missedDate.toISOString()
          })
        })
      } else {
        // For one-time tasks, check if incomplete
        const wasCompleted = await prisma.taskCompletion.findFirst({
          where: {
            taskId: task.id,
            userId: userId
          }
        })

        if (!wasCompleted && !task.completedAt) {
          // Task is incomplete - consider it overdue if created before today
          const createdDate = new Date(task.createdAt)
          createdDate.setHours(0, 0, 0, 0)
          
          if (createdDate < today) {
            overdueTasks.push({
              ...task,
              missedDate: createdDate.toISOString()
            })
          }
        }
      }
    }

    return NextResponse.json(overdueTasks)
  } catch (error) {
    console.error('Error fetching overdue tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch overdue tasks' }, { status: 500 })
  }
}

async function findMissedOccurrences(task: any, userId: string, today: Date) {
  const missedDates: Date[] = []

  // Look back up to 30 days for missed occurrences
  const lookbackDate = new Date(today)
  lookbackDate.setDate(lookbackDate.getDate() - 30)

  // Get all completions for this task by this user in the lookback period
  const completions = await prisma.taskCompletion.findMany({
    where: {
      taskId: task.id,
      userId: userId,
      completedAt: {
        gte: lookbackDate
      }
    }
  })

  // Also check for skipped dates
  const skips = await prisma.taskSkip.findMany({
    where: {
      taskId: task.id,
      userId: userId,
      skippedAt: {
        gte: lookbackDate
      }
    }
  })

  // Create a Set of dates that were completed or skipped
  const handledDates = new Set([
    ...completions.map(c => {
      const d = new Date(c.completedAt)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }),
    ...skips.map(s => {
      const d = new Date(s.skippedAt)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })
  ])

  // Check each day in the lookback period
  const checkDate = new Date(lookbackDate)
  
  while (checkDate < today) {
    const dayOfWeek = checkDate.getDay()
    const dayName = Object.keys(DAYS_MAP).find(key => DAYS_MAP[key] === dayOfWeek)
    
    // Should this task have been done on this day?
    const shouldBeDone = task.daysOfWeek.length === 0 || 
                        (dayName && task.daysOfWeek.includes(dayName))
    
    if (shouldBeDone) {
      const checkTime = new Date(checkDate).getTime()
      
      // Was it completed or skipped on this day?
      if (!handledDates.has(checkTime)) {
        missedDates.push(new Date(checkDate))
      }
    }
    
    checkDate.setDate(checkDate.getDate() + 1)
  }

  return missedDates
}