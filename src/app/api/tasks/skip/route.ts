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

    const { taskId, reason } = await request.json()

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

    // Create a task skip record
    await prisma.taskSkip.create({
      data: {
        taskId,
        userId: session.user.id,
        reason: reason || null
      }
    })

    return NextResponse.json({ 
      message: 'Task marked as skipped',
      reason: reason || 'No reason provided'
    })
  } catch (error) {
    console.error('Error skipping task:', error)
    return NextResponse.json({ error: 'Failed to skip task' }, { status: 500 })
  }
}