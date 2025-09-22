import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - List all tasks for the family
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/tasks - Starting request')
    
    const session = await getServerSession(authOptions)
    console.log('Session:', session?.user?.id, session?.user?.role)
    
    if (!session?.user) {
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
              gte: new Date(new Date().setHours(0, 0, 0, 0)) // Today's completions
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform tasks to include completion status
const tasksWithCompletionStatus = tasks.map(task => {
  const completedToday = task.completions.length > 0
  
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
    isRecurring: task.isRecurring,
    daysOfWeek: task.daysOfWeek
  }
})

console.log('Found tasks:', tasksWithCompletionStatus.length)
return NextResponse.json({ tasks: tasksWithCompletionStatus })
  } catch (error) {
    console.error('Error in GET /api/tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST - Create a new task
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/tasks - Starting request')
    
    const session = await getServerSession(authOptions)
    console.log('Session:', session?.user?.id, session?.user?.role)
    
    if (!session?.user) {
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
    console.log('Request body:', body)
    
    const { title, description, points, category, assignedToId, isRecurring, daysOfWeek } = body

    // Create family if it doesn't exist
    let familyId = user.familyId
    if (!familyId) {
      console.log('Creating new family')
      const family = await prisma.family.create({
        data: {
          name: `${user.name}'s Family`
        }
      })
      
      await prisma.user.update({
        where: { id: user.id },
        data: { familyId: family.id }
      })
      
      familyId = family.id
      console.log('Created family:', familyId)
    }

    console.log('Creating task with familyId:', familyId, 'category:', category)

    const task = await prisma.task.create({
      data: {
        title,
        description,
        points: parseInt(points) || 1,
        category: category || 'CHORES',
        assignedToId: assignedToId || null,
        createdById: user.id,
        familyId,
        isRecurring: isRecurring || false,
        daysOfWeek: daysOfWeek || []
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, role: true }
        },
        createdBy: {
          select: { id: true, name: true }
        }
      }
    })

    console.log('Task created successfully:', task.id)
    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/tasks:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
