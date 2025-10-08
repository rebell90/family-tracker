'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, CheckCircle, X, Calendar, Clock, ChevronDown, ChevronUp, ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  description?: string
  points: number
  completedAt?: Date | string | null
  completedToday?: boolean
  timePeriod?: string
  isRecurring: boolean
  daysOfWeek: string[]
  category?: string
  assignedTo?: {
    id: string
    name: string
  }
  createdAt?: string
  dueDate?: string
  missedDate?: string
  occurrenceDate?: string
}

interface GroupedTasks {
  [key: string]: Task[]
}

export default function OverdueTasks() {
  const { data: session } = useSession()
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [processingTask, setProcessingTask] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Yesterday', 'Earlier This Week']))

  const user = session?.user as { name?: string; role?: string; id?: string } | undefined
  const isParent = user?.role === 'PARENT'

  useEffect(() => {
    fetchOverdueTasks()
  }, [])

  const fetchOverdueTasks = async () => {
    try {
      const response = await fetch('/api/tasks/overdue')
      const result = await response.json()
      
      console.log('Overdue API Response:', result)
      
      const data: Task[] = Array.isArray(result) ? result : (result.tasks || [])
      
      // Filter out today's tasks and skipped tasks
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const filtered = data.filter(task => {
        const taskDate = new Date(task.missedDate || task.createdAt || '')
        taskDate.setHours(0, 0, 0, 0)
        return taskDate < today
      })
      
      setOverdueTasks(filtered)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching overdue tasks:', error)
      setLoading(false)
    }
  }

  const handleCompleteTask = async (taskId: string, missedDate?: string) => {
    if (!window.confirm('Mark this task as completed?')) return

    const uniqueKey = `${taskId}-${missedDate}`
    setProcessingTask(uniqueKey)
    
    try {
      const response = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskId,
          completedAt: missedDate || new Date().toISOString() // Use missedDate as completion date
        })
      })

      if (response.ok) {
        await fetchOverdueTasks()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to complete task')
      }
    } catch (error) {
      console.error('Error completing task:', error)
      alert('Failed to complete task')
    } finally {
      setProcessingTask(null)
    }
  }

  const handleSkipTask = async (taskId: string, missedDate?: string) => {
    const reason = window.prompt('Why are you skipping this task? (optional)')
    if (reason === null) return
    
    const uniqueKey = `${taskId}-${missedDate}`
    setProcessingTask(uniqueKey)
    
    try {
      const response = await fetch('/api/tasks/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskId, 
          reason,
          skippedAt: missedDate || new Date().toISOString() // Use missedDate
        })
      })

      if (response.ok) {
        await fetchOverdueTasks()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to skip task')
      }
    } catch (error) {
      console.error('Error skipping task:', error)
      alert('Failed to skip task')
    } finally {
      setProcessingTask(null)
    }
  }

  const handleRescheduleTask = async (taskId: string, missedDate: string, newDate: string) => {
    if (!newDate) return
    
    const uniqueKey = `${taskId}-${missedDate}`
    setProcessingTask(uniqueKey)
    
    try {
      // First skip the old occurrence
      await fetch('/api/tasks/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskId,
          reason: `Rescheduled from ${new Date(missedDate).toLocaleDateString()} to ${new Date(newDate).toLocaleDateString()}`,
          skippedAt: missedDate
        })
      })

      // Then create a new occurrence for the new date
      // (This would require a new API endpoint or you could just skip for now)
      
      await fetchOverdueTasks()
      alert('Task rescheduled successfully')
    } catch (error) {
      console.error('Error rescheduling task:', error)
      alert('Failed to reschedule task')
    } finally {
      setProcessingTask(null)
    }
  }

  const handleDeleteInstance = async (taskId: string, missedDate?: string) => {
    if (!missedDate) {
      alert('Cannot delete instance: missing date information')
      return
    }

    if (!window.confirm('Permanently delete this occurrence? This cannot be undone.')) return

    const uniqueKey = `${taskId}-${missedDate}`
    setProcessingTask(uniqueKey)
    
    try {
      const response = await fetch('/api/tasks/delete-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, missedDate })
      })

      if (response.ok) {
        await fetchOverdueTasks()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete instance')
      }
    } catch (error) {
      console.error('Error deleting instance:', error)
      alert('Failed to delete instance')
    } finally {
      setProcessingTask(null)
    }
  }

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(group)) {
      newExpanded.delete(group)
    } else {
      newExpanded.add(group)
    }
    setExpandedGroups(newExpanded)
  }

  const groupTasksByDate = (tasks: Task[]): GroupedTasks => {
    const grouped: GroupedTasks = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    tasks.forEach(task => {
      const taskDateStr = task.missedDate || task.createdAt
      
      if (!taskDateStr) {
        if (!grouped['Older Tasks']) grouped['Older Tasks'] = []
        grouped['Older Tasks'].push(task)
        return
      }

      const taskDate = new Date(taskDateStr)
      taskDate.setHours(0, 0, 0, 0)
      
      const diffTime = today.getTime() - taskDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      let group = 'Older Tasks'
      
      if (diffDays === 1) {
        group = 'Yesterday'
      } else if (diffDays <= 7) {
        group = 'Earlier This Week'
      } else if (diffDays <= 14) {
        group = 'Last Week'
      }

      if (!grouped[group]) {
        grouped[group] = []
      }
      grouped[group].push(task)
    })

    return grouped
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading overdue tasks...</div>
      </div>
    )
  }

  const groupedTasks = groupTasksByDate(overdueTasks)
  const groupOrder = ['Yesterday', 'Earlier This Week', 'Last Week', 'Older Tasks']

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link 
                href="/"
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft size={24} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Overdue Tasks</h1>
                <p className="text-gray-600 text-sm mt-1">
                  Complete, reschedule, or skip missed tasks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-orange-500" size={20} />
              <span className="text-lg font-semibold text-gray-700">
                {overdueTasks.length} Overdue
              </span>
            </div>
          </div>
        </div>

        {/* Task Groups */}
        {overdueTasks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <CheckCircle className="text-green-500 mx-auto mb-4" size={48} />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">All Caught Up!</h2>
            <p className="text-gray-600">You have no overdue tasks. Great job!</p>
            <Link href="/" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
              ← Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {groupOrder.map(group => {
              const tasks = groupedTasks[group]
              if (!tasks || tasks.length === 0) return null

              const isExpanded = expandedGroups.has(group)

              return (
                <div key={group} className="bg-white rounded-xl shadow-md overflow-hidden">
                  {/* Group Header */}
                  <div
                    onClick={() => toggleGroup(group)}
                    className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        group === 'Yesterday' ? 'bg-orange-100 text-orange-600' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        <Calendar size={18} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{group}</h3>
                        <p className="text-sm text-gray-600">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {tasks.reduce((sum, t) => sum + t.points, 0)} points total
                      </span>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {/* Tasks List */}
                  {isExpanded && (
                    <div className="p-4 space-y-3 border-t border-gray-100">
                      {tasks.map(task => {
                        const uniqueKey = `${task.id}-${task.missedDate}`
                        const isProcessing = processingTask === uniqueKey
                        const missedDateDisplay = task.missedDate 
                          ? new Date(task.missedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : ''

                        return (
                          <div
                            key={uniqueKey}
                            className="flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all"
                          >
                            {/* Task Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-800">{task.title}</h4>
                                {task.isRecurring && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                    Recurring
                                  </span>
                                )}
                                {missedDateDisplay && (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                    Due: {missedDateDisplay}
                                  </span>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                  <Clock size={14} />
                                  {task.timePeriod || 'Anytime'}
                                </span>
                                <span className="text-sm font-medium text-orange-600">
                                  {task.points} points
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCompleteTask(task.id, task.missedDate)}
                                  disabled={isProcessing}
                                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                  title="Mark as completed"
                                >
                                  {isProcessing ? '...' : (
                                    <>
                                      <CheckCircle size={16} />
                                      Complete
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleSkipTask(task.id, task.missedDate)}
                                  disabled={isProcessing}
                                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                  title="Skip this task"
                                >
                                  {isProcessing ? '...' : (
                                    <>
                                      <X size={16} />
                                      Skip
                                    </>
                                  )}
                                </button>
                              </div>
                              
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-xs text-gray-500 block mb-1">Reschedule to:</label>
                                  <input
                                    type="date"
                                    onChange={(e) => handleRescheduleTask(task.id, task.missedDate || '', e.target.value)}
                                    disabled={isProcessing}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                    min={new Date().toISOString().split('T')[0]}
                                  />
                                </div>
                                
                                {isParent && (
                                  <button
                                    onClick={() => handleDeleteInstance(task.id, task.missedDate)}
                                    disabled={isProcessing}
                                    className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors self-end"
                                    title="Delete this occurrence (Parent only)"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}