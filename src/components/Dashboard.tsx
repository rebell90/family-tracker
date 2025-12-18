'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Star, CheckCircle, Gift, Clock, Sun, Moon, Target, AlertCircle } from 'lucide-react'
import RewardManager from './RewardManager'
import HabitTracker from './HabitTracker'
import Link from 'next/link'

// ============================================================================
// TYPES
// ============================================================================

interface Task {
  id: string
  title: string
  description?: string
  points: number
  completedAt?: Date | null
  completedToday?: boolean
  completedBy?: string | null
  skippedToday?: boolean
  timePeriod?: string
  isRecurring: boolean
  daysOfWeek: string[]
  category?: string
  recurringEndDate?: string | null
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

type TimePeriodKey = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANYTIME'

interface TimePeriodInfo {
  label: string
  subtitle: string
  icon: React.ComponentType<{ size?: number }>
  color: string
  borderColor: string
  bgColor: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIME_PERIODS: Record<TimePeriodKey, TimePeriodInfo> = {
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

// ============================================================================
// COMPONENT
// ============================================================================

export default function Dashboard() {
  const { data: session } = useSession()
  
  // State
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<UserStats>({
    currentPoints: 0,
    totalEarned: 0,
    tasksCompletedToday: 0,
    streak: 0
  })
  const [showRewardManager, setShowRewardManager] = useState(false)
  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [showHabitTracker, setShowHabitTracker] = useState(false)
  const [overdueTasks, setOverdueTasks] = useState<number>(0) // ✅ ADDED

  const userName = session?.user?.name || 'there'

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    if (session?.user) {
      fetchTasks()
      fetchUserPoints()
      fetchOverdueCount() // ✅ ADDED
    }
  }, [session])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      const result = await response.json()
      
      const data: Task[] = Array.isArray(result) ? result : (result.tasks || [])
      setTasks(data)
      
      // ✅ CALCULATE tasksCompletedToday from tasks
      const completedToday = data.filter(t => t.completedToday || t.completedAt).length
      setStats(prev => ({
        ...prev,
        tasksCompletedToday: completedToday
      }))
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

  const fetchOverdueCount = async () => { // ✅ NEW FUNCTION
    try {
      const response = await fetch('/api/tasks/overdue')
      if (response.ok) {
        const data = await response.json()
        const actualOverdue = (data.tasks || []).filter(
          (t: Task) => !t.completedToday && !t.completedAt && !t.skippedToday
        )
        setOverdueTasks(actualOverdue.length)
      }
    } catch (error) {
      console.error('Error fetching overdue tasks:', error)
    }
  }

  // ============================================================================
  // TASK ACTIONS
  // ============================================================================

  const handleCompleteTask = async (taskId: string, taskTitle: string) => {
    if (completingTask === taskId) return

    setCompletingTask(taskId)
    
    try {
      const response = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (response.ok) {
        await fetchTasks()
        await fetchUserPoints()
        await fetchOverdueCount() // ✅ ADDED
      } else {
        console.error('Failed to complete task')
      }
    } catch (error) {
      console.error('Error completing task:', error)
    } finally {
      setCompletingTask(null)
    }
  }

  const handleSkipTask = async (taskId: string, taskTitle: string) => {
    try {
      const response = await fetch('/api/tasks/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (response.ok) {
        await fetchTasks()
        await fetchOverdueCount() // ✅ ADDED
      } else {
        console.error('Failed to skip task')
      }
    } catch (error) {
      console.error('Error skipping task:', error)
    }
  }

  const handleUndoTask = async (taskId: string, taskTitle: string) => {
    try {
      const response = await fetch('/api/tasks/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (response.ok) {
        await fetchTasks()
        await fetchUserPoints()
        await fetchOverdueCount() // ✅ ADDED
      } else {
        console.error('Failed to undo task')
      }
    } catch (error) {
      console.error('Error undoing task:', error)
    }
  }

  // ============================================================================
  // TASK FILTERING & HELPERS
  // ============================================================================

  const isTaskActive = (task: Task): boolean => {
    if (!task.isRecurring) return true
    if (!task.recurringEndDate) return true
    
    const endDate = new Date(task.recurringEndDate)
    endDate.setHours(23, 59, 59, 999)
    const now = new Date()
    
    return now <= endDate
  }

  const isTaskForToday = (task: Task): boolean => {
    // Non-recurring tasks are always shown
    if (!task.isRecurring) return true
    
    // If no days specified, show it
    if (!task.daysOfWeek || task.daysOfWeek.length === 0) return true
    
    // Check if today is in the daysOfWeek array
    const today = new Date().getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
    const todayName = dayNames[today]
    
    return task.daysOfWeek.includes(todayName)
  }

  const getEndDateStatus = (task: Task) => {
    if (!task.isRecurring || !task.recurringEndDate) return null
    
    const endDate = new Date(task.recurringEndDate)
    const now = new Date()
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysRemaining < 0) {
      return { text: 'Expired', color: 'bg-gray-100 text-gray-600', icon: '⏰' }
    }
    if (daysRemaining === 0) {
      return { text: 'Last day!', color: 'bg-orange-100 text-orange-700', icon: '⚠️' }
    }
    if (daysRemaining <= 3) {
      return { text: `${daysRemaining} days left`, color: 'bg-orange-100 text-orange-700', icon: '⚠️' }
    }
    if (daysRemaining <= 7) {
      return { text: `${daysRemaining} days left`, color: 'bg-yellow-100 text-yellow-700', icon: '📅' }
    }
    return { text: `Ends ${endDate.toLocaleDateString()}`, color: 'bg-blue-100 text-blue-700', icon: '📅' }
  }

