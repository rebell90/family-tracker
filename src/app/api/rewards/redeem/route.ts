import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rewardId } = await request.json()

    // Get reward and user info
    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
      include: { family: true }
    })

    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { userPoints: true }
    })

    if (!user || user.familyId !== reward.familyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if user has enough points
    const currentPoints = user.userPoints?.currentPoints || 0
    if (currentPoints < reward.pointsRequired) {
      return NextResponse.json({ 
        error: `Not enough points. You need ${reward.pointsRequired} but only have ${currentPoints}` 
      }, { status: 400 })
    }

    // Create redemption request
    const redemption = await prisma.rewardRedemption.create({
      data: {
        rewardId: reward.id,
        userId: user.id
      }
    })

    // Deduct points immediately (you could also do this after parent approval)
    await prisma.userPoints.update({
      where: { userId: user.id },
      data: {
        currentPoints: currentPoints - reward.pointsRequired
      }
    })

    return NextResponse.json({
      success: true,
      redemption,
      message: `${reward.title} requested! Points deducted. Waiting for parent approval.`,
      newPointsTotal: currentPoints - reward.pointsRequired
    })

  } catch (error) {
    console.error('Redemption error:', error)
    return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 })
  }
}
