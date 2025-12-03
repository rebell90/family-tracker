'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Star, CheckCircle, Gift, Users, Calendar, Clock, Sunrise, Sun, Sunset, Moon, LucideIcon, Settings, Target, BarChart3, AlertCircle } from 'lucide-react'
import TaskManager from './TaskManager'
import FamilyManager from './FamilyManager'
import RewardManager from './RewardManager'
import HabitManager from './HabitManager'
import ParentWeeklyView from './ParentWeeklyView'

interface Child {
  id: string
  name: string
  email: string
  role?: string
}

interface Task {
  id: string
  title: string
  description?: string | null
  points: number
  completedAt?: Date | string | null
  completedToday?: boolean
  completedBy?: string | null
  skippedToday?: boolean
  timePeriod?: string | null
  isRecurring: boolean
  daysOfWeek: string[]
  category?: string | null
  startDate?: string | Date | null
  recurringEndDate?: string | Date | null
  assignedTo?: {
    id: string
    name: string | null
  } | null
}

interface ChildStats {
  currentPoints: number
  totalEarned: number
  tasksCompletedToday: number
  streak: number
}

interface FamilyMembersResponse {
  members?: Child[]
}

interface TasksResponse {
  tasks?: Task[]
}

interface UserPointsResponse {
  currentPoints?: number
  totalEarned?: number
  tasksCompletedToday?: number
  streak?: number
}

interface OverdueResponse {
  tasks?: Task[]
}

interface TimePeriodInfo {
  label: string
  icon: LucideIcon
  subtitle: string
  color: string
  bgColor: string
  borderColor: string
}

type TimePeriodKey = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' | 'ANYTIME'

type TimePeriods = Record<TimePeriodKey, TimePeriodInfo>

type TasksByPeriod = Record<string, Task[]>

const TIME_PERIODS: TimePeriods = {
  MORNING: { label: 'Morning', icon: Sunrise, subtitle: '6 AM - 12 PM', color: 'bg-orange-100 text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' },
  AFTERNOON: { label: 'Afternoon', icon: Sun, subtitle: '12 PM - 5 PM', color: 'bg-yellow-100 text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' },
  EVENING: { label: 'Evening', icon: Sunset, subtitle: '5 PM - 9 PM', color: 'bg-purple-100 text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-300' },
  NIGHT: { label: 'Night', icon: Moon, subtitle: '9 PM - 11 PM', color: 'bg-blue-100 text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' },
  ANYTIME: { label: 'Anytime', icon: Calendar, subtitle: 'No specific time', color: 'bg-gray-100 text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-300' },
}

