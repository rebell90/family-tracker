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

    const { redemptionId, approve } = await request.json()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (user?.role !== 'PARENT') {
      return NextResponse.json({ error: 'Only parents can approve redemptions' }, { status: 403 })
    }

    if (approve) {
      // Approve the redemption
      await prisma.rewardRedemption.update({
        where: { id: redemptionId },
        data: {
          approved: true,
          approvedBy: user.id
        }
      })
      return NextResponse.json({ message: 'Redemption approved!' })
    } else {
      // Deny and refund points
      const redemption = await prisma.rewardRedemption.findUnique({
        where: { id: redemptionId },
        include: { reward: true, user: true }
      })

      if (redemption) {
        // Refund points
        await prisma.userPoints.update({
          where: { userId: redemption.userId },
          data: {
            currentPoints: {
              increment: redemption.reward.pointsRequired
            }
          }
        })

        // Delete the redemption
        await prisma.rewardRedemption.delete({
          where: { id: redemptionId }
        })
      }

      return NextResponse.json({ message: 'Redemption denied and points refunded' })
    }
  } catch (error) {
    console.error('Approval error:', error)
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 })
  }
}
