// src/lib/notifications.ts
// Helper functions to create notifications
// NOW WITH REAL-TIME SSE SUPPORT! 🚀

import { prisma } from './prisma'

// Note: We'll import this dynamically to avoid circular dependencies
async function sendSSENotification(userId: string, notification: any) {
  try {
    // Dynamic import to avoid build issues
    const { sendNotificationToUser } = await import('@/app/api/notifications/stream/route')
    return sendNotificationToUser(userId, notification)
  } catch (error) {
    // SSE not available or user not connected - that's OK, they'll get it on next poll
    return false
  }
}

// Helper to create notification in database AND send via SSE
async function createAndSendNotification(data: {
  userId: string
  type: string
  title: string
  message: string
  taskId?: string
}) {
  // Create in database
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      taskId: data.taskId || null,
    },
  })

  // Send via SSE for instant delivery
  await sendSSENotification(data.userId, notification)

  return notification
}

// Notify child when task is assigned
export async function notifyTaskAssigned({
  assignedToId,
  assignedToName,
  taskTitle,
  taskId,
  assignerName,
}: {
  assignedToId: string
  assignedToName: string
  taskTitle: string
  taskId: string
  assignerName: string
}) {
  return createAndSendNotification({
    userId: assignedToId,
    type: 'TASK_ASSIGNED',
    title: 'New Task Assigned',
    message: `${assignerName} assigned you "${taskTitle}"`,
    taskId,
  })
}

// Notify parent when child completes task
export async function notifyTaskCompleted({
  parentId,
  childName,
  taskTitle,
  taskId,
  pointsEarned,
}: {
  parentId: string
  childName: string
  taskTitle: string
  taskId: string
  pointsEarned: number
}) {
  return createAndSendNotification({
    userId: parentId,
    type: 'TASK_COMPLETED',
    title: 'Task Completed! 🎉',
    message: `${childName} completed "${taskTitle}" and earned ${pointsEarned} points!`,
    taskId,
  })
}

// Notify child when reward is approved
export async function notifyRewardApproved({
  childId,
  rewardTitle,
  approverName,
}: {
  childId: string
  rewardTitle: string
  approverName: string
}) {
  return createAndSendNotification({
    userId: childId,
    type: 'REWARD_APPROVED',
    title: 'Reward Approved! 🎉',
    message: `${approverName} approved your "${rewardTitle}" reward! Enjoy!`,
  })
}

// Notify child when reward is denied
export async function notifyRewardDenied({
  childId,
  rewardTitle,
  approverName,
}: {
  childId: string
  rewardTitle: string
  approverName: string
}) {
  return createAndSendNotification({
    userId: childId,
    type: 'REWARD_DENIED',
    title: 'Reward Not Approved',
    message: `${approverName} did not approve your "${rewardTitle}" reward. Points have been refunded.`,
  })
}

// Send a general reminder notification
export async function notifyReminder({
  userId,
  title,
  message,
  taskId,
}: {
  userId: string
  title: string
  message: string
  taskId?: string
}) {
  return createAndSendNotification({
    userId,
    type: 'REMINDER',
    title,
    message,
    taskId,
  })
}