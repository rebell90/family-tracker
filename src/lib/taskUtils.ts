// src/lib/taskUtils.ts
// Utility functions for task filtering and display logic

export interface Task {
  id: string
  title: string
  description?: string
  points: number
  isRecurring: boolean
  daysOfWeek: string[]
  recurringEndDate?: string | null
  category: string
  // ... other fields
}

/**
 * Checks if a recurring task is still active based on its end date
 */
export function isRecurringTaskActive(task: Task): boolean {
  // Non-recurring tasks are always active
  if (!task.isRecurring) return true
  
  // Recurring tasks without end date are always active
  if (!task.recurringEndDate) return true
  
  // Check if end date has passed
  const endDate = new Date(task.recurringEndDate)
  endDate.setHours(23, 59, 59, 999) // Include the entire end date
  const now = new Date()
  
  return now <= endDate
}

/**
 * Filters tasks to only show active ones (respecting end dates)
 */
export function filterActiveTasks(tasks: Task[]): Task[] {
  return tasks.filter(task => isRecurringTaskActive(task))
}

/**
 * Gets tasks that should appear today
 */
export function getTodaysTasks(tasks: Task[]): Task[] {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  
  return tasks.filter(task => {
    // Filter out expired recurring tasks
    if (!isRecurringTaskActive(task)) return false
    
    // One-time tasks
    if (!task.isRecurring) return true
    
    // Recurring tasks - check if today is in daysOfWeek
    return task.daysOfWeek.includes(today)
  })
}

/**
 * Gets the status text for a recurring task's end date
 */
export function getRecurringTaskEndStatus(task: Task): {
  text: string
  color: string
  daysRemaining: number | null
} | null {
  if (!task.isRecurring || !task.recurringEndDate) return null
  
  const endDate = new Date(task.recurringEndDate)
  const now = new Date()
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysRemaining < 0) {
    return {
      text: 'Expired',
      color: 'text-gray-500 bg-gray-100',
      daysRemaining: 0
    }
  }
  
  if (daysRemaining === 0) {
    return {
      text: 'Last day',
      color: 'text-orange-700 bg-orange-100',
      daysRemaining: 0
    }
  }
  
  if (daysRemaining <= 3) {
    return {
      text: `${daysRemaining} days left`,
      color: 'text-orange-700 bg-orange-100',
      daysRemaining
    }
  }
  
  if (daysRemaining <= 7) {
    return {
      text: `${daysRemaining} days left`,
      color: 'text-yellow-700 bg-yellow-100',
      daysRemaining
    }
  }
  
  return {
    text: `Ends ${endDate.toLocaleDateString()}`,
    color: 'text-blue-700 bg-blue-100',
    daysRemaining
  }
}

/**
 * Example usage in your Dashboard component:
 */
/*
import { filterActiveTasks, getTodaysTasks, getRecurringTaskEndStatus } from '@/lib/taskUtils'

// In your component:
const activeTasks = filterActiveTasks(allTasks)
const todaysTasks = getTodaysTasks(activeTasks)

// When displaying a task:
const endStatus = getRecurringTaskEndStatus(task)
{endStatus && (
  <span className={`px-2 py-1 rounded text-xs font-medium ${endStatus.color}`}>
    ⏰ {endStatus.text}
  </span>
)}
*/