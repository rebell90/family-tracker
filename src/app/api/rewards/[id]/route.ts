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

// PATCH - Update reward
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (user?.role !== 'PARENT') {
      return NextResponse.json({ error: 'Only parents can edit rewards' }, { status: 403 })
    }

    const { id } = await params
    const { title, description, pointsRequired } = await request.json()

    const reward = await prisma.reward.update({
      where: { 
        id: id,
        familyId: user.familyId || undefined
      },
      data: {
        title,
        description,
        pointsRequired: parseInt(pointsRequired)
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json({ reward })
  } catch (error) {
    console.error('Error updating reward:', error)
    return NextResponse.json({ error: 'Failed to update reward' }, { status: 500 })
  }
}

// DELETE - Delete reward
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (user?.role !== 'PARENT') {
      return NextResponse.json({ error: 'Only parents can delete rewards' }, { status: 403 })
    }

    const { id } = await params

    await prisma.reward.update({
      where: { 
        id: id,
        familyId: user.familyId || undefined
      },
      data: {
        isActive: false
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reward:', error)
    return NextResponse.json({ error: 'Failed to delete reward' }, { status: 500 })
  }
}