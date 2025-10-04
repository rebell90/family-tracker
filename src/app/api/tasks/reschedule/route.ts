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

    const { taskId, newDate } = await request.json()

    // Verify task exists and user has access
    const task = await prisma.task.findFirst({
      where: { 
        id: taskId,
        assignedToId: session.user.id
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found or access denied' }, { status: 404 })
    }

    // Update the task's due date
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { 
        dueDate: new Date(newDate)
      }
    })

    return NextResponse.json({ 
      message: 'Task rescheduled successfully',
      newDate: newDate,
      task: updatedTask
    })
  } catch (error) {
    console.error('Error rescheduling task:', error)
    return NextResponse.json({ error: 'Failed to reschedule task' }, { status: 500 })
  }
}