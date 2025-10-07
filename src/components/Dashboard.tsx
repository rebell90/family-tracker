'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Star, CheckCircle, Gift, Settings, Users, Clock, Sun, Moon } from 'lucide-react'
import TaskManager from './TaskManager'
import FamilyManager from './FamilyManager'
import RewardManager from './RewardManager'
import Link from 'next/link'
import { AlertCircle, ExternalLink } from 'lucide-react'

interface Task {
  id: string
  title: string
  description?: string
  points: number
  completedAt?: Date | null
  completedToday?: boolean
  timePeriod?: string
  isRecurring: boolean
  daysOfWeek: string[]
  category?: string
  assignedTo?: {
    id: string
    name: string
  }
}

interface UserStats {
  currentPoints: number
  totalEarned: number
  tasksCompletedToday: number
  streak: number
}

interface TaskCompletion {
  taskId: string
  completedAt: Date
  userId: string
}

const TIME_PERIODS = {
  MORNING: { 
    label: 'Morning', 
    subtitle: '6 AM - 12 PM',
    icon: Sun, 
    color: 'bg-orange-100 text-orange-700',
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50'
  },
  AFTERNOON: { 
    label: 'Afternoon', 
    subtitle: '12 PM - 6 PM',
    icon: Sun, 
    color: 'bg-yellow-100 text-yellow-700',
    borderColor: 'border-yellow-200',
    bgColor: 'bg-yellow-50'
  },
  EVENING: { 
    label: 'Evening', 
    subtitle: '6 PM - 10 PM',
    icon: Moon, 
    color: 'bg-blue-100 text-blue-700',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50'
  },
  ANYTIME: { 
    label: 'Anytime', 
    subtitle: 'No specific time',
    icon: Clock, 
    color: 'bg-gray-100 text-gray-700',
    borderColor: 'border-gray-200',
    bgColor: 'bg-gray-50'
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

export default function Dashboard() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<UserStats>({
    currentPoints: 0,
    totalEarned: 0,
    tasksCompletedToday: 0,
    streak: 0
  })
  const [showTaskManager, setShowTaskManager] = useState(false)
  const [showFamilyManager, setShowFamilyManager] = useState(false)
  const [showRewardManager, setShowRewardManager] = useState(false)
  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [overdueTasks, setOverdueTasks] = useState<number>(0)

  const user = session?.user as { name?: string; role?: string } | undefined
  const isParent = user?.role === 'PARENT'
  const isChild = user?.role === 'CHILD'

  console.log('Debug info:', {
    session: session,
    user: user,
    userRole: user?.role,
    isParent: isParent,
    showFamilyManager: showFamilyManager
  });

  useEffect(() => {
    if (session?.user) {
      fetchTasks()
      fetchUserPoints()
      fetchOverdueCount()
    }
  }, [session])

const fetchTasks = async () => {
  try {
    const response = await fetch('/api/tasks')
    const result = await response.json()  // Don't assume it's an array yet
    
    console.log('API Response:', result)  // DEBUG - see what we actually get
    
    // Handle different possible response structures
    const data: Task[] = Array.isArray(result) ? result : (result.tasks || [])
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const completionsResponse = await fetch('/api/tasks/todays-completions')
    const todaysCompletions: TaskCompletion[] = await completionsResponse.json()
    const completedTodayIds = new Set(todaysCompletions.map((c) => c.taskId))
    
    const tasksWithTodayStatus = data.map((task) => ({
      ...task,
      completedToday: completedTodayIds.has(task.id) || 
                      Boolean(task.completedAt && new Date(task.completedAt) >= today)
    }))
    
    setTasks(tasksWithTodayStatus)
  } catch (error) {
    console.error('Error fetching tasks:', error)
  }
}

  const fetchUserPoints = async () => {
    try {
      const response = await fetch('/api/user/points')
      if (response.ok) {
        const data = await response.json()
        setStats(prev => ({
          ...prev,
          currentPoints: data.currentPoints,
          totalEarned: data.totalEarned
        }))
      }
    } catch (error) {
      console.error('Error fetching points:', error)
    }
  }

  const fetchOverdueCount = async () => {
    try {
      const response = await fetch('/api/tasks/overdue')
      const data = await response.json()
      setOverdueTasks(data.length || 0)
    } catch (error) {
      console.error('Error fetching overdue count:', error)
    }
  }

  const handleCompleteTask = async (taskId: string, taskTitle: string) => {
    const confirmed = window.confirm(`Complete "${taskTitle}"?\n\nYou'll earn points for completing this task.`)
    
    if (!confirmed) return
    
    setCompletingTask(taskId)
    
    try {
      const response = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        fetchTasks()
        fetchUserPoints()
      } else {
        alert(data.error)
      }
    } catch (error) {
      console.error('Error completing task:', error)
      alert('Failed to complete task')
    } finally {
      setCompletingTask(null)
    }
  }

  const handleUndoTask = async (taskId: string, taskTitle: string) => {
    const confirmed = window.confirm(`Undo completion of "${taskTitle}"?\n\nPoints will be removed from your total.`)
    
    if (!confirmed) return
    
    try {
      const response = await fetch('/api/tasks/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        fetchTasks()
        fetchUserPoints()
      } else {
        alert(data.error)
      }
    } catch (error) {
      console.error('Error undoing task:', error)
      alert('Failed to undo task completion')
    }
  }

  const getCurrentTimePeriod = () => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 12) return 'MORNING'
    if (hour >= 12 && hour < 18) return 'AFTERNOON'
    if (hour >= 18 && hour < 22) return 'EVENING'
    return 'ANYTIME'
  }

  const getYesterdaysMissedTasks = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dayOfWeek = yesterday.getDay()
    const dayName = Object.keys(DAYS_MAP)[Object.values(DAYS_MAP).indexOf(dayOfWeek)]

    return tasks.filter(task => {
      if (task.completedAt || task.completedToday) return false
      
      if (!task.isRecurring) return true
      if (task.daysOfWeek.length === 0) return true
      return task.daysOfWeek.includes(dayName)
    })
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

  const groupTasksByTimePeriod = (tasks: Task[]) => {
    return tasks.reduce((acc, task) => {
      const period = task.timePeriod || 'ANYTIME'
      if (!acc[period]) {
        acc[period] = []
      }
      acc[period].push(task)
      return acc
    }, {} as Record<string, Task[]>)
  }

