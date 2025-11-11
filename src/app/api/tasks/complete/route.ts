// src/app/api/tasks/complete/route.ts
// Updated to automatically notify parents when tasks are completed

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyTaskCompleted } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // Fetch the task with relations
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Verify task is assigned to this user
    if (task.assignedToId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to complete this task' },
        { status: 403 }
      )
    }

    // Check if already completed today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existingCompletion = await prisma.taskCompletion.findFirst({
      where: {
        taskId,
        userId: session.user.id,
        completedAt: {
          gte: today,
        },
      },
    })

    if (existingCompletion) {
      return NextResponse.json(
        { error: 'Task already completed today' },
        { status: 400 }
      )
    }

    // Get user info for notification
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    })

    // Create task completion
    const completion = await prisma.taskCompletion.create({
      data: {
        taskId,
        userId: session.user.id,
      },
    })

    // Award points to user
    await prisma.userPoints.upsert({
      where: { userId: session.user.id },
      update: {
        currentPoints: { increment: task.points },
        totalEarned: { increment: task.points },
      },
      create: {
        userId: session.user.id,
        currentPoints: task.points,
        totalEarned: task.points,
      },
    })

    // 🔔 NEW: Notify the parent who created the task
    if (task.createdBy) {
      try {
        await notifyTaskCompleted({
          parentId: task.createdBy.id,
          childName: user?.name || 'Someone',
          taskTitle: task.title,
          taskId: task.id,
          pointsEarned: task.points,
        })
        console.log(`✅ Parent notified of task completion: ${task.title}`)
      } catch (notifError) {
        // Don't fail the whole request if notification fails
        console.error('Failed to send completion notification:', notifError)
      }
    }

    return NextResponse.json({
      completion,
      pointsEarned: task.points,
      message: 'Task completed successfully!',
    })
  } catch (error) {
    console.error('Error completing task:', error)
    return NextResponse.json(
      { error: 'Failed to complete task' },
      { status: 500 }
    )
  }
}