const DAYS_MAP: Record<string, number> = {
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
  
  // View state toggles
  const [showTaskManager, setShowTaskManager] = useState(false)
  const [showFamilyManager, setShowFamilyManager] = useState(false)
  const [showRewardManager, setShowRewardManager] = useState(false)
  const [showHabitManager, setShowHabitManager] = useState(false)
  const [showWeeklyView, setShowWeeklyView] = useState(false)
  
  // Data state
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string>('all')
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<ChildStats>({
    currentPoints: 0,
    totalEarned: 0,
    tasksCompletedToday: 0,
    streak: 0
  })
  const [overdueCount, setOverdueCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
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

  const fetchChildren = async (): Promise<void> => {
    try {
      const response = await fetch('/api/family/members')
      const data: FamilyMembersResponse = await response.json()
      
      const childMembers = data.members?.filter((m: Child) => m.role === 'CHILD') || []
      setChildren(childMembers)
      
      if (childMembers.length > 0) {
        setSelectedChildId('all')
      }
    } catch (error) {
      console.error('Error fetching children:', error)
    }
  }

  const fetchTasksForChild = async (): Promise<void> => {
    try {
      const endpoint = selectedChildId === 'all' 
        ? '/api/tasks/all-children'
        : `/api/tasks?childId=${selectedChildId}`
      
      const response = await fetch(endpoint)
      const data: TasksResponse = await response.json()
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStatsForChild = async (): Promise<void> => {
    if (selectedChildId === 'all') {
      try {
        const statsPromises = children.map((child: Child) =>
          fetch(`/api/user/points?userId=${child.id}`).then(r => r.json())
        )
        const allStats: UserPointsResponse[] = await Promise.all(statsPromises)
        
        const aggregated = allStats.reduce<ChildStats>((acc, stat) => ({
          currentPoints: acc.currentPoints + (stat.currentPoints || 0),
          totalEarned: acc.totalEarned + (stat.totalEarned || 0),
          tasksCompletedToday: acc.tasksCompletedToday + (stat.tasksCompletedToday || 0),
          streak: Math.max(acc.streak, stat.streak || 0)
        }), { currentPoints: 0, totalEarned: 0, tasksCompletedToday: 0, streak: 0 })
        
        setStats(aggregated)
      } catch (error) {
        console.error('Error fetching aggregate stats:', error)
      }
    } else {
      try {
        const response = await fetch(`/api/user/points?userId=${selectedChildId}`)
        const data: UserPointsResponse = await response.json()
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

  const fetchOverdueForChild = async (): Promise<void> => {
    if (selectedChildId === 'all') {
      try {
        const countPromises = children.map((child: Child) =>
          fetch(`/api/tasks/overdue?userId=${child.id}`).then(r => r.json())
        )
        const allOverdue: OverdueResponse[] = await Promise.all(countPromises)
        const total = allOverdue.reduce((sum, data) => sum + (data.tasks?.length || 0), 0)
        setOverdueCount(total)
      } catch (error) {
        console.error('Error fetching overdue count:', error)
      }
    } else {
      try {
        const response = await fetch(`/api/tasks/overdue?userId=${selectedChildId}`)
        const data: OverdueResponse = await response.json()
        setOverdueCount(data.tasks?.length || 0)
      } catch (error) {
        console.error('Error fetching overdue count:', error)
      }
    }
  }

  const handleCompleteTask = async (taskId: string, taskTitle: string, childName: string): Promise<void> => {
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

  const handleUndoTask = async (taskId: string, taskTitle: string, childName: string): Promise<void> => {
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

  const getTasksForToday = (): Task[] => {
    const today = new Date().getDay()
    const dayName = Object.keys(DAYS_MAP)[Object.values(DAYS_MAP).indexOf(today)]

    return tasks.filter((task: Task) => {
      if (!task.isRecurring) return true
      if (task.isRecurring && task.daysOfWeek.length > 0) {
        return task.daysOfWeek.includes(dayName)
      }
      return true
    })
  }

  const tasksByPeriod: TasksByPeriod = getTasksForToday().reduce<TasksByPeriod>((acc, task) => {
    const period = task.timePeriod || 'ANYTIME'
    if (!acc[period]) acc[period] = []
    acc[period].push(task)
    return acc
  }, {})

  const getCurrentPeriod = (): TimePeriodKey => {
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
    : children.find((c: Child) => c.id === selectedChildId)?.name || 'Child'

  // Task Manager View
  if (showTaskManager) {
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

  // Family Manager View
  if (showFamilyManager) {
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

  // Reward Manager View
  if (showRewardManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
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

  // Habit Manager View
  if (showHabitManager) {
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

  // Weekly View
  if (showWeeklyView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Weekly Progress</h1>
            <button
              onClick={() => setShowWeeklyView(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <ParentWeeklyView />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  // MAIN PARENT DASHBOARD
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Hi {session?.user?.name || 'there'}! 👋
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Parent Dashboard - Monitor your family's progress
            </p>
          </div>
          
          {/* Parent Navigation Buttons */}
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
              className="bg-teal-600 hover:bg-teal-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none min-w-[90px]"
            >
              <Target size={18} />
              <span className="text-sm sm:text-base">Habits</span>
            </button>
          </div>
        </div>

        {/* Child Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            View tasks for:
          </label>
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Children</option>
            {children.map((child: Child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <Star className="text-yellow-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Current Points</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">{stats.currentPoints}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedChildName}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Tasks Today</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">{stats.tasksCompletedToday}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedChildName}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Gift className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Earned</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">{stats.totalEarned}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedChildName}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <span className="text-orange-600 text-2xl">🔥</span>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">
                  {selectedChildId === 'all' ? 'Best Streak' : 'Streak Days'}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">{stats.streak}</p>
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
                <a
                  href={`/overdue-tasks${selectedChildId !== 'all' ? `?childId=${selectedChildId}` : ''}`}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  View Overdue Tasks →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => window.location.href = '/overdue-tasks'}
            className="bg-white hover:bg-red-50 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md hover:border-red-300 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="bg-red-100 group-hover:bg-red-200 p-3 rounded-xl transition-colors">
                <AlertCircle className="text-red-600" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">Overdue Tasks</h3>
                <p className="text-xs sm:text-sm text-gray-600">Review past tasks</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowWeeklyView(true)}
            className="bg-white hover:bg-indigo-50 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md hover:border-indigo-300 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="bg-indigo-100 group-hover:bg-indigo-200 p-3 rounded-xl transition-colors">
                <BarChart3 className="text-indigo-600" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">Weekly Report</h3>
                <p className="text-xs sm:text-sm text-gray-600">View analytics</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowHabitManager(true)}
            className="bg-white hover:bg-teal-50 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md hover:border-teal-300 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="bg-teal-100 group-hover:bg-teal-200 p-3 rounded-xl transition-colors">
                <Target className="text-teal-600" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">Habit Tracker</h3>
                <p className="text-xs sm:text-sm text-gray-600">Track goals</p>
              </div>
            </div>
          </button>
        </div>

        {/* Today's Tasks */}
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
              Today's Schedule - {selectedChildName}
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          {(Object.entries(TIME_PERIODS) as [TimePeriodKey, TimePeriodInfo][]).map(([periodKey, periodInfo]) => {
            const periodTasks = tasksByPeriod[periodKey] || []
            const visibleTasks = periodTasks.filter((t: Task) => !t.skippedToday)
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
                <div className={`p-4 rounded-t-xl ${isCurrentPeriod ? periodInfo.bgColor : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${periodInfo.color}`}>
                        <IconComponent size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                          {periodInfo.label}
                          {isCurrentPeriod && (
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">{periodInfo.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-500">
                      {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="p-3 sm:p-4 space-y-3">
                  {periodTasks.map((task: Task) => {
                    const isCompleted = task.completedToday === true || task.completedAt !== null
                    const isSkipped = task.skippedToday === true

                    if (isSkipped) return null

                    return (
                      <div
                        key={task.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 transition-all gap-3 ${
                          isCompleted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200 hover:border-purple-400'
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={`w-8 h-8 rounded-full border-3 flex items-center justify-center shrink-0 ${
                              isCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-purple-400'
                            }`}
                          >
                            {isCompleted && <CheckCircle size={18} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className={`font-medium text-sm sm:text-base ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                {task.title}
                              </h4>
                              {task.assignedTo && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  {task.assignedTo.name}
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className={`text-xs sm:text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end sm:justify-start">
                          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium shrink-0 ${
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
                              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
                            >
                              {completingTask === task.id ? 'Completing...' : (
                                <>
                                  <CheckCircle size={16} />
                                  <span className="hidden sm:inline">Complete</span>
                                  <span className="sm:hidden">✓</span>
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
                                className="text-gray-500 hover:text-gray-700 text-xs sm:text-sm underline"
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
              <CheckCircle size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-2">
                No tasks for {selectedChildName} today!
              </h3>
              <p className="text-sm sm:text-base text-gray-600">
                They're all set or it's a free day!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}