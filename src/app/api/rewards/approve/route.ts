// src/app/api/rewards/approve/route.ts
// MINIMAL VERSION: Works with your exact current schema

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyRewardApproved, notifyRewardDenied } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        role: true,
        name: true,
      },
    })

    if (user?.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can approve/deny rewards' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { redemptionId, approved } = body

    if (!redemptionId || approved === undefined) {
      return NextResponse.json(
        { error: 'Redemption ID and approval status are required' },
        { status: 400 }
      )
    }

    // Fetch the redemption
    const redemption = await prisma.rewardRedemption.findUnique({
      where: { id: redemptionId },
      include: {
        reward: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!redemption) {
      return NextResponse.json(
        { error: 'Redemption not found' },
        { status: 404 }
      )
    }

    // Check if already approved (has approvedById set)
    if (redemption.approvedById) {
      return NextResponse.json(
        { error: 'Redemption has already been processed' },
        { status: 400 }
      )
    }

    // Update redemption - only update approvedById (we know this field exists)
    const updatedRedemption = await prisma.rewardRedemption.update({
      where: { id: redemptionId },
      data: {
        approvedById: session.user.id,
      },
    })

    // If denied, refund the points
    if (!approved) {
      await prisma.userPoints.update({
        where: { userId: redemption.userId },
        data: {
          currentPoints: {
            increment: redemption.reward.pointsRequired,
          },
        },
      })
    }

    // 🔔 Send notification to the child
    try {
      if (approved) {
        await notifyRewardApproved({
          childId: redemption.userId,
          rewardTitle: redemption.reward.title,
          approverName: user?.name || 'A parent',
        })
        console.log(`✅ Child notified of reward approval: ${redemption.reward.title}`)
      } else {
        await notifyRewardDenied({
          childId: redemption.userId,
          rewardTitle: redemption.reward.title,
          approverName: user?.name || 'A parent',
        })
        console.log(`✅ Child notified of reward denial: ${redemption.reward.title}`)
      }
    } catch (notifError) {
      // Don't fail the whole request if notification fails
      console.error('Failed to send reward notification:', notifError)
    }

    return NextResponse.json({
      redemption: updatedRedemption,
      message: approved 
        ? 'Reward approved successfully!' 
        : 'Reward denied and points refunded',
    })
  } catch (error) {
    console.error('Error processing reward approval:', error)
    return NextResponse.json(
      { error: 'Failed to process reward approval' },
      { status: 500 }
    )
  }
}