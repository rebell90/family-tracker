import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - List family rewards
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !('id' in session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      include: { family: true }
    })

    if (!user?.familyId) {
      return NextResponse.json({ rewards: [] })
    }

    const rewards = await prisma.reward.findMany({
      where: { 
        familyId: user.familyId,
        isActive: true 
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        },
        redemptions: {
          where: { approved: false },
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { pointsRequired: 'asc' }
    })

    return NextResponse.json({ rewards })
  } catch (error) {
    console.error('Error fetching rewards:', error)
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 })
  }
}

// POST - Create new reward (parents only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !('id' in session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id }
    })

    if (user?.role !== 'PARENT') {
      return NextResponse.json({ error: 'Only parents can create rewards' }, { status: 403 })
    }

    const { title, description, pointsRequired } = await request.json()

    if (!user.familyId) {
      return NextResponse.json({ error: 'No family found' }, { status: 400 })
    }

    const reward = await prisma.reward.create({
      data: {
        title,
        description,
        pointsRequired: parseInt(pointsRequired),
        createdById: user.id,
        familyId: user.familyId
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json({ reward }, { status: 201 })
  } catch (error) {
    console.error('Error creating reward:', error)
    return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 })
  }
}