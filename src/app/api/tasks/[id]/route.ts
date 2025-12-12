import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AuthSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    familyId?: string | null;
  }
}

// PUT - Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🔄 PUT /api/tasks/[id] - Starting request for task:', id)
    
    const session = await getServerSession(authOptions) as AuthSession | null
    console.log('Session:', session?.user?.id, session?.user?.role)
    
    if (!session?.user?.id) {
      console.log('❌ No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    console.log('User found:', user?.id, 'Role:', user?.role)

    if (user?.role !== 'PARENT') {
      console.log('❌ User is not a parent')
      return NextResponse.json({ error: 'Only parents can edit tasks' }, { status: 403 })
    }

    const body = await request.json()
    console.log('📦 Update request body:', body)
    
    // 🔍 COMMIT 1 FIX: Debug logging for timePeriod
    console.log('⏰ RECEIVED TIME PERIOD:', body.timePeriod)
    console.log('⏰ TIME PERIOD TYPE:', typeof body.timePeriod)

    const { title, description, points, category, assignedToId, isRecurring, daysOfWeek, timePeriod, isActive, recurringEndDate, startDate } = body

    console.log('📝 Destructured timePeriod:', timePeriod)
    console.log('📝 Destructured recurringEndDate:', recurringEndDate)
    console.log('📝 Destructured startDate:', startDate)

    let endDate = null
    if (isRecurring && recurringEndDate) {
      endDate = new Date(recurringEndDate)
      
      if (endDate <= new Date()) {
        return NextResponse.json({ 
          error: 'End date must be in the future' 
        }, { status: 400 })
      }
    }

    // Check if task exists and belongs to user's family
    const existingTask = await prisma.task.findUnique({
      where: { id: id },
      include: { family: true }
    })

    if (!existingTask) {
      console.log('❌ Task not found:', id)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    console.log('Existing task found, updating...')
    console.log('💾 ABOUT TO UPDATE WITH timePeriod:', timePeriod || 'ANYTIME')
    console.log('💾 ABOUT TO UPDATE WITH recurringEndDate:', endDate)
    console.log('💾 ABOUT TO UPDATE WITH startDate:', startDate ? new Date(startDate) : undefined)

    const task = await prisma.task.update({
      where: { id: id },
      data: {
        title,
        description,
        points: parseInt(points) || 1,
        category: category || 'CHORES',
        assignedToId: assignedToId || null,
        isRecurring: isRecurring || false,
        daysOfWeek: daysOfWeek || [],
        timePeriod: timePeriod || 'ANYTIME',
        isActive: isActive !== undefined ? isActive : true,
        recurringEndDate: endDate,
        startDate: startDate ? new Date(startDate) : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, role: true }
        },
        createdBy: {
          select: { id: true, name: true }
        }
      }
    })

    console.log('✅ Task updated successfully:', task.id)
    console.log('✅ UPDATED TIMEPERIOD:', task.timePeriod)
    console.log('✅ UPDATED RECURRINGENDDATE:', task.recurringEndDate)
    console.log('✅ UPDATED STARTDATE:', task.startDate)
    
    return NextResponse.json({ task })
  } catch (error) {
    console.error('💥 Error in PUT /api/tasks/[id]:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// DELETE - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🗑️ DELETE /api/tasks/[id] - Starting request for task:', id)
    
    const session = await getServerSession(authOptions) as AuthSession | null
    console.log('Session:', session?.user?.id, session?.user?.role)
    
    if (!session?.user?.id) {
      console.log('❌ No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    console.log('User found:', user?.id, 'Role:', user?.role)

    if (user?.role !== 'PARENT') {
      console.log('❌ User is not a parent')
      return NextResponse.json({ error: 'Only parents can delete tasks' }, { status: 403 })
    }

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id: id }
    })

    if (!existingTask) {
      console.log('❌ Task not found:', id)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    console.log('Task found, soft deleting...')

    // Soft delete by setting isActive to false
    await prisma.task.update({
      where: { id: id },
      data: { isActive: false }
    })

    console.log('✅ Task soft deleted successfully')
    return NextResponse.json({ message: 'Task deleted successfully' })
  } catch (error) {
    console.error('💥 Error in DELETE /api/tasks/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}