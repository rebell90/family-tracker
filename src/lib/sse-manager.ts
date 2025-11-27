// src/lib/sse-manager.ts
// SSE connection manager - handles active connections and sending notifications

import { NotificationType } from '@prisma/client'

// Define notification type
export interface SSENotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  taskId: string | null
  read: boolean
  createdAt: Date
}

// Store active connections
const connections = new Map<string, ReadableStreamDefaultController>()

// Add a connection
export function addConnection(userId: string, controller: ReadableStreamDefaultController) {
  connections.set(userId, controller)
  console.log(`📡 SSE connection added for user: ${userId}`)
}

// Remove a connection
export function removeConnection(userId: string) {
  connections.delete(userId)
  console.log(`📡 SSE connection removed for user: ${userId}`)
}

// Send notification to a specific user
export function sendNotificationToUser(userId: string, notification: SSENotification) {
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

// Broadcast to all connected users
export function broadcastNotification(notification: SSENotification) {
  let sent = 0
  connections.forEach((_controller, userId) => {
    if (sendNotificationToUser(userId, notification)) {
      sent++
    }
  })
  console.log(`📢 Broadcast notification to ${sent} users`)
  return sent
}

// Get connection count
export function getConnectionCount() {
  return connections.size
}