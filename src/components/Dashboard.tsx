'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Star, CheckCircle, Gift, Settings, Users, Clock, Sun, Moon, Target } from 'lucide-react'
import TaskManager from './TaskManager'
import FamilyManager from './FamilyManager'
import RewardManager from './RewardManager'
import Link from 'next/link'
import { AlertCircle, ExternalLink } from 'lucide-react'
import HabitTracker from './HabitTracker'
import HabitManager from './HabitManager'

interface Task {
  id: string
  title: string
  description?: string
  points: number
  completedAt?: Date | null
  completedToday?: boolean
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

interface TaskCompletion {
  taskId: string
  completedAt: Date
  userId: string
}

interface TaskSkip {
  taskId: string
  skippedAt: Date
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
  const [showHabitManager, setShowHabitManager] = useState(false)
  const [showHabitTracker, setShowHabitTracker] = useState(false)

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

  const isTaskActive = (task: Task): boolean => {
    if (!task.isRecurring) return true
    if (!task.recurringEndDate) return true
    
    const endDate = new Date(task.recurringEndDate)
    endDate.setHours(23, 59, 59, 999)
    const now = new Date()
    
    return now <= endDate
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

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      const result = await response.json()
      
      console.log('API Response:', result)
      
      const data: Task[] = Array.isArray(result) ? result : (result.tasks || [])
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const completionsResponse = await fetch('/api/tasks/todays-completions')
      const todaysCompletions: TaskCompletion[] = await completionsResponse.json()
      const completedTodayIds = new Set(todaysCompletions.map((c) => c.taskId))
      
      const skipsResponse = await fetch('/api/tasks/todays-skips')
      const todaysSkips = await skipsResponse.json()
      const skippedTodayIds = new Set(todaysSkips.map((s: TaskSkip) => s.taskId))
      
      const tasksWithTodayStatus = data.map((task) => ({
        ...task,
        completedToday: completedTodayIds.has(task.id) || 
                        Boolean(task.completedAt && new Date(task.completedAt) >= today),
        skippedToday: skippedTodayIds.has(task.id)
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
  yesterday.setHours(0, 0, 0, 0)
  const yesterdayDayOfWeek = yesterday.getDay()
  const yesterdayName = Object.keys(DAYS_MAP)[Object.values(DAYS_MAP).indexOf(yesterdayDayOfWeek)]

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayDayOfWeek = today.getDay()
  const todayName = Object.keys(DAYS_MAP)[Object.values(DAYS_MAP).indexOf(todayDayOfWeek)]

  return tasks.filter(task => {
    // Check if task is still active (hasn't passed its end date)
    if (!isTaskActive(task)) return false
    
    // Exclude tasks that were completed today or skipped today
    if (task.completedToday || task.skippedToday) return false
    
    // Exclude tasks that were completed recently (within the last day)
    if (task.completedAt) {
      const completedDate = new Date(task.completedAt)
      completedDate.setHours(0, 0, 0, 0)
      // If completed today or after, don't show as missed from yesterday
      if (completedDate >= today) return false
    }

    // For recurring tasks with specific days
    if (task.isRecurring && task.daysOfWeek.length > 0) {
      // EXCLUDE tasks scheduled for TODAY - they belong in "Today's Schedule"
      if (task.daysOfWeek.includes(todayName)) return false
      
      // INCLUDE only if task was scheduled for YESTERDAY
      return task.daysOfWeek.includes(yesterdayName)
    }
    
    // For non-recurring tasks or recurring tasks with no specific days (daily tasks)
    // Show them as missed if not completed
    return true
  })
}

const getTasksForToday = () => {
  const today = new Date().getDay()
  const dayName = Object.keys(DAYS_MAP)[Object.values(DAYS_MAP).indexOf(today)]

  return tasks.filter(task => {
    // Check if task is still active (hasn't passed its end date)
    if (!isTaskActive(task)) return false
    
    // For non-recurring tasks, always show them (one-time tasks)
    if (!task.isRecurring) return true
    
    // For recurring tasks with specific days, check if today is included
    if (task.isRecurring && task.daysOfWeek.length > 0) {
      return task.daysOfWeek.includes(dayName)
    }
    
    // For recurring tasks with no specific days (every day), show them
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
    if (reason === null) return
    
    console.log('Skipping task:', taskId, 'with reason:', reason)
    
    try {
      const response = await fetch('/api/tasks/skip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId, reason })
      })

      console.log('Skip response status:', response.status)
      const data = await response.json()
      console.log('Skip response data:', data)

      if (response.ok) {
        alert('Task skipped')
        console.log('Calling fetchTasks after skip')
        fetchTasks()
        fetchOverdueCount()
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

  // SUB-PAGE VIEWS - Mobile responsive
  if (isParent && showTaskManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Task Manager</h1>
            <button
              onClick={() => setShowTaskManager(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors w-full sm:w-auto"
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Family Manager</h1>
            <button
              onClick={() => setShowFamilyManager(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors w-full sm:w-auto"
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Reward Store</h1>
            <button
              onClick={() => setShowRewardManager(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors w-full sm:w-auto"
            >
              Back to Dashboard
            </button>
          </div>
          <RewardManager />
        </div>
      </div>
    )
  }

  // Habit Manager view (Parents)
  if (isParent && showHabitManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Habit Manager</h1>
            <button
              onClick={() => setShowHabitManager(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <HabitManager />
        </div>
      </div>
    )
  }

  // Habit Tracker view (Kids)
  if (showHabitTracker) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">My Habits</h1>
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

  // MAIN DASHBOARD - Mobile responsive
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header - MOBILE RESPONSIVE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Hi {session?.user?.name || 'there'}! 👋
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              {isChild ? "Let's see what you can accomplish today!" : "Family Dashboard"}
            </p>
          </div>
          
          {/* Parent Buttons - Mobile Responsive */}
          {isParent && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFamilyManager(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none min-w-[90px]"
              >
                <Users size={18} />
                <span className="text-sm sm:text-base">Family</span>
              </button>
              <button
                onClick={() => setShowTaskManager(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none min-w-[90px]"
              >
                <Settings size={18} />
                <span className="text-sm sm:text-base">Tasks</span>
              </button>
              <button
                onClick={() => setShowRewardManager(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none min-w-[90px]"
              >
                <Gift size={18} />
                <span className="text-sm sm:text-base">Rewards</span>
              </button>
              <button
                onClick={() => setShowHabitManager(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Target size={20} />
                Habits
              </button>
            </div>
          )}
          
          {/* Child Button - Mobile Responsive */}
          {isChild && (
            <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowRewardManager(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
            >
              <Gift size={18} />
              <span className="text-sm sm:text-base">Reward Store</span>
            </button>
              <button
                onClick={() => setShowHabitTracker(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Target size={20} />
                My Habits
              </button>
            </div>
          )}
        </div>

        {/* Stats Cards - MOBILE RESPONSIVE: 2 columns on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-yellow-100 p-2 rounded-lg shrink-0">
                <Star className="text-yellow-600" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Current Points</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{stats.currentPoints}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-green-100 p-2 rounded-lg shrink-0">
                <CheckCircle className="text-green-600" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Tasks Today</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{stats.tasksCompletedToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-blue-100 p-2 rounded-lg shrink-0">
                <Gift className="text-blue-600" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Total Earned</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{stats.totalEarned}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-orange-100 p-2 rounded-lg shrink-0">
                <span className="text-orange-600 text-xl">🔥</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Streak Days</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{stats.streak}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Overdue Warning Banner - MOBILE RESPONSIVE */}
        {overdueTasks > yesterdaysMissed.length && (
          <div className="mb-4 sm:mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-3 flex-1">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={24} />
                <div className="min-w-0">
                  <h3 className="font-semibold text-red-800 text-sm sm:text-base">
                    You have {overdueTasks} overdue tasks
                  </h3>
                  <p className="text-xs sm:text-sm text-red-600">
                    Take a moment to catch up or reschedule them
                  </p>
                </div>
              </div>
              <Link
                href="/overdue-tasks"
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm text-center whitespace-nowrap"
              >
                Manage Overdue
              </Link>
            </div>
          </div>
        )}

        {/* Yesterday's Missed Tasks - MOBILE RESPONSIVE */}
        {yesterdaysMissed.length > 0 && (
          <div className="mb-4 sm:mb-6 bg-orange-50 border-2 border-orange-200 rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3">
              <h3 className="text-base sm:text-lg font-semibold text-orange-800">
                Yesterday&apos;s Incomplete ({yesterdaysMissed.length})
              </h3>
              <Link
                href="/overdue-tasks"
                className="flex items-center justify-center gap-1 text-xs sm:text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                View All Overdue
                <ExternalLink size={14} />
              </Link>
            </div>
            <div className="space-y-2">
              {yesterdaysMissed.slice(0, 3).map(task => (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 bg-white rounded-lg border border-orange-200">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-gray-800 text-sm sm:text-base break-words">{task.title}</h4>
                    {task.description && <p className="text-xs sm:text-sm text-gray-600 break-words line-clamp-2">{task.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-yellow-100 text-yellow-700 whitespace-nowrap">
                      {task.points} pts
                    </span>
                    <button
                      onClick={() => handleCompleteTask(task.id, task.title)}
                      disabled={completingTask === task.id}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap"
                      title="Mark as completed"
                    >
                      {completingTask === task.id ? '...' : 'Complete'}
                    </button>
                    <button
                      onClick={() => handleSkipTask(task.id, task.title)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap"
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
                  className="block text-center text-xs sm:text-sm text-orange-600 hover:text-orange-700 font-medium mt-2"
                >
                  + {yesterdaysMissed.length - 3} more overdue tasks →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Today's Schedule */}
        <div className="space-y-4 sm:space-y-6">
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Today&apos;s Schedule</h2>
            <p className="text-sm sm:text-base text-gray-600">
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
                {/* Period Header - MOBILE RESPONSIVE */}
                <div className={`p-3 sm:p-4 rounded-t-xl ${isCurrentPeriod ? periodInfo.bgColor : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`p-1.5 sm:p-2 rounded-lg ${periodInfo.color} shrink-0`}>
                        <IconComponent size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                          <span className="truncate">{periodInfo.label}</span>
                          {isCurrentPeriod && (
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                              Current
                            </span>
                          )}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">{periodInfo.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap shrink-0">
                      {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Tasks - MOBILE RESPONSIVE */}
                <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                  {periodTasks.map((task) => {
                    const isCompleted = task.completedToday === true || 
                      (task.completedAt !== null && 
                      task.completedAt !== undefined
                      )
                    const isSkipped = task.skippedToday === true 

                    console.log('Task Debug:', {
                      title: task.title,
                      completedToday: task.completedToday,
                      skippedToday: task.skippedToday,
                      completedAt: task.completedAt,
                      completedAtType: typeof task.completedAt,
                      isCompleted: isCompleted,
                      isSkipped: isSkipped
                    })

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
                              <h4 className={`font-medium text-sm sm:text-base break-words ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                {task.title}
                              </h4>
                              {(() => {
                                const endStatus = getEndDateStatus(task)
                                if (!endStatus) return null
                                return (
                                  <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 ${endStatus.color}`}>
                                    <span className="hidden sm:inline">{endStatus.icon}</span> {endStatus.text}
                                  </span>
                                )
                              })()}
                            </div>
                            {task.description && (
                              <p className={`text-xs sm:text-sm mt-1 break-words line-clamp-2 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:ml-auto shrink-0">
                          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap ${
                            isCompleted
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {task.points} pts
                          </span>

                          {!isCompleted && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCompleteTask(task.id, task.title)
                                }}
                                className="bg-green-500 hover:bg-green-600 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap"
                                title="Complete task"
                              >
                                <CheckCircle size={14} />
                                <span className="hidden sm:inline">Complete</span>
                              </button>
                              {task.isRecurring && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSkipTask(task.id, task.title)
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap"
                                  title="Skip today"
                                >
                                  Skip
                                </button>
                              )}
                            </>
                          )}

                          {isCompleted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUndoTask(task.id, task.title)
                              }}
                              className="text-gray-500 hover:text-gray-700 text-xs sm:text-sm underline"
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
              <div className="text-gray-400 mb-4">
                <CheckCircle size={48} className="mx-auto" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-2">No tasks for today!</h3>
              <p className="text-sm sm:text-base text-gray-600">
                {isParent ? 'Create some tasks to get started.' : 'Enjoy your free day!'}
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions for Parents - MOBILE RESPONSIVE */}
        {isParent && (
          <div className="mt-6 sm:mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <button 
                onClick={() => setShowFamilyManager(true)}
                className="p-3 sm:p-4 text-left rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <h3 className="font-medium text-gray-800 text-sm sm:text-base">Manage Family</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Invite family members and manage accounts</p>
              </button>
              
              <button 
                onClick={() => setShowTaskManager(true)}
                className="p-3 sm:p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
              >
                <h3 className="font-medium text-gray-800 text-sm sm:text-base">Manage Tasks</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Add, edit, or remove family tasks</p>
              </button>
              
              <button 
                onClick={() => setShowRewardManager(true)}
                className="p-3 sm:p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
              >
                <h3 className="font-medium text-gray-800 text-sm sm:text-base">Manage Rewards</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Create and manage family rewards</p>
              </button>
              
              <Link
                href="/manage-completions"
                className="p-3 sm:p-4 text-left rounded-lg border border-gray-200 hover:border-red-300 transition-colors block"
              >
                <h3 className="font-medium text-gray-800 text-sm sm:text-base">Manage Completions</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">View and delete task completion history</p>
              </Link>
              <button
                onClick={() => setShowHabitManager(true)}
                className="p-4 text-left rounded-lg border border-gray-200 hover:border-teal-300 transition-colors"
              >
                <h3 className="font-medium text-gray-800">Manage Habits</h3>
                <p className="text-sm text-gray-600 mt-1">Track reading, exercise, and healthy habits</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}