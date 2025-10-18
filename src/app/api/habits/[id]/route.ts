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

// PATCH - Update habit
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
      return NextResponse.json({ error: 'Only parents can edit habits' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const habit = await prisma.habit.update({
      where: { 
        id: id,
        familyId: user.familyId || undefined
      },
      data: {
        title: body.title,
        description: body.description,
        measurementType: body.measurementType,
        measurementUnit: body.measurementUnit,
        goalAmount: parseInt(body.goalAmount),
        assignedToId: body.assignedToId || null,
        frequency: body.frequency,
        daysOfWeek: body.daysOfWeek,
        pointsPerGoal: body.pointsPerGoal ? parseInt(body.pointsPerGoal) : null,
        icon: body.icon,
        color: body.color
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

    return NextResponse.json({ habit })
  } catch (error) {
    console.error('Error updating habit:', error)
    return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 })
  }
}

// DELETE - Delete habit (soft delete)
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
      return NextResponse.json({ error: 'Only parents can delete habits' }, { status: 403 })
    }

    const { id } = await params

    await prisma.habit.update({
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
    console.error('Error deleting habit:', error)
    return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 })
  }
}