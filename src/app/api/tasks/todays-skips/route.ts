import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todaysSkips = await prisma.taskSkip.findMany({
      where: {
        userId: session.user.id,
        skippedAt: {
          gte: today
        }
      },
      select: {
        taskId: true,
        skippedAt: true
      }
    })

    return NextResponse.json(todaysSkips)
  } catch (error) {
    console.error('Error fetching today\'s skips:', error)
    return NextResponse.json({ error: 'Failed to fetch skips' }, { status: 500 })
  }
}