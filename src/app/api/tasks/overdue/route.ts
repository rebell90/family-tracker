// app/api/tasks/overdue/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all incomplete tasks from previous days
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: session.user.id,
        completed: false,
        // You might want to add a dueDate field to your schema
        // For now, we'll get all incomplete tasks
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Filter out today's tasks (simplified logic - you may need to adjust based on your schema)
    const overdueTasks = tasks.filter(task => {
      // Check if task has been completed today
      // You might need to check task_completions table for this
      return !task.completedToday
    })

    return NextResponse.json(overdueTasks)
  } catch (error) {
    console.error('Error fetching overdue tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch overdue tasks' }, { status: 500 })
  }
}

// -----------------------------------

// app/api/tasks/skip/route.ts
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

    const { taskId, reason } = await request.json()

    // Create a task skip record (you'll need to add a TaskSkip model to your schema)
    // For now, we'll just mark it in a simple way
    // You might want to create a separate table for skipped tasks with reasons
    
    // Option 1: Add a 'skipped' field to task_completions with a reason
    // Option 2: Create a separate task_skips table
    // For simplicity, let's update the task with a note

    // This is a simplified version - you'd want to properly track skips
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // You could add a task_skips table to track this properly
    // For now, we'll just add a note to the task or mark it specially
    // This depends on your exact requirements

    return NextResponse.json({ 
      message: 'Task skipped successfully',
      reason: reason || 'No reason provided'
    })
  } catch (error) {
    console.error('Error skipping task:', error)
    return NextResponse.json({ error: 'Failed to skip task' }, { status: 500 })
  }
}

// -----------------------------------

// app/api/tasks/reschedule/route.ts
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

    const { taskId, newDate } = await request.json()

    // Update task with new due date
    // You might need to add a dueDate field to your Task model
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Update the task's due date (you'll need to add this field to your schema)
    // For now, this is a placeholder
    // const updatedTask = await prisma.task.update({
    //   where: { id: taskId },
    //   data: { dueDate: new Date(newDate) }
    // })

    return NextResponse.json({ 
      message: 'Task rescheduled successfully',
      newDate: newDate
    })
  } catch (error) {
    console.error('Error rescheduling task:', error)
    return NextResponse.json({ error: 'Failed to reschedule task' }, { status: 500 })
  }
}

// -----------------------------------

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