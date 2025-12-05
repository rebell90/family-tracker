// src/app/api/tasks/complete/route.ts
// CRITICAL FIX: Allow parents to complete tasks on behalf of children

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

    const { taskId } = await request.json()

    // Get the task with assigned user info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: {
          select: { id: true, familyId: true, name: true }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Verify task has an assigned user
    if (!task.assignedToId) {
      return NextResponse.json({ error: 'Task has no assigned user' }, { status: 400 })
    }

    // Get current user info
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { familyId: true, role: true, name: true }
    })

    // 🆕 NEW: Check if parent is completing for child
    const isParentCompletingForChild = 
      currentUser?.role === 'PARENT' && 
      task.assignedTo?.familyId === currentUser.familyId

    // Check if user is the assigned user
    const isAssignedUser = session.user.id === task.assignedToId

    // Allow if either:
    // 1. User is the assigned user (child completing their own task)
    // 2. User is parent in same family (parent completing for child)
    if (!isAssignedUser && !isParentCompletingForChild) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if already completed today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const existingCompletion = await prisma.taskCompletion.findFirst({
      where: {
        taskId: task.id,
        userId: task.assignedToId, // Check for assigned user's completion
        completedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    if (existingCompletion) {
      return NextResponse.json({ error: 'Task already completed today' }, { status: 400 })
    }

    // Create completion record
    // IMPORTANT: Award to the CHILD (assignedToId), not the parent
    const completion = await prisma.taskCompletion.create({
      data: {
        taskId: task.id,
        userId: task.assignedToId, // Award to child
        completedAt: new Date(),
      },
    })

    // Award points to the CHILD
    await prisma.userPoints.upsert({
      where: { userId: task.assignedToId },
      update: {
        currentPoints: { increment: task.points },
        totalEarned: { increment: task.points },
      },
      create: {
        userId: task.assignedToId,
        currentPoints: task.points,
        totalEarned: task.points,
      },
    })

    // 🆕 NEW: Create notification for the child
    if (isParentCompletingForChild && task.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: task.assignedToId,
          type: 'TASK_COMPLETED',
          title: 'Task Completed!',
          message: `${currentUser.name} completed "${task.title}" for you! You earned ${task.points} points.`,
        },
      })
    }

    return NextResponse.json({ 
      success: true, 
      completion,
      message: isParentCompletingForChild 
        ? `Task completed on behalf of ${task.assignedTo?.name}` 
        : 'Task completed successfully'
    })

  } catch (error) {
    console.error('Error completing task:', error)
    return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 })
  }
}