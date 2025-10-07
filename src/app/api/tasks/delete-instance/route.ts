import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId, missedDate } = await request.json()

    // Create a skip record for this specific date to mark it as "deleted/ignored"
    await prisma.taskSkip.create({
      data: {
        taskId,
        userId: session.user.id,
        skippedAt: new Date(missedDate),
        reason: 'Instance deleted by user'
      }
    })

    return NextResponse.json({ message: 'Instance deleted successfully' })
  } catch (error) {
    console.error('Error deleting instance:', error)
    return NextResponse.json({ error: 'Failed to delete instance' }, { status: 500 })
  }
}