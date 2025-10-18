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

// POST - Log habit progress
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { habitId, amount, notes } = await request.json()

    // Get the habit and verify access
    const habit = await prisma.habit.findUnique({
      where: { id: habitId },
      include: {
        assignedTo: true,
        family: true
      }
    })

    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { userPoints: true }
    })

    if (!user || user.familyId !== habit.familyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get today's date (just the date, no time)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if there's already a log for today
    const existingLog = await prisma.habitLog.findUnique({
      where: {
        habitId_userId_logDate: {
          habitId: habit.id,
          userId: user.id,
          logDate: today
        }
      }
    })

    let habitLog
    let totalAmount

    if (existingLog) {
      // Update existing log (add to current amount)
      totalAmount = existingLog.amount + parseInt(amount)
      habitLog = await prisma.habitLog.update({
        where: { id: existingLog.id },
        data: {
          amount: totalAmount,
          notes: notes || existingLog.notes
        }
      })
    } else {
      // Create new log
      totalAmount = parseInt(amount)
      habitLog = await prisma.habitLog.create({
        data: {
          habitId: habit.id,
          userId: user.id,
          amount: totalAmount,
          logDate: today,
          notes
        }
      })
    }

    // Check if goal is met and award points
    let pointsEarned = 0
    let goalMet = false
    
    if (totalAmount >= habit.goalAmount && habit.pointsPerGoal) {
      goalMet = true
      
      // Only award points if this is the first time meeting the goal today
      if (!existingLog || existingLog.amount < habit.goalAmount) {
        pointsEarned = habit.pointsPerGoal
        
        // Update user points
        if (user.userPoints) {
          await prisma.userPoints.update({
            where: { userId: user.id },
            data: {
              currentPoints: user.userPoints.currentPoints + pointsEarned,
              totalEarned: user.userPoints.totalEarned + pointsEarned
            }
          })
        } else {
          await prisma.userPoints.create({
            data: {
              userId: user.id,
              currentPoints: pointsEarned,
              totalEarned: pointsEarned
            }
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      habitLog,
      totalAmount,
      goalAmount: habit.goalAmount,
      goalMet,
      pointsEarned,
      message: goalMet 
        ? `Great job! Goal completed! ${pointsEarned > 0 ? `+${pointsEarned} points!` : ''}`
        : `Progress logged: ${totalAmount}/${habit.goalAmount} ${habit.measurementUnit || ''}`
    })

  } catch (error) {
    console.error('Habit log error:', error)
    return NextResponse.json({ error: 'Failed to log habit' }, { status: 500 })
  }
}