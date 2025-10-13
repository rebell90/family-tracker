import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AuthSession {
  user: {
    id: string
    role?: string
    familyId?: string
  }
}

// IMPORTANT: Must use async function with params as second argument
export async function DELETE(
  request: NextRequest,
  context: { params: { completionId: string } }
) {
  const { completionId } = context.params
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { completionId } = params

    // Get the completion with task and user info
    const completion = await prisma.taskCompletion.findUnique({
      where: { id: completionId },
      include: {
        task: true,
        user: {
          include: {
            userPoints: true
          }
        }
      }
    })

    if (!completion) {
      return NextResponse.json({ error: 'Completion not found' }, { status: 404 })
    }

    // Verify user has permission (must be parent or the user who completed it)
    const isParent = session.user.role === 'PARENT'
    const isOwnCompletion = completion.userId === session.user.id
    
    if (!isParent && !isOwnCompletion) {
      return NextResponse.json({ 
        error: 'Only parents can delete other users\' completions' 
      }, { status: 403 })
    }

    // Verify family access
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (currentUser?.familyId !== completion.task.familyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete the completion
    await prisma.taskCompletion.delete({
      where: { id: completionId }
    })

    // Refund points
    if (completion.user.userPoints) {
      await prisma.userPoints.update({
        where: { userId: completion.userId },
        data: {
          currentPoints: Math.max(0, completion.user.userPoints.currentPoints - completion.task.points),
          totalEarned: Math.max(0, completion.user.userPoints.totalEarned - completion.task.points)
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Completion deleted. ${completion.task.points} points refunded from ${completion.user.name || 'user'}.`,
      pointsRefunded: completion.task.points,
      taskTitle: completion.task.title
    })

  } catch (error) {
    console.error('Delete completion error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete completion' 
    }, { status: 500 })
  }
}