// src/lib/notifications.ts
// Helper functions for creating notifications

import { prisma } from '@/lib/prisma'

export type NotificationType = 
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'TASK_DUE_SOON'
  | 'REWARD_APPROVED'
  | 'REWARD_DENIED'
  | 'REMINDER'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  taskId?: string
}

/**
 * Create a notification for a user
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  taskId,
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        taskId: taskId || null,
      },
    })
    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    throw error
  }
}

/**
 * Create a "Task Assigned" notification
 * Called when a parent assigns a task to a child
 */
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
  return createNotification({
    userId: assignedToId,
    type: 'TASK_ASSIGNED',
    title: 'New Task Assigned',
    message: `${assignerName} assigned you "${taskTitle}"`,
    taskId,
  })
}

/**
 * Create a "Task Completed" notification
 * Called when a child completes a task
 * Notifies the parent who created the task
 */
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
  return createNotification({
    userId: parentId,
    type: 'TASK_COMPLETED',
    title: 'Task Completed',
    message: `${childName} completed "${taskTitle}" and earned ${pointsEarned} points!`,
    taskId,
  })
}

/**
 * Create a "Reward Approved" notification
 * Called when a parent approves a reward redemption
 */
export async function notifyRewardApproved({
  childId,
  rewardTitle,
  approverName,
}: {
  childId: string
  rewardTitle: string
  approverName: string
}) {
  return createNotification({
    userId: childId,
    type: 'REWARD_APPROVED',
    title: 'Reward Approved! 🎉',
    message: `${approverName} approved your reward: "${rewardTitle}"`,
  })
}

/**
 * Create a "Reward Denied" notification
 * Called when a parent denies a reward redemption
 */
export async function notifyRewardDenied({
  childId,
  rewardTitle,
  approverName,
}: {
  childId: string
  rewardTitle: string
  approverName: string
}) {
  return createNotification({
    userId: childId,
    type: 'REWARD_DENIED',
    title: 'Reward Not Approved',
    message: `${approverName} denied your reward: "${rewardTitle}". Points have been refunded.`,
  })
}

/**
 * Create a reminder notification
 * Called by a scheduled job or manual reminder
 */
export async function notifyReminder({
  userId,
  taskTitle,
  taskId,
  reminderMessage,
}: {
  userId: string
  taskTitle: string
  taskId: string
  reminderMessage?: string
}) {
  return createNotification({
    userId,
    type: 'REMINDER',
    title: 'Task Reminder',
    message: reminderMessage || `Don't forget to complete "${taskTitle}"!`,
    taskId,
  })
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    })
    return count
  } catch (error) {
    console.error('Error getting unread count:', error)
    return 0
  }
}