'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Star, CheckCircle, Gift, Users, Calendar, Clock, Sunrise, Sun, Sunset, Moon } from 'lucide-react'
import Link from 'next/link'  

interface Child {
  id: string
  name: string
  email: string
}

interface Task {
  id: string
  title: string
  description?: string
  points: number
  completedAt?: Date | string | null
  completedToday?: boolean
  completedBy?: string | null
  skippedToday?: boolean
  timePeriod?: string
  isRecurring: boolean
  daysOfWeek: string[]
  category?: string
  startDate?: string | Date | null
  recurringEndDate?: string | Date | null
  assignedTo?: {
    id: string
    name: string
  }
}

interface ChildStats {
  currentPoints: number
  totalEarned: number
  tasksCompletedToday: number
  streak: number
}

const TIME_PERIODS = {
  MORNING: { label: 'Morning', icon: Sunrise, subtitle: '6 AM - 12 PM', color: 'bg-orange-100 text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' },
  AFTERNOON: { label: 'Afternoon', icon: Sun, subtitle: '12 PM - 5 PM', color: 'bg-yellow-100 text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' },
  EVENING: { label: 'Evening', icon: Sunset, subtitle: '5 PM - 9 PM', color: 'bg-purple-100 text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-300' },
  NIGHT: { label: 'Night', icon: Moon, subtitle: '9 PM - 11 PM', color: 'bg-blue-100 text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' },
  ANYTIME: { label: 'Anytime', icon: Calendar, subtitle: 'No specific time', color: 'bg-gray-100 text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-300' },
}

const DAYS_MAP = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

