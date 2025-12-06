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
    
    console.log('🔄 Task completion request:', { taskId, userId: session.user.id })

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
      console.log('❌ Task not found:', taskId)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    
    console.log('✅ Task found:', { 
      taskId: task.id, 
      title: task.title, 
      assignedToId: task.assignedToId,
      assignedToName: task.assignedTo?.name 
    })

    // Get current user info
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { familyId: true, role: true, name: true }
    })

    console.log('👤 Current user:', { 
      id: session.user.id, 
      name: currentUser?.name, 
      role: currentUser?.role 
    })

    // 🆕 NEW: Check if parent is completing for child
    const isParentCompletingForChild = 
      currentUser?.role === 'PARENT' && 
      task.assignedTo?.familyId === currentUser.familyId

    // Check if user is the assigned user
    const isAssignedUser = session.user.id === task.assignedToId

    console.log('🔐 Permission check:', { 
      isAssignedUser, 
      isParentCompletingForChild,
      allowed: isAssignedUser || isParentCompletingForChild 
    })

    // Allow if either:
    // 1. User is the assigned user (child completing their own task)
    // 2. User is parent in same family (parent completing for child)
    if (!isAssignedUser && !isParentCompletingForChild) {
      console.log('❌ Unauthorized attempt')
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
        userId: task.assignedToId || session.user.id, // Use session user if no assignedTo
        completedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    if (existingCompletion) {
      return NextResponse.json({ error: 'Task already completed today' }, { status: 400 })
    }

    // Use assignedToId if exists, otherwise use session user
    const targetUserId = task.assignedToId || session.user.id

    // Create completion record
    // IMPORTANT: Award to the CHILD (assignedToId), not the parent
    const completion = await prisma.taskCompletion.create({
      data: {
        taskId: task.id,
        userId: targetUserId, // Award to child (or session user if no assignedTo)
        completedAt: new Date(),
      },
    })

    // Award points to the CHILD (or session user)
    await prisma.userPoints.upsert({
      where: { userId: targetUserId },
      update: {
        currentPoints: { increment: task.points },
        totalEarned: { increment: task.points },
      },
      create: {
        userId: targetUserId,
        currentPoints: task.points,
        totalEarned: task.points,
      },
    })

    // 🆕 NEW: Create notification for the child
    if (isParentCompletingForChild && targetUserId) {
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          type: 'TASK_COMPLETED',
          title: 'Task Completed!',
          message: `${currentUser.name} completed "${task.title}" for you! You earned ${task.points} points.`,
        },
      })
    }

    console.log('✅ Task completed successfully:', { 
      taskId: task.id, 
      userId: targetUserId,
      points: task.points 
    })

    return NextResponse.json({ 
      success: true, 
      completion,
      message: isParentCompletingForChild 
        ? `Task completed on behalf of ${task.assignedTo?.name}` 
        : 'Task completed successfully'
    })

  } catch (error) {
    console.error('💥 Error completing task:', error)
    return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 })
  }
}