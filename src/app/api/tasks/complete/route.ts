import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AuthSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    familyId?: string | null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId, completedAt } = await request.json()

    // Get the task and verify family access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: true,
        family: true,
        completions: {
          where: {
            userId: session.user.id,
            completedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)) // Today only
            }
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Get current user details
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { userPoints: true }
    })

    if (!user || user.familyId !== task.familyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if task is already completed today (for non-recurring tasks)
    if (!task.isRecurring && task.completions.length > 0) {
      return NextResponse.json({ error: 'Task already completed today' }, { status: 400 })
    }

    // Create completion record
const completion = await prisma.taskCompletion.create({
  data: {
    taskId: task.id,
    userId: user.id,
    completedAt: completedAt ? new Date(completedAt) : new Date()  // Use provided date
  }
})

        // If it's not a recurring task, mark it as completed
    if (!task.isRecurring) {
      await prisma.task.update({
        where: { id: taskId },
        data: { completedAt: new Date() }
      })
    }

    // Update or create user points
    let userPoints = await prisma.userPoints.findUnique({
      where: { userId: user.id }
    })

    if (userPoints) {
      userPoints = await prisma.userPoints.update({
        where: { userId: user.id },
        data: {
          currentPoints: userPoints.currentPoints + task.points,
          totalEarned: userPoints.totalEarned + task.points
        }
      })
    } else {
      userPoints = await prisma.userPoints.create({
        data: {
          userId: user.id,
          currentPoints: task.points,
          totalEarned: task.points
        }
      })
    }

    return NextResponse.json({
      success: true,
      completion,
      pointsEarned: task.points,
      newPointsTotal: userPoints.currentPoints,
      message: `Great job! You earned ${task.points} points!`
    })

  } catch (error) {
    console.error('Task completion error:', error)
    return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 })
  }
}