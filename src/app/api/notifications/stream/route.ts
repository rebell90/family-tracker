// src/app/api/notifications/stream/route.ts
// Server-Sent Events (SSE) endpoint for real-time notification updates

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Define notification type
interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  taskId: string | null
  read: boolean
  createdAt: Date
}

// Store active connections
const connections = new Map<string, ReadableStreamDefaultController>()

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id

  // Create a new ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Store this connection
      connections.set(userId, controller)
      
      console.log(`📡 SSE connection opened for user: ${userId}`)

      // Send initial connection message
      const data = JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })
      controller.enqueue(`data: ${data}\n\n`)

      // Set up heartbeat to keep connection alive (every 30 seconds)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`:heartbeat\n\n`)
        } catch (_error) {
          console.log(`❌ Heartbeat failed for user ${userId}, cleaning up`)
          clearInterval(heartbeat)
          connections.delete(userId)
        }
      }, 30000)

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`📡 SSE connection closed for user: ${userId}`)
        clearInterval(heartbeat)
        connections.delete(userId)
        try {
          controller.close()
        } catch (_e) {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  })
}

// Helper function to send notification to a specific user
export function sendNotificationToUser(userId: string, notification: Notification) {
  const controller = connections.get(userId)
  
  if (controller) {
    try {
      const data = JSON.stringify({
        type: 'notification',
        notification,
        timestamp: new Date().toISOString(),
      })
      controller.enqueue(`data: ${data}\n\n`)
      console.log(`✅ Sent real-time notification to user: ${userId}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to send notification to user ${userId}:`, error)
      connections.delete(userId)
      return false
    }
  }
  
  return false
}

// Helper to broadcast to all connected users
export function broadcastNotification(notification: Notification) {
  let sent = 0
  connections.forEach((controller, userId) => {
    if (sendNotificationToUser(userId, notification)) {
      sent++
    }
  })
  console.log(`📢 Broadcast notification to ${sent} users`)
  return sent
}