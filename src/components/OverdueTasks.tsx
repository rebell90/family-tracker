'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, CheckCircle, X, Calendar, Clock, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
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
  missedDate?: string  // Added - when the task was supposed to be done
}

interface GroupedTasks {
  [key: string]: Task[]
}

export default function OverdueTasks() {
  const { data: session } = useSession()
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [processingTask, setProcessingTask] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Yesterday', 'This Week']))
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchOverdueTasks()
  }, [])

  const fetchOverdueTasks = async () => {
    try {
      const response = await fetch('/api/tasks/overdue')
      const result = await response.json()
      
      console.log('Overdue API Response:', result)  // Debug
      
      // Handle both array and object responses
      const data: Task[] = Array.isArray(result) ? result : (result.tasks || [])
      
      setOverdueTasks(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching overdue tasks:', error)
      setLoading(false)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    if (!window.confirm('Mark this task as completed?')) return

    setProcessingTask(taskId)
    try {
      const response = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
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

  const handleSkipTask = async (taskId: string, skipReason?: string) => {
    const reason = skipReason || window.prompt('Why are you skipping this task? (optional)')
    
    setProcessingTask(taskId)
    try {
      const response = await fetch('/api/tasks/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, reason })
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

  const handleRescheduleTask = async (taskId: string, newDate: string) => {
    setProcessingTask(taskId)
    try {
      const response = await fetch('/api/tasks/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, newDate })
      })

      if (response.ok) {
        await fetchOverdueTasks()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to reschedule task')
      }
    } catch (error) {
      console.error('Error rescheduling task:', error)
      alert('Failed to reschedule task')
    } finally {
      setProcessingTask(null)
    }
  }

  const handleBulkAction = async (action: 'complete' | 'skip' | 'reschedule') => {
    if (selectedTasks.size === 0) {
      alert('Please select tasks first')
      return
    }

    const confirmMessage = {
      complete: `Complete ${selectedTasks.size} selected task(s)?`,
      skip: `Skip ${selectedTasks.size} selected task(s)?`,
      reschedule: `Reschedule ${selectedTasks.size} selected task(s) to today?`
    }

    if (!window.confirm(confirmMessage[action])) return

    const taskIds = Array.from(selectedTasks)
    
    try {
      const response = await fetch('/api/tasks/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, action })
      })

      if (response.ok) {
        setSelectedTasks(new Set())
        await fetchOverdueTasks()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to process tasks')
      }
    } catch (error) {
      console.error('Error processing bulk action:', error)
      alert('Failed to process tasks')
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

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const groupTasksByDate = (tasks: Task[]): GroupedTasks => {
    const grouped: GroupedTasks = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    tasks.forEach(task => {
      // Use missedDate if available, otherwise use createdAt
      const taskDateStr = task.missedDate || task.createdAt
      
      if (!taskDateStr) {
        // If no date info, put in "Older Tasks"
        if (!grouped['Older Tasks']) grouped['Older Tasks'] = []
        grouped['Older Tasks'].push(task)
        return
      }

      const taskDate = new Date(taskDateStr)
      taskDate.setHours(0, 0, 0, 0)
      
      const diffTime = today.getTime() - taskDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      let group = 'Older Tasks'
      
      if (diffDays === 0) {
        group = 'Today'
      } else if (diffDays === 1) {
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
const groupOrder = ['Today', 'Yesterday', 'Earlier This Week', 'Last Week', 'Older Tasks']

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link 
                href="/dashboard" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft size={24} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Overdue Tasks</h1>
                <p className="text-gray-600 text-sm mt-1">
                  Manage all your incomplete tasks from previous days
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

          {/* Bulk Actions */}
          {selectedTasks.size > 0 && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">
                  {selectedTasks.size} task(s) selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkAction('complete')}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                  >
                    Complete All
                  </button>
                  <button
                    onClick={() => handleBulkAction('skip')}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                  >
                    Skip All
                  </button>
                  <button
                    onClick={() => handleBulkAction('reschedule')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                  >
                    Reschedule to Today
                  </button>
                  <button
                    onClick={() => setSelectedTasks(new Set())}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Task Groups */}
        {overdueTasks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <CheckCircle className="text-green-500 mx-auto mb-4" size={48} />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">All Caught Up!</h2>
            <p className="text-gray-600">You have no overdue tasks. Great job!</p>
            <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
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
                        group === 'Today' ? 'bg-blue-100 text-blue-600' :
                        group === 'Yesterday' ? 'bg-orange-100 text-orange-600' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        <Calendar size={18} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{group}</h3>
                        <p className="text-sm text-gray-600">{tasks.length} task(s)</p>
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
                      {tasks.map(task => (
                        <div
                          key={task.id}
                          className={`flex items-center gap-4 p-4 rounded-lg border-2 ${
                            selectedTasks.has(task.id)
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          } transition-all`}
                        >
                          {/* Selection Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedTasks.has(task.id)}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          />

                          {/* Task Info */}
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-800">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Clock size={14} />
                                {task.timePeriod || 'Anytime'}
                              </span>
                              {task.isRecurring && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                  Recurring
                                </span>
                              )}
                              <span className="text-sm font-medium text-orange-600">
                                {task.points} points
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCompleteTask(task.id)}
                              disabled={processingTask === task.id}
                              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                              title="Mark as completed"
                            >
                              {processingTask === task.id ? '...' : <CheckCircle size={18} />}
                            </button>
                            <button
                              onClick={() => handleSkipTask(task.id)}
                              disabled={processingTask === task.id}
                              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                              title="Skip this task"
                            >
                              {processingTask === task.id ? '...' : <X size={18} />}
                            </button>
                            <input
                              type="date"
                              onChange={(e) => handleRescheduleTask(task.id, e.target.value)}
                              disabled={processingTask === task.id}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              title="Reschedule task"
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                        </div>
                      ))}
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