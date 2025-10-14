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
          // UPDATED: Get ALL redemptions to check if one-time rewards were claimed
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { pointsRequired: 'asc' }
    })

    // ⭐ NEW: Filter out one-time rewards that the current user has already redeemed
    const availableRewards = rewards.filter(reward => {
      // If it's reusable, always show it
      if (reward.isReusable) return true
      
      // If it's one-time, only show if the current user hasn't redeemed it yet
      const hasUserRedeemed = reward.redemptions.some(
        redemption => redemption.userId === user.id
      )
      
      return !hasUserRedeemed
    })

    // NEW: For each reward, add info about pending redemptions (for parent view)
    const rewardsWithPendingInfo = availableRewards.map(reward => ({
      ...reward,
      pendingRedemptions: reward.redemptions.filter(r => !r.approved)
    }))

    return NextResponse.json({ rewards: rewardsWithPendingInfo })
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

    // UPDATED: Extract isReusable from request body
    const { 
      title, 
      description, 
      pointsRequired,
      isReusable = true  
    } = await request.json()

    if (!user.familyId) {
      return NextResponse.json({ error: 'No family found' }, { status: 400 })
    }

    const reward = await prisma.reward.create({
      data: {
        title,
        description,
        pointsRequired: parseInt(pointsRequired),
        isReusable,
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