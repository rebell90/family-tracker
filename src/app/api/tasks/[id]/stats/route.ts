// src/app/api/tasks/[id]/stats/route.ts
// Get completion statistics for a task

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const taskId = params.id  // ✅ CHANGED: Use params.id

    // Verify task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { 
        id: true, 
        points: true,
        familyId: true,
        createdById: true
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Verify user is the creator (parent)
    if (task.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get completion count
    const completionCount = await prisma.taskCompletion.count({
      where: { taskId: task.id }
    })

    // Calculate total points earned from this task
    const totalPoints = completionCount * task.points

    return NextResponse.json({
      completionCount,
      totalPoints
    })

  } catch (error) {
    console.error('Error fetching task stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch task stats' },
      { status: 500 }
    )
  }
}