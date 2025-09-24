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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { oldFamilyId, newFamilyId } = await request.json()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.familyId !== newFamilyId) {
      return NextResponse.json({ error: 'Invalid family access' }, { status: 403 })
    }

    // Move all tasks from old family to new family
    const updatedTasks = await prisma.task.updateMany({
      where: { 
        createdById: user.id,
        familyId: oldFamilyId 
      },
      data: { familyId: newFamilyId }
    })

    // Clean up old family if it's empty
    const remainingUsers = await prisma.user.count({
      where: { familyId: oldFamilyId }
    })

    if (remainingUsers === 0) {
      await prisma.family.delete({
        where: { id: oldFamilyId }
      })
    }

    return NextResponse.json({ 
      success: true,
      migratedTasks: updatedTasks.count,
      message: `Successfully moved ${updatedTasks.count} tasks to your new family!`
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}