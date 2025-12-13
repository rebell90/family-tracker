// src/lib/notifications.ts
// Helper functions to create notifications
// NOW WITH REAL-TIME SSE SUPPORT! 🚀

import { prisma } from './prisma'
import { sendNotificationToUser, type SSENotification } from './sse-manager'
import { NotificationType } from '@prisma/client'

// Helper to create notification in database AND send via SSE
async function createAndSendNotification(data: {
  userId: string
  type: NotificationType
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
  try {
    sendNotificationToUser(data.userId, notification as SSENotification)
  } catch (_error) {
    // SSE not available or user not connected - that's OK, they'll get it on next poll
  }

  return notification
}

// Notify child when task is assigned
export async function notifyTaskAssigned({
  assignedToId,
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
    type: NotificationType.TASK_ASSIGNED,
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
    type: NotificationType.TASK_COMPLETED,
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
    type: NotificationType.REWARD_APPROVED,
    title: 'Reward Approved! 🎉',
    message: `${approverName} approved your "${rewardTitle}" reward! Enjoy!`,
  })
}

// Notify child when reward is denied
export async function notifyRewardDenied({
  childId,
  rewardTitle,
  approverName,
  points,  // ✅ ADD THIS PARAMETER
}: {
  childId: string
  rewardTitle: string
  approverName: string
  points: number  // ✅ ADD THIS TYPE
}) {
  return createAndSendNotification({
    userId: childId,
    type: NotificationType.REWARD_DENIED,
    title: 'Reward Not Approved',
    message: `${approverName} did not approve your "${rewardTitle}" reward. Your ${points} points have been refunded.`,  // ✅ UPDATED MESSAGE
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
})
 {
  return createAndSendNotification({
    userId,
    type: NotificationType.REMINDER,
    title,
    message,
    taskId,
  })
}


// Notify child that they requested a reward
export async function notifyRewardRequested({
  childId,
  rewardTitle,
  points,
}: {
  childId: string
  rewardTitle: string
  points: number
}) {
  return createAndSendNotification({
    userId: childId,
    type: NotificationType.REWARD_REQUESTED,
    title: '🎁 Reward Requested',
    message: `You requested "${rewardTitle}" for ${points} points. Waiting for parent approval.`,
  })
}

// Notify parents when a child requests a reward
export async function notifyParentsOfRewardRequest({
  familyId,
  childName,
  rewardTitle,
  points,
}: {
  familyId: string
  childName: string
  rewardTitle: string
  points: number
}) {
  // Get all parents in the family
  const parents = await prisma.user.findMany({
    where: {
      familyId,
      role: 'PARENT'
    },
    select: { id: true }
  })

  // Notify each parent
  const notifications = []
  for (const parent of parents) {
    const notification = await createAndSendNotification({
      userId: parent.id,
      type: NotificationType.REWARD_REQUESTED,
      title: '🎁 New Reward Request',
      message: `${childName} wants to redeem "${rewardTitle}" (${points} points)`,
    })
    notifications.push(notification)
  }

  return notifications
}