const handleSkipTask = async (taskId: string, taskTitle: string) => {
  const reason = window.prompt(`Why are you skipping "${taskTitle}"? (optional)`)
  if (reason === null) return // User cancelled
  
  try {
    const response = await fetch('/api/tasks/skip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId, reason })
    })

    const data = await response.json()

    if (response.ok) {
      alert('Task skipped')
      fetchTasks() // Refresh the tasks list
      fetchOverdueCount() // Also refresh overdue count
    } else {
      alert(data.error || 'Failed to skip task')
    }
  } catch (error) {
    console.error('Error skipping task:', error)
    alert('Failed to skip task')
  }
}

  const yesterdaysMissed = getYesterdaysMissedTasks()
  const todaysTasks = getTasksForToday()
  const tasksByPeriod = groupTasksByTimePeriod(todaysTasks)
  const currentPeriod = getCurrentTimePeriod()

  if (isParent && showTaskManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Task Manager</h1>
            <button
              onClick={() => setShowTaskManager(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <TaskManager />
        </div>
      </div>
    )
  }

  if (isParent && showFamilyManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Family Manager</h1>
            <button
              onClick={() => setShowFamilyManager(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <FamilyManager />
        </div>
      </div>
    )
  }

  if (showRewardManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Reward Store</h1>
            <button
              onClick={() => setShowRewardManager(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <RewardManager />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Hi {session?.user?.name || 'there'}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              {isChild ? "Let's see what you can accomplish today!" : "Family Dashboard"}
            </p>
          </div>
          {isParent && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowFamilyManager(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Users size={20} />
                Family
              </button>
              <button
                onClick={() => setShowTaskManager(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Settings size={20} />
                Tasks
              </button>
              <button
                onClick={() => setShowRewardManager(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Gift size={20} />
                Rewards
              </button>
            </div>
          )}
          {isChild && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowRewardManager(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Gift size={20} />
                Reward Store
              </button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <Star className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Points</p>
                <p className="text-2xl font-bold text-gray-800">{stats.currentPoints}</p>
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
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <span className="text-orange-600 text-xl">🔥</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Streak Days</p>
                <p className="text-2xl font-bold text-gray-800">{stats.streak}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Overdue Warning Banner */}
        {overdueTasks > yesterdaysMissed.length && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-500" size={24} />
                <div>
                  <h3 className="font-semibold text-red-800">
                    You have {overdueTasks} overdue tasks
                  </h3>
                  <p className="text-sm text-red-600">
                    Take a moment to catch up or reschedule them
                  </p>
                </div>
              </div>
              <Link
                href="/overdue-tasks"
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Manage Overdue Tasks
              </Link>
            </div>
          </div>
        )}

        {/* Yesterday's Missed Tasks */}
        {yesterdaysMissed.length > 0 && (
          <div className="mb-6 bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-orange-800">
                Yesterday&apos;s Incomplete Tasks ({yesterdaysMissed.length})
              </h3>
              <Link
                href="/overdue-tasks"
                className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                View All Overdue
                <ExternalLink size={16} />
              </Link>
            </div>
            <div className="space-y-2">
              {yesterdaysMissed.slice(0, 3).map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                  <div>
                    <h4 className="font-medium text-gray-800">{task.title}</h4>
                    {task.description && <p className="text-sm text-gray-600">{task.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
                      {task.points} pts
                    </span>
                    <button
                      onClick={() => handleCompleteTask(task.id, task.title)}
                      disabled={completingTask === task.id}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-3 py-1 rounded-lg text-sm font-medium"
                      title="Mark as completed"
                    >
                      {completingTask === task.id ? '...' : 'Complete'}
                    </button>
                    <button
                      onClick={() => handleSkipTask(task.id, task.title)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-sm font-medium"
                      title="Skip this task"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
              {yesterdaysMissed.length > 3 && (
                <Link
                  href="/overdue-tasks"
                  className="block text-center text-sm text-orange-600 hover:text-orange-700 font-medium mt-2"
                >
                  + {yesterdaysMissed.length - 3} more overdue tasks →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Today's Schedule */}
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Today&apos;s Schedule</h2>
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
            const isCurrentPeriod = periodKey === currentPeriod
            const IconComponent = periodInfo.icon

            if (periodTasks.length === 0) return null          

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
                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                              Current
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">{periodInfo.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {periodTasks.length} task{periodTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Tasks */}
                <div className="p-4 space-y-3">
                  {periodTasks.map((task) => {
                       const isCompleted = task.completedToday === true || 
                          (task.completedAt !== null && 
                          task.completedAt !== undefined
                          )
                    console.log('Task Debug:', {
                      title: task.title,
                      completedToday: task.completedToday,
                      completedAt: task.completedAt,
                      completedAtType: typeof task.completedAt,
                      isCompleted: isCompleted
                    })
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                          isCompleted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200 hover:border-purple-400 hover:shadow-md'
                        }`}
                      >
                        <div
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => !isCompleted && handleCompleteTask(task.id, task.title)}
                        >
                          <div
                            className={`w-8 h-8 rounded-full border-3 flex items-center justify-center transition-colors ${
                              isCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-purple-400 hover:bg-purple-50'
                            }`}
                          >
                            {isCompleted && <CheckCircle size={20} />}
                          </div>

                          <div className="flex-1">
                            <h4 className={`font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className={`text-sm ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
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
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCompleteTask(task.id, task.title)
                              }}
                              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                              title="Complete task"
                            >
                              <CheckCircle size={16} />
                              Complete
                            </button>
                          )}
                          {!isCompleted && task.isRecurring && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSkipTask(task.id, task.title)
                              }}
                              className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                              title="Skip today"
                            >
                              Skip
                            </button>
                          )}

                          {isCompleted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUndoTask(task.id, task.title)
                              }}
                              className="text-gray-500 hover:text-gray-700"
                              title="Undo"
                            >
                              Undo
                            </button>
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
              <div className="text-gray-400 mb-4">
                <CheckCircle size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">No tasks for today!</h3>
              <p className="text-gray-600">
                {isParent ? 'Create some tasks to get started.' : 'Enjoy your free day!'}
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions for Parents */}
        {isParent && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                onClick={() => setShowFamilyManager(true)}
                className="p-4 text-left rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <h3 className="font-medium text-gray-800">Manage Family</h3>
                <p className="text-sm text-gray-600 mt-1">Invite family members and manage accounts</p>
              </button>
              <button 
                onClick={() => setShowTaskManager(true)}
                className="p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
              >
                <h3 className="font-medium text-gray-800">Manage Tasks</h3>
                <p className="text-sm text-gray-600 mt-1">Add, edit, or remove family tasks</p>
              </button>
              <button 
                onClick={() => setShowRewardManager(true)}
                className="p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
              >
                <h3 className="font-medium text-gray-800">Manage Rewards</h3>
                <p className="text-sm text-gray-600 mt-1">Create and manage family rewards</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}