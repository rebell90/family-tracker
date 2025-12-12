// src/app/api/tasks/route.ts
// FULLY FIXED: Returns completedToday, completedAt, completedBy, AND skippedToday
// PLUS: Fixed timePeriod and recurringEndDate handling with debug logging

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyTaskAssigned } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// GET /api/tasks - Fetch family tasks with completion AND skip status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const childId = searchParams.get('childId')

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { familyId: true, role: true, name: true },
    })

    if (!user?.familyId) {
      return NextResponse.json({ tasks: [] })
    }

    const targetUserId = childId || session.user.id

    // Get today's start time
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Fetch all family tasks
    const tasks = await prisma.task.findMany({
      where: {
        familyId: user.familyId,
        assignedToId: targetUserId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        completions: {
          where: {
            userId: targetUserId,  // ✅ FIXED: Check child's completions, not parent's
            completedAt: {
              gte: today,
            },
          },
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            completedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 🆕 NEW: Filter tasks by start/end dates
    const validTasks = tasks.filter(task => {
      // Check if task has started yet
      if (task.startDate) {
        const startDate = new Date(task.startDate)
        startDate.setHours(0, 0, 0, 0)
        if (today < startDate) {
          return false  // Task hasn't started yet
        }
      }

      // Check if recurring task has ended
      if (task.isRecurring && task.recurringEndDate) {
        const endDate = new Date(task.recurringEndDate)
        endDate.setHours(0, 0, 0, 0)
        if (today > endDate) {
          return false  // Recurring task has ended
        }
      }

      return true  // Task is active and within date range
    })

    // Fetch today's skips for the target user (child)
    const skips = await prisma.taskSkip.findMany({
      where: {
        userId: targetUserId,  // ✅ FIXED: Check child's skips, not parent's
        skippedAt: {
          gte: today,
        },
      },
      select: {
        taskId: true,
      },
    })

    const skippedTaskIds = new Set(skips.map(skip => skip.taskId))

    // 🆕 CHANGED: Use validTasks instead of tasks
    const processedTasks = validTasks.map(task => {
      const todayCompletion = task.completions[0]
      const isSkippedToday = skippedTaskIds.has(task.id)
      
      return {
        ...task,
        completedToday: !!todayCompletion,
        completedAt: todayCompletion?.completedAt || null,
        completedBy: todayCompletion?.user?.name || null,
        skippedToday: isSkippedToday,
      }
    })

    return NextResponse.json({ tasks: processedTasks })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

// POST /api/tasks - Create a new task
// NOW WITH AUTOMATIC NOTIFICATIONS! 🔔
// ✅ COMMIT 1 FIX: Added debug logging and proper timePeriod + recurringEndDate handling
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 POST /api/tasks - Starting request')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      console.log('❌ No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        familyId: true, 
        role: true,
        name: true,
      },
    })

    if (!user?.familyId) {
      console.log('❌ User not in family')
      return NextResponse.json(
        { error: 'You must be part of a family to create tasks' },
        { status: 400 }
      )
    }

    if (user.role !== 'PARENT') {
      console.log('❌ User is not a parent')
      return NextResponse.json(
        { error: 'Only parents can create tasks' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('📦 Request body received:', body)
    
    // 🔍 COMMIT 1 FIX: Debug logging for timePeriod
    console.log('⏰ RECEIVED TIME PERIOD:', body.timePeriod)
    console.log('⏰ TIME PERIOD TYPE:', typeof body.timePeriod)
    console.log('⏰ TIME PERIOD IS TRUTHY:', !!body.timePeriod)
    
    const { 
      title, 
      description, 
      points, 
      category, 
      assignedToId,
      isRecurring,
      daysOfWeek,
      timePeriod,           // ✅ COMMIT 1 FIX: Added this field
      startDate,
      recurringEndDate,     // ✅ COMMIT 1 FIX: Added this field
    } = body

    console.log('📝 Destructured timePeriod:', timePeriod)
    console.log('📝 Destructured recurringEndDate:', recurringEndDate)

    if (!title) {
      return NextResponse.json(
        { error: 'Task title is required' },
        { status: 400 }
      )
    }

    // 🔍 COMMIT 1 FIX: Log what we're about to save
    const taskData = {
      title,
      description: description || null,
      points: points || 10,
      category: category || null,
      assignedToId: assignedToId || null,
      createdById: session.user.id,
      familyId: user.familyId,
      isRecurring: isRecurring || false,
      daysOfWeek: daysOfWeek || null,
      timePeriod: timePeriod || 'ANYTIME',  // ✅ COMMIT 1 FIX: Now extracted from body
      startDate: startDate ? new Date(startDate) : new Date(),
      recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,  // ✅ COMMIT 1 FIX: Now extracted from body
    }

    console.log('💾 ABOUT TO SAVE TO DATABASE:', taskData)
    console.log('💾 SPECIFICALLY timePeriod:', taskData.timePeriod)
    console.log('💾 SPECIFICALLY startDate:', taskData.startDate)
    console.log('💾 SPECIFICALLY recurringEndDate:', taskData.recurringEndDate)

    // Create the task
    const task = await prisma.task.create({
      data: taskData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    console.log('✅ Task created successfully:', task.id)
    console.log('✅ SAVED TIMEPERIOD:', task.timePeriod)
    console.log('✅ SAVED STARTDATE:', task.startDate)
    console.log('✅ SAVED RECURRINGENDDATE:', task.recurringEndDate)

    // 🔔 NEW: Send notification if task is assigned to someone
    if (task.assignedToId && task.assignedTo) {
      try {
        await notifyTaskAssigned({
          assignedToId: task.assignedToId,
          assignedToName: task.assignedTo.name || 'there',
          taskTitle: task.title,
          taskId: task.id,
          assignerName: user.name || 'Someone',
        })
        console.log(`✅ Notification sent for task assignment: ${task.title}`)
      } catch (notifError) {
        // Don't fail the whole request if notification fails
        console.error('Failed to send notification:', notifError)
      }
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('💥 Error creating task:', error)
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }
}

/// UPDATE TO: src/app/api/tasks/route.ts
// Add this to your existing DELETE function (replace the entire DELETE export)

// DELETE /api/tasks - Delete a task and all related records
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('id')

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // Verify task exists and user owns it
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        createdById: true,
        points: true
      }
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    if (task.createdById !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this task' },
        { status: 403 }
      )
    }

    console.log('🗑️ Deleting task and all related records:', taskId)

    // Get all completions to deduct points
    const completions = await prisma.taskCompletion.findMany({
      where: { taskId: task.id },
      select: { userId: true }
    })

    // Delete related records first (foreign key constraints)
    await prisma.taskCompletion.deleteMany({
      where: { taskId: task.id }
    })
    console.log('✓ Deleted task completions')

    await prisma.taskSkip.deleteMany({
      where: { taskId: task.id }
    })
    console.log('✓ Deleted task skips')

    await prisma.notification.deleteMany({
      where: { 
        OR: [
          { message: { contains: taskId } },
          { title: { contains: task.id } }
        ]
      }
    })
    console.log('✓ Deleted related notifications')

    // Delete the task itself
    await prisma.task.delete({
      where: { id: taskId }
    })
    console.log('✓ Deleted task')

    // Deduct points from users who completed this task
    const userPointsToDeduct = completions.reduce((acc, completion) => {
      acc[completion.userId] = (acc[completion.userId] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    for (const [userId, count] of Object.entries(userPointsToDeduct)) {
      const pointsToDeduct = count * task.points
      await prisma.userPoints.update({
        where: { userId },
        data: {
          currentPoints: { decrement: pointsToDeduct },
          totalEarned: { decrement: pointsToDeduct }
        }
      })
      console.log(`✓ Deducted ${pointsToDeduct} points from user ${userId}`)
    }

    console.log('✅ Task deleted successfully:', taskId)

    return NextResponse.json({ 
      message: 'Task and all related data deleted successfully',
      pointsDeducted: Object.values(userPointsToDeduct).reduce((sum, count) => sum + (count * task.points), 0)
    })
  } catch (error) {
    console.error('💥 Error deleting task:', error)
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}

// PATCH /api/tasks - Update a task
// ✅ COMMIT 1 FIX: Added debug logging and proper timePeriod + recurringEndDate handling
export async function PATCH(request: NextRequest) {
  try {
    console.log('🔄 PATCH /api/tasks - Starting update request')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    })

    const body = await request.json()
    console.log('📦 Update request body:', body)
    console.log('⏰ RECEIVED TIME PERIOD:', body.timePeriod)
    
    const { 
      taskId, 
      title, 
      description, 
      points, 
      category,
      assignedToId,
      isRecurring,
      daysOfWeek,
      timePeriod,           // ✅ COMMIT 1 FIX: Added this field
      startDate,
      recurringEndDate,     // ✅ COMMIT 1 FIX: Added this field
    } = body

    console.log('📝 Destructured timePeriod:', timePeriod)
    console.log('📝 Destructured recurringEndDate:', recurringEndDate)

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // Verify user owns this task
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    })

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    if (existingTask.createdById !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this task' },
        { status: 403 }
      )
    }

    // Check if assignment is changing
    const assignmentChanged = assignedToId !== existingTask.assignedToId

    // Update the task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: title || existingTask.title,
        description: description !== undefined ? description : existingTask.description,
        points: points !== undefined ? points : existingTask.points,
        category: category !== undefined ? category : existingTask.category,
        assignedToId: assignedToId !== undefined ? assignedToId : existingTask.assignedToId,
        isRecurring: isRecurring !== undefined ? isRecurring : existingTask.isRecurring,
        daysOfWeek: daysOfWeek !== undefined ? daysOfWeek : existingTask.daysOfWeek,
        timePeriod: timePeriod !== undefined ? timePeriod : existingTask.timePeriod,  // ✅ COMMIT 1 FIX: Now properly handled
        startDate: startDate !== undefined ? new Date(startDate) : existingTask.startDate,
        recurringEndDate: recurringEndDate !== undefined ? (recurringEndDate ? new Date(recurringEndDate) : null) : existingTask.recurringEndDate,  // ✅ COMMIT 1 FIX: Now properly handled
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    console.log('✅ Task updated successfully:', updatedTask.id)
    console.log('✅ UPDATED TIMEPERIOD:', updatedTask.timePeriod)
    console.log('✅ UPDATED RECURRINGENDDATE:', updatedTask.recurringEndDate)

    // 🔔 NEW: Send notification if task assignment changed
    if (assignmentChanged && updatedTask.assignedToId && updatedTask.assignedTo) {
      try {
        await notifyTaskAssigned({
          assignedToId: updatedTask.assignedToId,
          assignedToName: updatedTask.assignedTo.name || 'there',
          taskTitle: updatedTask.title,
          taskId: updatedTask.id,
          assignerName: user?.name || 'Someone',
        })
        console.log(`✅ Notification sent for task re-assignment: ${updatedTask.title}`)
      } catch (notifError) {
        console.error('Failed to send notification:', notifError)
      }
    }

    return NextResponse.json({ task: updatedTask })
  } catch (error) {
    console.error('💥 Error updating task:', error)
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}