import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const redemptions = await prisma.rewardRedemption.findMany({
      where: { userId: session.user.id },
      include: {
        reward: {
          select: {
            id: true,
            title: true,
            description: true,
            pointsRequired: true
          }
        }
      },
      orderBy: { redeemedAt: 'desc' }
    })

    return NextResponse.json({ redemptions })
  } catch (error) {
    console.error('Error fetching redemptions:', error)
    return NextResponse.json({ error: 'Failed to fetch redemptions' }, { status: 500 })
  }
}
