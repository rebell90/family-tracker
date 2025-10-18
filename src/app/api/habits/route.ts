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

// GET - Fetch all habits for the family
export async function GET() {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user?.familyId) {
      return NextResponse.json({ habits: [] })
    }

    const habits = await prisma.habit.findMany({
      where: {
        familyId: user.familyId,
        isActive: true
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, role: true }
        },
        createdBy: {
          select: { id: true, name: true }
        },
        logs: {
          where: {
            logDate: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)) // Today's logs
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ habits })
  } catch (error) {
    console.error('Error fetching habits:', error)
    return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 })
  }
}

// POST - Create a new habit
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (user?.role !== 'PARENT') {
      return NextResponse.json({ error: 'Only parents can create habits' }, { status: 403 })
    }

    if (!user.familyId) {
      return NextResponse.json({ error: 'No family found' }, { status: 400 })
    }

    const body = await request.json()
    const { 
      title, 
      description, 
      measurementType, 
      measurementUnit,
      goalAmount,
      assignedToId, 
      frequency, 
      daysOfWeek,
      pointsPerGoal,
      icon,
      color
    } = body

    const habit = await prisma.habit.create({
      data: {
        title,
        description,
        measurementType,
        measurementUnit,
        goalAmount: parseInt(goalAmount),
        assignedToId: assignedToId || null,
        createdById: user.id,
        familyId: user.familyId,
        frequency: frequency || 'DAILY',
        daysOfWeek: daysOfWeek || [],
        pointsPerGoal: pointsPerGoal ? parseInt(pointsPerGoal) : null,
        icon,
        color
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

    return NextResponse.json({ habit }, { status: 201 })
  } catch (error) {
    console.error('Error creating habit:', error)
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 })
  }
}