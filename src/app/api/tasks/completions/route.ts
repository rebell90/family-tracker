// src/app/api/tasks/completions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AuthSession {
  user: {
    id: string
    role?: string
    familyId?: string
  }
}

// GET handler for fetching all task completions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user to verify family
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || !user.familyId) {
      return NextResponse.json({ 
        error: 'User not in a family' 
      }, { status: 400 })
    }

    // Only parents can view all completions
    if (session.user.role !== 'PARENT') {
      return NextResponse.json({ 
        error: 'Only parents can view all completions' 
      }, { status: 403 })
    }

    // Get all completions for tasks in this family
    const completions = await prisma.taskCompletion.findMany({
      where: {
        task: {
          familyId: user.familyId
        }
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            points: true,
            category: true
          }
        },
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    })

    return NextResponse.json({ 
      completions,
      count: completions.length
    })

  } catch (error) {
    console.error('Fetch completions error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch completions' 
    }, { status: 500 })
  }
}