import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !('id' in session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await request.json()

    // Get the task to verify it exists
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      include: { userPoints: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find today's completion
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const completion = await prisma.taskCompletion.findFirst({
      where: {
        taskId: task.id,
        userId: user.id,
        completedAt: {
          gte: today
        }
      }
    })

    if (!completion) {
      return NextResponse.json({ error: 'No completion found for today' }, { status: 404 })
    }

    // Delete the completion
    await prisma.taskCompletion.delete({
      where: { id: completion.id }
    })

    // Refund the points
    if (user.userPoints) {
      await prisma.userPoints.update({
        where: { userId: user.id },
        data: {
          currentPoints: Math.max(0, user.userPoints.currentPoints - task.points),
          totalEarned: Math.max(0, user.userPoints.totalEarned - task.points)
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Task unmarked. ${task.points} points removed.`
    })

  } catch (error) {
    console.error('Task undo error:', error)
    return NextResponse.json({ error: 'Failed to undo task completion' }, { status: 500 })
  }
}