// src/app/api/notifications/mark-read/route.ts
// PATCH: Mark notification(s) as read

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/notifications/mark-read
// Body: { notificationId?: string, markAllRead?: boolean }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationId, markAllRead } = body

    if (markAllRead) {
      // Mark all user's notifications as read
      await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          read: false,
        },
        data: {
          read: true,
        },
      })

      return NextResponse.json({ message: 'All notifications marked as read' })
    }

    if (notificationId) {
      // Mark specific notification as read
      // First verify the notification belongs to this user
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      })

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        )
      }

      if (notification.userId !== session.user.id) {
        return NextResponse.json(
          { error: 'Unauthorized to mark this notification as read' },
          { status: 403 }
        )
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
      })

      return NextResponse.json({ message: 'Notification marked as read' })
    }

    return NextResponse.json(
      { error: 'Must provide notificationId or markAllRead flag' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    )
  }
}