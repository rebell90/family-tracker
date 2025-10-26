import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface AuthSession {
  user: {
    id: string
    name?: string | null
    email?: string | null
    role?: string | null
    familyId?: string | null
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AuthSession | null

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { family: true },
    })

    if (!user?.familyId) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    if (user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can view weekly reports' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const childId = searchParams.get('childId')
    const weekStart = searchParams.get('weekStart')
    const weekEnd = searchParams.get('weekEnd')

    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { error: 'weekStart and weekEnd are required' },
        { status: 400 }
      )
    }

    const startDate = new Date(weekStart)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(weekEnd)
    endDate.setHours(23, 59, 59, 999)

    const childFilter = childId ? { id: childId } : { role: 'CHILD' }

    const children = await prisma.user.findMany({
      where: {
        familyId: user.familyId,
        ...childFilter,
      },
      select: {
        id: true,
        name: true,
      },
    })

    const taskCompletions = await prisma.taskCompletion.findMany({
      where: {
        userId: { in: children.map((c) => c.id) },
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            points: true,
            category: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        completedAt: 'asc',
      },
    })

    const childrenStats = children.map((child) => {
      const childCompletions = taskCompletions.filter(
        (tc) => tc.userId === child.id
      )

      const totalTasksCompleted = childCompletions.length
      const totalPointsEarned = childCompletions.reduce(
        (sum, tc) => sum + (tc.task.points || 0),
        0
      )

      return {
        childId: child.id,
        childName: child.name,
        tasksCompleted: totalTasksCompleted,
        taskPoints: totalPointsEarned,
        habitsCompleted: 0,
        habitPoints: 0,
        totalPoints: totalPointsEarned,
      }
    })

    const dailyData: Record<string, any> = {}

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateKey = d.toISOString().split('T')[0]
      dailyData[dateKey] = {
        date: dateKey,
        tasks: 0,
        points: 0,
        habits: 0,
      }
    }

    taskCompletions.forEach((tc) => {
      const dateKey = tc.completedAt.toISOString().split('T')[0]
      if (dailyData[dateKey]) {
        dailyData[dateKey].tasks += 1
        dailyData[dateKey].points += tc.task.points || 0
      }
    })

    return NextResponse.json({
      weekStart: startDate,
      weekEnd: endDate,
      children: childrenStats,
      taskCompletions,
      habitLogs: [],
      dailyData: Object.values(dailyData),
    })
  } catch (error) {
    console.error('Error fetching weekly data:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch weekly data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}