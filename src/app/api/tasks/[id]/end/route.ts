// src/app/api/tasks/[id]/end/route.ts
// End a task by setting its recurringEndDate to yesterday

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params  // ✅ FIXED: Await params
    const taskId = params.id

    // Verify task exists and user owns it
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        createdById: true,
        isRecurring: true
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Set end date to yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(23, 59, 59, 999)

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        recurringEndDate: yesterday
      }
    })

    console.log(`✅ Task ended: ${task.title} (end date set to ${yesterday.toISOString()})`)

    return NextResponse.json({
      message: 'Task ended successfully',
      task: updatedTask
    })

  } catch (error) {
    console.error('Error ending task:', error)
    return NextResponse.json(
      { error: 'Failed to end task' },
      { status: 500 }
    )
  }
}