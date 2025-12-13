// src/app/api/rewards/redeem/route.ts
// WITH NOTIFICATIONS ADDED - Notifies parents when child requests a reward

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyRewardRequested, notifyParentsOfRewardRequest } from '@/lib/notifications'

interface AuthSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    familyId?: string | null;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎁 POST /api/rewards/redeem - Starting reward redemption')
    
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user || !('id' in session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rewardId } = await request.json()
    console.log('📦 Redeeming reward:', rewardId)

    // Get reward and user info
    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
      include: { family: true }
    })

    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      include: { userPoints: true }
    })

    if (!user || user.familyId !== reward.familyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    console.log('👤 User:', user.name, 'Points:', user.userPoints?.currentPoints)

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
    console.log('✅ Redemption created:', redemption.id)

    // Deduct points immediately
    await prisma.userPoints.update({
      where: { userId: user.id },
      data: {
        currentPoints: currentPoints - reward.pointsRequired
      }
    })
    console.log(`💰 Deducted ${reward.pointsRequired} points from ${user.name}`)

    // 🔔 Notify child that request was submitted
    try {
      await notifyRewardRequested({
        childId: user.id,
        rewardTitle: reward.title,
        points: reward.pointsRequired
      })
      console.log(`✅ Child notified of reward request: ${reward.title}`)
    } catch (notifError) {
      console.error('Failed to send child notification:', notifError)
    }

    // 🔔 Notify parents that child requested a reward
    try {
      await notifyParentsOfRewardRequest({
        familyId: user.familyId!,
        childName: user.name || 'A child',
        rewardTitle: reward.title,
        points: reward.pointsRequired
      })
      console.log(`✅ Parents notified of reward request from ${user.name}`)
    } catch (notifError) {
      console.error('Failed to send parent notification:', notifError)
    }

    return NextResponse.json({
      success: true,
      redemption,
      message: `${reward.title} requested! Points deducted. Waiting for parent approval.`,
      newPointsTotal: currentPoints - reward.pointsRequired
    })

  } catch (error) {
    console.error('💥 Redemption error:', error)
    return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 })
  }
}