export default function ParentDashboard() {
  const { data: session } = useSession()
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string>('all')
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<ChildStats>({
    currentPoints: 0,
    totalEarned: 0,
    tasksCompletedToday: 0,
    streak: 0
  })
  const [overdueCount, setOverdueCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [completingTask, setCompletingTask] = useState<string | null>(null)

  useEffect(() => {
    fetchChildren()
  }, [])

  useEffect(() => {
    if (selectedChildId) {
      fetchTasksForChild()
      fetchStatsForChild()
      fetchOverdueForChild()
    }
  }, [selectedChildId])

  const fetchChildren = async () => {
    try {
      const response = await fetch('/api/family/members')
      const data = await response.json()
      
      // Filter to only children
      const childMembers = data.members?.filter((m: any) => m.role === 'CHILD') || []
      setChildren(childMembers)
      
      if (childMembers.length > 0) {
        setSelectedChildId('all') // Default to showing all
      }
    } catch (error) {
      console.error('Error fetching children:', error)
    }
  }

  const fetchTasksForChild = async () => {
    try {
      const endpoint = selectedChildId === 'all' 
        ? '/api/tasks/all-children'
        : `/api/tasks?childId=${selectedChildId}`
      
      const response = await fetch(endpoint)
      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStatsForChild = async () => {
    if (selectedChildId === 'all') {
      // Aggregate stats for all children
      try {
        const statsPromises = children.map(child =>
          fetch(`/api/user-points?userId=${child.id}`).then(r => r.json())
        )
        const allStats = await Promise.all(statsPromises)
        
        const aggregated = allStats.reduce((acc, stat) => ({
          currentPoints: acc.currentPoints + (stat.currentPoints || 0),
          totalEarned: acc.totalEarned + (stat.totalEarned || 0),
          tasksCompletedToday: acc.tasksCompletedToday + (stat.tasksCompletedToday || 0),
          streak: Math.max(acc.streak, stat.streak || 0) // Show highest streak
        }), { currentPoints: 0, totalEarned: 0, tasksCompletedToday: 0, streak: 0 })
        
        setStats(aggregated)
      } catch (error) {
        console.error('Error fetching aggregate stats:', error)
      }
    } else {
      // Fetch stats for specific child
      try {
        const response = await fetch(`/api/user-points?userId=${selectedChildId}`)
        const data = await response.json()
        setStats({
          currentPoints: data.currentPoints || 0,
          totalEarned: data.totalEarned || 0,
          tasksCompletedToday: data.tasksCompletedToday || 0,
          streak: data.streak || 0
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }
  }

  const fetchOverdueForChild = async () => {
    if (selectedChildId === 'all') {
      // Count overdue for all children
      try {
        const countPromises = children.map(child =>
          fetch(`/api/tasks/overdue?userId=${child.id}`).then(r => r.json())
        )
        const allOverdue = await Promise.all(countPromises)
        const total = allOverdue.reduce((sum, data) => sum + (data.tasks?.length || 0), 0)
        setOverdueCount(total)
      } catch (error) {
        console.error('Error fetching overdue count:', error)
      }
    } else {
      // Fetch overdue for specific child
      try {
        const response = await fetch(`/api/tasks/overdue?userId=${selectedChildId}`)
        const data = await response.json()
        setOverdueCount(data.tasks?.length || 0)
      } catch (error) {
        console.error('Error fetching overdue count:', error)
      }
    }
  }

  const handleCompleteTask = async (taskId: string, taskTitle: string, childName: string) => {
    const confirmed = window.confirm(
      `Complete "${taskTitle}" on behalf of ${childName}?\n\nThis will award points to ${childName}.`
    )
    
    if (!confirmed) return

    setCompletingTask(taskId)
    
    try {
      const response = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (response.ok) {
        await fetchTasksForChild()
        await fetchStatsForChild()
        await fetchOverdueForChild()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to complete task')
      }
    } catch (error) {
      console.error('Error completing task:', error)
      alert('Failed to complete task')
    } finally {
      setCompletingTask(null)
    }
  }

  const handleUndoTask = async (taskId: string, taskTitle: string, childName: string) => {
    const confirmed = window.confirm(
      `Undo completion of "${taskTitle}" for ${childName}?\n\nThis will remove points from ${childName}.`
    )
    
    if (!confirmed) return

    setCompletingTask(taskId)
    
    try {
      const response = await fetch('/api/tasks/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (response.ok) {
        await fetchTasksForChild()
        await fetchStatsForChild()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to undo task')
      }
    } catch (error) {
      console.error('Error undoing task:', error)
      alert('Failed to undo task')
    } finally {
      setCompletingTask(null)
    }
  }

  const getTasksForToday = () => {
    const today = new Date().getDay()
    const dayName = Object.keys(DAYS_MAP)[Object.values(DAYS_MAP).indexOf(today)]

    return tasks.filter(task => {
      if (!task.isRecurring) return true
      if (task.isRecurring && task.daysOfWeek.length > 0) {
        return task.daysOfWeek.includes(dayName)
      }
      return true
    })
  }

  const tasksByPeriod = getTasksForToday().reduce((acc, task) => {
    const period = task.timePeriod || 'ANYTIME'
    if (!acc[period]) acc[period] = []
    acc[period].push(task)
    return acc
  }, {} as Record<string, Task[]>)

  const getCurrentPeriod = () => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 12) return 'MORNING'
    if (hour >= 12 && hour < 17) return 'AFTERNOON'
    if (hour >= 17 && hour < 21) return 'EVENING'
    if (hour >= 21 || hour < 6) return 'NIGHT'
    return 'ANYTIME'
  }

  const currentPeriod = getCurrentPeriod()
  const todaysTasks = getTasksForToday()

  const selectedChildName = selectedChildId === 'all' 
    ? 'All Children' 
    : children.find(c => c.id === selectedChildId)?.name || 'Child'

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Parent Dashboard</h1>
            <p className="text-gray-600 mt-1">Monitor and manage your children's tasks</p>
          </div>
          
          <Link href="/" className="text-blue-600 hover:text-blue-700 underline">
            ← Back to Main Dashboard
          </Link>
        </div>

        {/* Child Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            View tasks for:
          </label>
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Children</option>
            {children.map(child => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <Star className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Points</p>
                <p className="text-2xl font-bold text-gray-800">{stats.currentPoints}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedChildName}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Tasks Today</p>
                <p className="text-2xl font-bold text-gray-800">{stats.tasksCompletedToday}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedChildName}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Gift className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Earned</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalEarned}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedChildName}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <span className="text-orange-600 text-2xl">🔥</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {selectedChildId === 'all' ? 'Best Streak' : 'Streak Days'}
                </p>
                <p className="text-2xl font-bold text-gray-800">{stats.streak}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedChildName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Overdue Alert */}
        {overdueCount > 0 && (
          <div className="mb-6 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📅</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-800 mb-1">
                  {selectedChildName} has {overdueCount} overdue task{overdueCount !== 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-orange-700 mb-3">
                  Tasks from the past week that need attention
                </p>
                <button
                  onClick={() => window.location.href = `/overdue-tasks${selectedChildId !== 'all' ? `?childId=${selectedChildId}` : ''}`}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  View Overdue Tasks →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Today's Tasks */}
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Today&apos;s Schedule - {selectedChildName}
            </h2>
            <p className="text-gray-600">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          {Object.entries(TIME_PERIODS).map(([periodKey, periodInfo]) => {
            const periodTasks = tasksByPeriod[periodKey] || []
            const visibleTasks = periodTasks.filter(t => !t.skippedToday)
            const isCurrentPeriod = periodKey === currentPeriod
            const IconComponent = periodInfo.icon

            if (visibleTasks.length === 0) return null           

            return (
              <div 
                key={periodKey}
                className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                  isCurrentPeriod 
                    ? `${periodInfo.borderColor} shadow-md` 
                    : 'border-gray-100'
                }`}
              >
                {/* Period Header */}
                <div className={`p-4 rounded-t-xl ${isCurrentPeriod ? periodInfo.bgColor : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${periodInfo.color}`}>
                        <IconComponent size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                          {periodInfo.label}
                          {isCurrentPeriod && (
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">{periodInfo.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Tasks */}
                <div className="p-4 space-y-3">
                  {periodTasks.map((task) => {
                    const isCompleted = task.completedToday === true || task.completedAt !== null
                    const isSkipped = task.skippedToday === true 

                    if (isSkipped) return null

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                          isCompleted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200 hover:border-purple-400'
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={`w-8 h-8 rounded-full border-3 flex items-center justify-center ${
                              isCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-purple-400'
                            }`}
                          >
                            {isCompleted && <CheckCircle size={18} />}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className={`font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                {task.title}
                              </h4>
                              {task.assignedTo && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  {task.assignedTo.name}
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            isCompleted
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {task.points} pts
                          </span>

                          {!isCompleted && (
                            <button
                              onClick={() => handleCompleteTask(
                                task.id, 
                                task.title,
                                task.assignedTo?.name || 'child'
                              )}
                              disabled={completingTask === task.id}
                              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              {completingTask === task.id ? 'Completing...' : (
                                <>
                                  <CheckCircle size={16} />
                                  Complete
                                </>
                              )}
                            </button>
                          )}

                          {isCompleted && task.completedBy && (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-gray-500">
                                ✓ by {task.completedBy}
                              </span>
                              <button
                                onClick={() => handleUndoTask(
                                  task.id,
                                  task.title,
                                  task.assignedTo?.name || 'child'
                                )}
                                className="text-gray-500 hover:text-gray-700 text-sm underline"
                              >
                                Undo
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {todaysTasks.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <CheckCircle size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                No tasks for {selectedChildName} today!
              </h3>
              <p className="text-gray-600">
                They&apos;re all set or it&apos;s a free day!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}