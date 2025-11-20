// src/app/api/notifications/stream/route.ts
// Server-Sent Events (SSE) endpoint for real-time notification updates

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addConnection, removeConnection } from '@/lib/sse-manager'

export const dynamic = 'force-dynamic'

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
      addConnection(userId, controller)
      
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
          removeConnection(userId)
        }
      }, 30000)

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`📡 SSE connection closed for user: ${userId}`)
        clearInterval(heartbeat)
        removeConnection(userId)
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