import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskIds, action } = await request.json()

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: 'No tasks selected' }, { status: 400 })
    }

    // Verify all tasks belong to the user
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        assignedToId: session.user.id
      }
    })

    if (tasks.length !== taskIds.length) {
      return NextResponse.json({ error: 'Some tasks not found or access denied' }, { status: 403 })
    }

    switch (action) {
      case 'complete':
        // Mark all tasks as completed and update points
        for (const task of tasks) {
          // Create completion record
          await prisma.taskCompletion.create({
            data: {
              taskId: task.id,
              userId: session.user.id,
              completedAt: new Date()
            }
          })

          // Update user points
          await prisma.userPoints.upsert({
            where: { userId: session.user.id },
            update: {
              currentPoints: { increment: task.points },
              totalEarned: { increment: task.points }
            },
            create: {
              userId: session.user.id,
              currentPoints: task.points,
              totalEarned: task.points
            }
          })
        }
        break

      case 'skip':
        // Create skip records for all tasks
        const skipData = taskIds.map(taskId => ({
          taskId,
          userId: session.user.id,
          reason: 'Bulk skip'
        }))
        
        await prisma.taskSkip.createMany({
          data: skipData
        })
        break

      case 'reschedule':
        // Reschedule all tasks to today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        await prisma.task.updateMany({
          where: {
            id: { in: taskIds }
          },
          data: {
            dueDate: today
          }
        })
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ 
      message: `Successfully processed ${taskIds.length} tasks`,
      action,
      processedCount: taskIds.length
    })
  } catch (error) {
    console.error('Error processing bulk action:', error)
    return NextResponse.json({ error: 'Failed to process tasks' }, { status: 500 })
  }
}