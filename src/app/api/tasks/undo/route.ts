import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !('id' in session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await request.json()

    // Get the task to verify it exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        points: true,
        assignedToId: true,  // ✅ ADDED: Get who the task is assigned to
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

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      select: { 
        id: true, 
        familyId: true, 
        role: true,
        userPoints: true 
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ✅ NEW: Check if parent is undoing for child
    const isParentUndoingForChild = 
      user.role === 'PARENT' && 
      task.assignedTo?.familyId === user.familyId

    // Check if user is the assigned user
    const isAssignedUser = user.id === task.assignedToId

    // Allow if either:
    // 1. User is the assigned user (child undoing their own task)
    // 2. User is parent in same family (parent undoing for child)
    if (!isAssignedUser && !isParentUndoingForChild) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ✅ CHANGED: Use task's assignedToId if it exists, otherwise use session user
    const targetUserId = task.assignedToId || user.id

    // Find today's completion for the ASSIGNED USER (not the parent!)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const completion = await prisma.taskCompletion.findFirst({
      where: {
        taskId: task.id,
        userId: targetUserId,  // ✅ FIXED: Use child's ID, not parent's ID
        completedAt: {
          gte: today
        }
      }
    })

    if (!completion) {
      return NextResponse.json({ error: 'No completion found for today' }, { status: 404 })
    }

    // Delete the completion
    await prisma.taskCompletion.delete({
      where: { id: completion.id }
    })

    // ✅ FIXED: Refund the points to the ASSIGNED USER (child), not the parent
    const targetUserPoints = await prisma.userPoints.findUnique({
      where: { userId: targetUserId }
    })

    if (targetUserPoints) {
      await prisma.userPoints.update({
        where: { userId: targetUserId },  // ✅ FIXED: Deduct from child's points
        data: {
          currentPoints: Math.max(0, targetUserPoints.currentPoints - task.points),
          totalEarned: Math.max(0, targetUserPoints.totalEarned - task.points)
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Task unmarked. ${task.points} points removed${isParentUndoingForChild ? ` from ${task.assignedTo?.name}` : ''}.`
    })

  } catch (error) {
    console.error('Task undo error:', error)
    return NextResponse.json({ error: 'Failed to undo task completion' }, { status: 500 })
  }
}