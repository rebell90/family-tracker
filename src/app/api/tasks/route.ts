// src/app/api/tasks/route.ts
// Updated to automatically create notifications when tasks are assigned

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyTaskAssigned } from '@/lib/notifications'

// GET /api/tasks - Fetch family tasks
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { familyId: true, role: true },
    })

    if (!user?.familyId) {
      return NextResponse.json({ tasks: [] })
    }

    const tasks = await prisma.task.findMany({
      where: {
        familyId: user.familyId,
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

    return NextResponse.json({ tasks })
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
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
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
      return NextResponse.json(
        { error: 'You must be part of a family to create tasks' },
        { status: 400 }
      )
    }

    if (user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can create tasks' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      title, 
      description, 
      points, 
      category, 
      assignedToId,
      isRecurring,
      daysOfWeek,
    } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Task title is required' },
        { status: 400 }
      )
    }

    // Create the task
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        points: points || 10,
        category: category || null,
        assignedToId: assignedToId || null,
        createdById: session.user.id,
        familyId: user.familyId,
        isRecurring: isRecurring || false,
        daysOfWeek: daysOfWeek || null,
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
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }
}

// DELETE /api/tasks - Delete a task
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

    // Verify user owns this task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
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

    await prisma.task.delete({
      where: { id: taskId },
    })

    return NextResponse.json({ message: 'Task deleted successfully' })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}

// PATCH /api/tasks - Update a task
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    })

    const body = await request.json()
    const { 
      taskId, 
      title, 
      description, 
      points, 
      category,
      assignedToId,
      isRecurring,
      daysOfWeek,
    } = body

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
    console.error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}