// src/app/api/rewards/approve/route.ts
// WITH NOTIFICATIONS ADDED

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyRewardApproved, notifyRewardDenied } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('🎁 POST /api/rewards/approve - Starting approval request')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('📦 Request body:', body)
    
    const { redemptionId, approved } = body

    if (!redemptionId || approved === undefined) {
      return NextResponse.json(
        { error: 'Redemption ID and approval status are required' },
        { status: 400 }
      )
    }

    // Verify user is a parent
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        role: true,
        id: true,
        name: true
      }
    })

    console.log('👤 User:', user?.name, 'Role:', user?.role)

    if (user?.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can approve redemptions' },
        { status: 403 }
      )
    }

    // Get the redemption details
    const redemption = await prisma.rewardRedemption.findUnique({
      where: { id: redemptionId },
      include: { 
        reward: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!redemption) {
      return NextResponse.json(
        { error: 'Redemption not found' },
        { status: 404 }
      )
    }

    console.log('📋 Redemption found:', {
      id: redemption.id,
      reward: redemption.reward.title,
      user: redemption.user.name,
      points: redemption.reward.pointsRequired
    })

    // Check if already processed
    if (redemption.approvedBy) {
      return NextResponse.json(
        { error: 'Redemption has already been processed' },
        { status: 400 }
      )
    }

    if (approved) {
      // ✅ APPROVE
      console.log('✅ Approving redemption...')
      
      await prisma.rewardRedemption.update({
        where: { id: redemptionId },
        data: {
          approved: true,
          approvedBy: user.id
        }
      })

      // 🔔 Notify child of approval
      try {
        await notifyRewardApproved({
          childId: redemption.userId,
          rewardTitle: redemption.reward.title,
          approverName: user.name || 'A parent'
        })
        console.log(`✅ Child notified of reward approval: ${redemption.reward.title}`)
      } catch (notifError) {
        console.error('Failed to send approval notification:', notifError)
      }

      console.log('✅ Redemption approved successfully!')
      return NextResponse.json({ 
        message: `${redemption.reward.title} approved for ${redemption.user.name}!` 
      })
      
    } else {
      // ❌ DENY
      console.log('❌ Denying redemption, refunding points...')
      
      // Refund the points
      await prisma.userPoints.update({
        where: { userId: redemption.userId },
        data: {
          currentPoints: {
            increment: redemption.reward.pointsRequired
          }
        }
      })
      console.log(`💰 Refunded ${redemption.reward.pointsRequired} points to ${redemption.user.name}`)

      // Mark as denied (approved=false, approvedBy set)
      await prisma.rewardRedemption.update({
        where: { id: redemptionId },
        data: {
          approved: false,
          approvedBy: user.id
        }
      })

      // 🔔 Notify child of denial
      try {
        await notifyRewardDenied({
          childId: redemption.userId,
          rewardTitle: redemption.reward.title,
          points: redemption.reward.pointsRequired,
          approverName: user.name || 'A parent'
        })
        console.log(`✅ Child notified of reward denial: ${redemption.reward.title}`)
      } catch (notifError) {
        console.error('Failed to send denial notification:', notifError)
      }

      console.log('🗑️ Redemption denied')
      return NextResponse.json({ 
        message: `Request denied. ${redemption.reward.pointsRequired} points refunded to ${redemption.user.name}.` 
      })
    }

  } catch (error) {
    console.error('💥 Error processing approval:', error)
    return NextResponse.json(
      { error: 'Failed to process approval' }, 
      { status: 500 }
    )
  }
}