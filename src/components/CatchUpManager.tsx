'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { CheckCircle, Clock, Star, Calendar } from 'lucide-react'

interface Task {
  id: string
  title: string
  description?: string
  points: number
  completed: boolean
  completedToday: boolean
  timePeriod?: string
  isRecurring: boolean
  daysOfWeek: string[]
  category?: string
  assignedTo?: {
    id: string
    name: string
  }
}

const DAYS_MAP = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
}

export default function CatchUpManager() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const handleCompleteTask = async (taskId: string, dateCompleted: string) => {
    setCompletingTask(taskId)
    
    try {
      const response = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          taskId,
          completedDate: dateCompleted // Add this to track which day it was completed for
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`Task completed! You earned ${data.pointsEarned} points!`)
        fetchTasks()
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(data.error)
      }
    } catch (error) {
      console.error('Error completing task:', error)
      setMessage('Failed to complete task')
    } finally {
      setCompletingTask(null)
    }
  }

  // Get past dates (last 7 days, excluding today)
  const getPastDates = () => {
    const dates = []
    for (let i = 1; i <= 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date)
    }
    return dates
  }

  // Check if a task was scheduled for a specific date
  const wasTaskScheduledForDate = (task: Task, date: Date) => {
    if (!task.isRecurring) {
      // For non-recurring tasks, assume they were available every day
      return true
    }

    if (task.daysOfWeek.length === 0) {
      // Recurring task with no specific days = every day
      return true
    }

    // Check if the task was scheduled for this day of the week
    const dayOfWeek = date.getDay()
    const dayName = Object.keys(DAYS_MAP)[Object.values(DAYS_MAP).indexOf(dayOfWeek)]
    return task.daysOfWeek.includes(dayName)
  }

  // Get tasks that were due on a specific date but not completed
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      // Only show tasks that were scheduled for that date
      if (!wasTaskScheduledForDate(task, date)) return false

      // For now, we'll assume all tasks are "missed" if they're not completed today
      // In a more sophisticated system, you'd track completion dates
      return !task.completedToday && !task.completed
    })
  }

  const pastDates = getPastDates()
  const user = session?.user as { name?: string; role?: string } | undefined

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Catch Up on Missed Tasks</h2>
        <p className="text-gray-600">
          Complete tasks from previous days to earn points and stay on track!
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-center">
          {message}
        </div>
      )}

      {/* Past dates with tasks */}
      <div className="space-y-6">
        {pastDates.map((date) => {
          const missedTasks = getTasksForDate(date)
          
          if (missedTasks.length === 0) return null

          const dateStr = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric' 
          })

          const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))

          return (
            <div key={date.toISOString()} className="bg-white rounded-xl shadow-sm border border-orange-200">
              {/* Date Header */}
              <div className="p-4 bg-orange-50 rounded-t-xl border-b border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Calendar className="text-orange-600" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{dateStr}</h3>
                      <p className="text-sm text-gray-600">
                        {daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-orange-600 font-medium">
                    {missedTasks.length} missed task{missedTasks.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Tasks */}
              <div className="p-4 space-y-3">
                {missedTasks.map((task) => (
                  <div
                    key={`${task.id}-${date.toISOString()}`}
                    className="flex items-center justify-between p-4 rounded-lg bg-orange-50 border border-orange-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full border-2 border-orange-300 flex items-center justify-center">
                        <Clock size={14} className="text-orange-500" />
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-800">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-gray-600">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {task.assignedTo && task.assignedTo.id === (user as any)?.id && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              Assigned to you
                            </span>
                          )}
                          {task.timePeriod && task.timePeriod !== 'ANYTIME' && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                              {task.timePeriod.toLowerCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
                        {task.points} pts
                      </span>
                      
                      <button
                        onClick={() => handleCompleteTask(task.id, date.toISOString())}
                        disabled={completingTask === task.id}
                        className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                      >
                        {completingTask === task.id ? 'Completing...' : 'Complete Now'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* No missed tasks */}
      {pastDates.every(date => getTasksForDate(date).length === 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-green-400 mb-4">
            <CheckCircle size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">All Caught Up!</h3>
          <p className="text-gray-600">
            You haven't missed any tasks in the past week. Keep up the great work!
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Catch Up Tips:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Complete missed tasks to earn points and maintain your streak</li>
          <li>• Tasks from yesterday are worth full points</li>
          <li>• Focus on high-point tasks first for maximum benefit</li>
        </ul>
      </div>
    </div>
  )
}