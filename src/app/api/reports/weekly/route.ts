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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user?.familyId) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    // Get date ranges
    const now = new Date()
    const startOfThisWeek = new Date(now)
    startOfThisWeek.setDate(now.getDate() - now.getDay()) // Sunday
    startOfThisWeek.setHours(0, 0, 0, 0)

    const endOfThisWeek = new Date(startOfThisWeek)
    endOfThisWeek.setDate(startOfThisWeek.getDate() + 7)

    const startOfLastWeek = new Date(startOfThisWeek)
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7)

    const endOfLastWeek = new Date(startOfThisWeek)

    // Get all family members
    const familyMembers = await prisma.user.findMany({
      where: { 
        familyId: user.familyId,
        role: 'CHILD' // Only get children for reports
      },
      include: {
        userPoints: true
      }
    })

    // Get this week's completions
    const thisWeekCompletions = await prisma.taskCompletion.findMany({
      where: {
        completedAt: {
          gte: startOfThisWeek,
          lt: endOfThisWeek
        },
        user: {
          familyId: user.familyId
        }
      },
      include: {
        task: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Get last week's completions
    const lastWeekCompletions = await prisma.taskCompletion.findMany({
      where: {
        completedAt: {
          gte: startOfLastWeek,
          lt: endOfLastWeek
        },
        user: {
          familyId: user.familyId
        }
      },
      include: {
        task: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Get this week's reward redemptions
    const thisWeekRedemptions = await prisma.rewardRedemption.findMany({
      where: {
        redeemedAt: {
          gte: startOfThisWeek,
          lt: endOfThisWeek
        },
        user: {
          familyId: user.familyId
        }
      },
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

    // Calculate stats per child
    const childrenStats = familyMembers.map(child => {
      const childThisWeekCompletions = thisWeekCompletions.filter(c => c.userId === child.id)
      const childLastWeekCompletions = lastWeekCompletions.filter(c => c.userId === child.id)
      const childRedemptions = thisWeekRedemptions.filter(r => r.userId === child.id)

      const thisWeekPoints = childThisWeekCompletions.reduce((sum, c) => sum + c.task.points, 0)
      const lastWeekPoints = childLastWeekCompletions.reduce((sum, c) => sum + c.task.points, 0)

      return {
        id: child.id,
        name: child.name,
        currentPoints: child.userPoints?.currentPoints || 0,
        totalEarned: child.userPoints?.totalEarned || 0,
        thisWeek: {
          tasksCompleted: childThisWeekCompletions.length,
          pointsEarned: thisWeekPoints,
          rewardsRedeemed: childRedemptions.length
        },
        lastWeek: {
          tasksCompleted: childLastWeekCompletions.length,
          pointsEarned: lastWeekPoints
        },
        improvement: {
          tasks: childThisWeekCompletions.length - childLastWeekCompletions.length,
          points: thisWeekPoints - lastWeekPoints
        }
      }
    })

    // Get task performance (which tasks are completed most/least)
    const taskPerformance = await prisma.task.findMany({
      where: {
        familyId: user.familyId,
        isActive: true
      },
      include: {
        completions: {
          where: {
            completedAt: {
              gte: startOfThisWeek,
              lt: endOfThisWeek
            }
          }
        },
        assignedTo: {
          select: {
            name: true
          }
        }
      }
    })

    const taskStats = taskPerformance.map(task => ({
      id: task.id,
      title: task.title,
      assignedTo: task.assignedTo?.name || 'Anyone',
      category: task.category,
      points: task.points,
      completionsThisWeek: task.completions.length,
      isRecurring: task.isRecurring
    })).sort((a, b) => b.completionsThisWeek - a.completionsThisWeek)

    // Family totals
    const familyTotals = {
      thisWeek: {
        tasksCompleted: thisWeekCompletions.length,
        pointsEarned: thisWeekCompletions.reduce((sum, c) => sum + c.task.points, 0),
        rewardsRedeemed: thisWeekRedemptions.length
      },
      lastWeek: {
        tasksCompleted: lastWeekCompletions.length,
        pointsEarned: lastWeekCompletions.reduce((sum, c) => sum + c.task.points, 0)
      }
    }

    // Daily breakdown for chart
    const dailyBreakdown = []
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startOfThisWeek)
      dayStart.setDate(startOfThisWeek.getDate() + i)
      dayStart.setHours(0, 0, 0, 0)
      
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      const dayCompletions = thisWeekCompletions.filter(c => {
        const completedDate = new Date(c.completedAt)
        return completedDate >= dayStart && completedDate <= dayEnd
      })

      dailyBreakdown.push({
        date: dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        tasks: dayCompletions.length,
        points: dayCompletions.reduce((sum, c) => sum + c.task.points, 0)
      })
    }

    return NextResponse.json({
      familyTotals,
      childrenStats,
      taskStats,
      dailyBreakdown,
      weekRange: {
        start: startOfThisWeek.toISOString(),
        end: endOfThisWeek.toISOString()
      }
    })

  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}