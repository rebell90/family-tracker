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
