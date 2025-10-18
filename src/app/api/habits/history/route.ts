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

// GET - Fetch habit history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const habitId = searchParams.get('habitId')
    const days = parseInt(searchParams.get('days') || '30')

    if (!habitId) {
      return NextResponse.json({ error: 'habitId required' }, { status: 400 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    const logs = await prisma.habitLog.findMany({
      where: {
        habitId,
        userId: session.user.id,
        logDate: {
          gte: startDate
        }
      },
      orderBy: {
        logDate: 'desc'
      },
      include: {
        habit: {
          select: {
            title: true,
            goalAmount: true,
            measurementUnit: true,
            measurementType: true
          }
        }
      }
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching habit history:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}