  const getCurrentPeriod = (): TimePeriodKey => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 12) return 'MORNING'
    if (hour >= 12 && hour < 18) return 'AFTERNOON'
    if (hour >= 18 && hour < 22) return 'EVENING'
    return 'ANYTIME'
  }

  // Filter active tasks for today (both active AND scheduled for today)
  const todaysTasks = tasks.filter(task => isTaskActive(task) && isTaskForToday(task))

  // Group tasks by time period
  const tasksByPeriod: Record<TimePeriodKey, Task[]> = {
    MORNING: todaysTasks.filter(t => t.timePeriod === 'MORNING'),
    AFTERNOON: todaysTasks.filter(t => t.timePeriod === 'AFTERNOON'),
    EVENING: todaysTasks.filter(t => t.timePeriod === 'EVENING'),
    ANYTIME: todaysTasks.filter(t => !t.timePeriod || t.timePeriod === 'ANYTIME')
  }

  const currentPeriod = getCurrentPeriod()

  // ============================================================================
  // MODALS / FULL-PAGE VIEWS
  // ============================================================================

  if (showRewardManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
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

  if (showHabitTracker) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Habit Tracker</h1>
            <button
              onClick={() => setShowHabitTracker(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <HabitTracker />
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">
              Hi {userName}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              Let&apos;s see what you can accomplish today!
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRewardManager(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Gift size={20} />
              Reward Store
            </button>
            <button
              onClick={() => setShowHabitTracker(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Target size={20} />
              Habits
            </button>
          </div>
        </div>

        {/* Overdue Tasks Banner */}
        {overdueTasks > 0 && (
          <Link 
            href="/overdue-tasks"
            className="block mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {overdueTasks} Task{overdueTasks !== 1 ? 's' : ''} Need{overdueTasks === 1 ? 's' : ''} Attention!
                  </h3>
                  <p className="text-white/90 text-sm">
                    Tap to complete or skip overdue tasks
                  </p>
                </div>
              </div>
              <div className="text-white/80">
                →
              </div>
            </div>
          </Link>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                <Star className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Streak</p>
                <p className="text-2xl font-bold text-gray-800">{stats.streak} days 🔥</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks by Time Period */}
        <div className="space-y-6">
          {(Object.keys(TIME_PERIODS) as TimePeriodKey[]).map((period) => {
            const periodTasks = tasksByPeriod[period]
            if (periodTasks.length === 0) return null

            const periodInfo = TIME_PERIODS[period]
            const IconComponent = periodInfo.icon
            const isCurrentPeriod = period === currentPeriod

            return (
              <div
                key={period}
                className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-shadow ${
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
                    const isCompleted = task.completedToday || task.completedAt
                    const isSkipped = task.skippedToday // ✅ ADDED
                    const isDone = isCompleted || isSkipped // ✅ ADDED
                    const endStatus = getEndDateStatus(task)

                    // ✅ Don't show skipped tasks at all
                    if (isSkipped) return null

                    return (
                      <div
                        key={task.id}
                        className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 rounded-lg border-2 transition-all ${
                          isCompleted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200 hover:border-purple-400 hover:shadow-md'
                        }`}
                      >
                        <div
                          className="flex items-start gap-3 flex-1 cursor-pointer min-w-0"
                          onClick={() => !isCompleted && handleCompleteTask(task.id, task.title)}
                        >
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-3 flex items-center justify-center transition-colors shrink-0 ${
                              isCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-purple-400 hover:bg-purple-50'
                            }`}
                          >
                            {isCompleted && <CheckCircle size={18} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <h4 className={`font-medium text-sm sm:text-base break-words ${
                                isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'
                              }`}>
                                {task.title}
                              </h4>
                              {endStatus && (
                                <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 ${endStatus.color}`}>
                                  <span className="hidden sm:inline">{endStatus.icon}</span> {endStatus.text}
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className={`text-xs sm:text-sm mt-1 break-words line-clamp-2 ${
                                isCompleted ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:ml-auto shrink-0">
                          <span className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${isCompleted
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {task.points} pts
                          </span>

                          {!isCompleted && (
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCompleteTask(task.id, task.title)
                                }}
                                className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[90px]"
                                title="Complete task"
                              >
                                <CheckCircle size={16} />
                                <span>✓</span>
                              </button>
                              {task.isRecurring && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSkipTask(task.id, task.title)
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-w-[60px]"
                                  title="Skip today"
                                >
                                  Skip
                                </button>
                              )}
                            </div>
                          )}

                          {isCompleted && task.completedBy === userName && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUndoTask(task.id, task.title)
                              }}
                              className="flex items-center gap-1 bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-w-[80px] justify-center"
                            >
                              <span className="text-base">↩</span>
                              <span>Undo</span>
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
              <div className="text-gray-400 mb-4">
                <CheckCircle size={48} className="mx-auto" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-2">
                No tasks for today!
              </h3>
              <p className="text-sm sm:text-base text-gray-600">
                Enjoy your free day! 🎉
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}