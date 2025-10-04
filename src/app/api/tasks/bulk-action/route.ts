// app/api/tasks/bulk-action/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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

    switch (action) {
      case 'complete':
        // Mark all tasks as completed
        for (const taskId of taskIds) {
          await prisma.taskCompletion.create({
            data: {
              taskId,
              userId: session.user.id,
              completedAt: new Date()
            }
          })

          // Update user points
          const task = await prisma.task.findUnique({
            where: { id: taskId }
          })
          
          if (task) {
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
        }
        break

      case 'skip':
        // Mark tasks as skipped (you'd need to implement skip tracking)
        // For now, just log them
        console.log('Skipping tasks:', taskIds)
        break

      case 'reschedule':
        // Reschedule all tasks to today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // You'd update the due dates here if you have that field
        // for (const taskId of taskIds) {
        //   await prisma.task.update({
        //     where: { id: taskId },
        //     data: { dueDate: today }
        //   })
        // }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ 
      message: `Successfully processed ${taskIds.length} tasks`,
      action 
    })
  } catch (error) {
    console.error('Error processing bulk action:', error)
    return NextResponse.json({ error: 'Failed to process tasks' }, { status: 500 })
  }
}