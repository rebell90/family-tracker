// src/app/api/user/points/route.ts
// UPDATED: Added userId query param support + tasksCompletedToday + streak

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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 🆕 NEW: Get userId from query params (for parent viewing child stats)
    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')

    // 🆕 NEW: Determine whose stats to fetch
    let targetUserId = session.user.id

    // If requesting another user's stats, verify permission
    if (requestedUserId && requestedUserId !== session.user.id) {
      // Get current user to check role and family
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { familyId: true, role: true },
      })

      // Only parents can view other users' stats
      if (currentUser?.role === 'PARENT') {
        const targetUser = await prisma.user.findUnique({
          where: { id: requestedUserId },
          select: { familyId: true },
        })
        
        // Verify target user is in same family
        if (targetUser?.familyId === currentUser.familyId) {
          targetUserId = requestedUserId
        }
      }
    }

    // Fetch user points
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId: targetUserId }
    })

    // 🆕 NEW: Calculate tasks completed today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const tasksCompletedToday = await prisma.taskCompletion.count({
      where: {
        userId: targetUserId,
        completedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    // 🆕 NEW: Calculate streak
    const streak = await calculateStreak(targetUserId)

    return NextResponse.json({
      currentPoints: userPoints?.currentPoints || 0,
      totalEarned: userPoints?.totalEarned || 0,
      tasksCompletedToday, // 🆕 NEW
      streak, // 🆕 NEW
    })

  } catch (error) {
    console.error('Error fetching points:', error)
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 })
  }
}

// 🆕 NEW: Helper function to calculate streak
async function calculateStreak(userId: string): Promise<number> {
  try {
    const completions = await prisma.taskCompletion.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    })

    if (completions.length === 0) return 0

    let streak = 0
    let currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    // Check if there's a completion today
    const todayStr = currentDate.toDateString()
    const hasCompletionToday = completions.some(c => 
      new Date(c.completedAt).toDateString() === todayStr
    )

    // If no completion today, start checking from yesterday
    if (!hasCompletionToday) {
      currentDate.setDate(currentDate.getDate() - 1)
    }

    // Count consecutive days with completions
    for (let i = 0; i < 365; i++) { // Max 365 day streak
      const dateStr = currentDate.toDateString()
      const hasCompletion = completions.some(c => 
        new Date(c.completedAt).toDateString() === dateStr
      )

      if (hasCompletion) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  } catch (error) {
    console.error('Error calculating streak:', error)
    return 0
  }
}