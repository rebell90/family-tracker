// Fixed version of /api/tasks/route.ts
// This properly checks BOTH completions AND skips when determining task status

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

// GET - List all tasks for the family
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/tasks - Starting request')
    
    const session = await getServerSession(authOptions) as AuthSession | null
    console.log('Session:', session?.user?.id, session?.user?.role)
    
    if (!session?.user?.id) {
      console.log('No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { family: true }
    })

    console.log('User found:', user?.id, 'Family:', user?.familyId)

    if (!user?.familyId) {
      console.log('No family ID, returning empty tasks')
      return NextResponse.json({ tasks: [] })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tasks = await prisma.task.findMany({
      where: { 
        familyId: user.familyId,
        isActive: true 
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, role: true }
        },
        createdBy: {
          select: { id: true, name: true }
        },
        completions: {
          where: {
            completedAt: {
              gte: today // Today's completions
            }
          },
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        // 🔥 THIS IS THE KEY FIX: Also include skips!
        skips: {
          where: {
            skippedAt: {
              gte: today // Today's skips
            }
          },
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform tasks to include BOTH completion AND skip status
    const tasksWithStatus = tasks.map(task => {
      // Check if this specific user (or assigned user if viewing from parent) completed it
      const userCompletions = task.completions.filter(c => {
        // If parent is viewing, check if the assigned user completed it
        if (user.role === 'PARENT' && task.assignedToId) {
          return c.userId === task.assignedToId
        }
        // If child is viewing their own tasks
        return c.userId === user.id
      })

      // 🔥 Check if this specific user (or assigned user if viewing from parent) skipped it
      const userSkips = task.skips.filter(s => {
        // If parent is viewing, check if the assigned user skipped it
        if (user.role === 'PARENT' && task.assignedToId) {
          return s.userId === task.assignedToId
        }
        // If child is viewing their own tasks
        return s.userId === user.id
      })

      const completedToday = userCompletions.length > 0
      const skippedToday = userSkips.length > 0
      
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        points: task.points,
        category: task.category,
        assignedTo: task.assignedTo,
        createdBy: task.createdBy,
        completed: completedToday, // For backwards compatibility
        completedToday: completedToday,
        skippedToday: skippedToday, // 🔥 NEW: Add skip status
        isRecurring: task.isRecurring,
        daysOfWeek: task.daysOfWeek,
        timePeriod: task.timePeriod
      }
    })

    console.log('Found tasks:', tasksWithStatus.length)
    return NextResponse.json({ tasks: tasksWithStatus })
  } catch (error) {
    console.error('Error in GET /api/tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST - Create a new task
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/tasks - Starting request')
    
    const session = await getServerSession(authOptions) as AuthSession | null
    console.log('Session:', session?.user?.id, session?.user?.role)
    
    if (!session?.user?.id) {
      console.log('No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { family: true }
    })

    console.log('User found:', user?.id, 'Role:', user?.role)

    if (user?.role !== 'PARENT') {
      console.log('User is not a parent')
      return NextResponse.json({ error: 'Only parents can create tasks' }, { status: 403 })
    }

    const body = await request.json()
    console.log('Create request body:', body)

    const { title, description, points, category, assignedToId, isRecurring, daysOfWeek, timePeriod } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || '',
        points: parseInt(points) || 1,
        category: category || 'CHORES',
        assignedToId: assignedToId || null,
        createdById: user.id,
        familyId: user.familyId!,
        isRecurring: isRecurring || false,
        daysOfWeek: daysOfWeek || [],
        timePeriod: timePeriod || 'ANYTIME'
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, role: true }
        }
      }
    })

    console.log('Task created successfully:', task.id)
    return NextResponse.json({ task })
  } catch (error) {
    console.error('Error in POST /api/tasks:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}