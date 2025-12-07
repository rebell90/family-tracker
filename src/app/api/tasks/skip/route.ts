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

    const { taskId, reason, skippedAt } = await request.json()

    // Verify task exists and get assignedToId
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        assignedToId: true,
        assignedTo: {
          select: {
            familyId: true,
            name: true
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { familyId: true, role: true }
    })

    // Check permissions
    const isParentSkippingForChild = 
      user?.role === 'PARENT' && 
      task.assignedTo?.familyId === user.familyId

    const isAssignedUser = session.user.id === task.assignedToId

    if (!isAssignedUser && !isParentSkippingForChild) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // ✅ FIXED: Use task's assignedToId (child), not parent's ID
    const targetUserId = task.assignedToId || session.user.id

    // Create a task skip record with the specific date
    await prisma.taskSkip.create({
      data: {
        taskId,
        userId: targetUserId,  // ✅ FIXED: Was session.user.id
        skippedAt: skippedAt ? new Date(skippedAt) : new Date(),
        reason: reason || null
      }
    })

    return NextResponse.json({ 
      message: 'Task marked as skipped',
      reason: reason || 'No reason provided'
    })
  } catch (error) {
    console.error('Error skipping task:', error)
    return NextResponse.json({ error: 'Failed to skip task' }, { status: 500 })
  }
}